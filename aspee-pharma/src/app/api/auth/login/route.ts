import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/serverAuth';

const MAX_EMAIL_FAILURES = 5;
const MAX_IP_FAILURES = 20;
const WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 15;

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        '0.0.0.0'
    );
}

async function countFailures(
    admin: ReturnType<typeof createServiceRoleClient>,
    filter: { email?: string; ip?: string },
    windowStart: string
): Promise<number> {
    let query = admin
        .from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('success', false)
        .gte('attempted_at', windowStart);
    if (filter.email) query = query.eq('email', filter.email);
    if (filter.ip) query = query.eq('ip_address', filter.ip);
    const { count } = await query;
    return count ?? 0;
}

export async function POST(request: NextRequest) {
    let body: { email?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? '';
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const admin = createServiceRoleClient();

    // Rate limit checks — fail open on DB error so a tracking outage never blocks legitimate logins
    try {
        const emailFailures = await countFailures(admin, { email: normalizedEmail }, windowStart);
        if (emailFailures >= MAX_EMAIL_FAILURES) {
            return NextResponse.json(
                {
                    error: `Too many failed attempts for this account. Please wait ${LOCKOUT_MINUTES} minutes and try again.`,
                    locked: true,
                },
                { status: 429 }
            );
        }

        const ipFailures = await countFailures(admin, { ip }, windowStart);
        if (ipFailures >= MAX_IP_FAILURES) {
            return NextResponse.json(
                {
                    error: `Too many login attempts from your network. Please wait ${LOCKOUT_MINUTES} minutes and try again.`,
                    locked: true,
                },
                { status: 429 }
            );
        }
    } catch {
        // Fail open: rate-limit check error must not block valid logins
    }

    // Buffer cookies that Supabase wants to set — we apply them to the NextResponse at the end.
    // In Next.js 15 route handlers, cookies() is read-only; we must set cookies on the response
    // object directly, not via cookieStore.set().
    type CookieEntry = { name: string; value: string; options: Record<string, unknown> };
    const pendingCookies: CookieEntry[] = [];

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    pendingCookies.push(...(cookiesToSet as CookieEntry[]));
                },
            },
        }
    );

    const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
    });

    const succeeded = !authError;

    // Record attempt — best effort; tracking failure must never break the auth flow
    try {
        await admin.from('login_attempts').insert({
            email: normalizedEmail,
            ip_address: ip,
            success: succeeded,
            user_agent: userAgent,
        });

        if (succeeded) {
            // Clear the failure log for this account so the lockout window resets
            await admin
                .from('login_attempts')
                .delete()
                .eq('email', normalizedEmail)
                .eq('success', false);
        }
    } catch {
        // ignore
    }

    if (!succeeded) {
        let remaining = MAX_EMAIL_FAILURES - 1;
        try {
            const updated = await countFailures(admin, { email: normalizedEmail }, windowStart);
            remaining = Math.max(0, MAX_EMAIL_FAILURES - updated);
        } catch {
            // ignore
        }

        const message =
            remaining === 0
                ? `Too many failed attempts for this account. Please wait ${LOCKOUT_MINUTES} minutes and try again.`
                : `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before your account is temporarily locked.`;

        return NextResponse.json({ error: message }, { status: 401 });
    }

    // Write the Supabase session cookies onto the response so the browser stores the session
    const response = NextResponse.json({ success: true });
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });
    return response;
}
