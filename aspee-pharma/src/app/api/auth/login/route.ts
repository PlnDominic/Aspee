import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/serverAuth';

const MAX_EMAIL_FAILURES = 5;
const MAX_IP_FAILURES = 100;      // generous for corporate NAT — the per-email limit is the real guard
const WINDOW_MINUTES = 15;
const LOCKOUT_SECONDS = WINDOW_MINUTES * 60;
const CLEANUP_AFTER_HOURS = 24;
const CLEANUP_PROBABILITY = 0.05; // clean up stale rows on ~5% of requests (fire-and-forget)

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

function lockedResponse(message: string): NextResponse {
    return NextResponse.json(
        { error: message, locked: true },
        { status: 429, headers: { 'Retry-After': String(LOCKOUT_SECONDS) } }
    );
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

    // Reject obviously invalid emails before they touch the DB
    if (!email.includes('@') || email.length > 254) {
        return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? '';
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const admin = createServiceRoleClient();

    // Rate limit checks — fail open on any DB error so a tracking outage never blocks valid logins
    let emailFailuresBeforeAttempt = 0;
    try {
        emailFailuresBeforeAttempt = await countFailures(admin, { email: normalizedEmail }, windowStart);
        if (emailFailuresBeforeAttempt >= MAX_EMAIL_FAILURES) {
            return lockedResponse(
                `Too many failed attempts for this account. Please wait ${WINDOW_MINUTES} minutes and try again.`
            );
        }

        const ipFailures = await countFailures(admin, { ip }, windowStart);
        if (ipFailures >= MAX_IP_FAILURES) {
            return lockedResponse(
                `Too many login attempts from your network. Please wait ${WINDOW_MINUTES} minutes and try again.`
            );
        }
    } catch {
        // Fail open: DB error must never block a legitimate login
    }

    // Probabilistic cleanup — deletes rows older than 24 h on ~5% of requests.
    // Fire-and-forget: never awaited, never blocks the login response.
    if (Math.random() < CLEANUP_PROBABILITY) {
        const cutoff = new Date(Date.now() - CLEANUP_AFTER_HOURS * 3600 * 1000).toISOString();
        admin.from('login_attempts').delete().lt('attempted_at', cutoff).then(() => {}).catch(() => {});
    }

    // Authenticate with a cookie-aware server client so session cookies land in the response
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
            // Clear failure log for this account so the lockout window resets
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
        // Derive remaining attempts from the pre-attempt count — avoids a redundant DB round-trip
        const failuresNow = emailFailuresBeforeAttempt + 1;
        const remaining = Math.max(0, MAX_EMAIL_FAILURES - failuresNow);

        const message =
            remaining === 0
                ? `Too many failed attempts for this account. Please wait ${WINDOW_MINUTES} minutes and try again.`
                : `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before your account is temporarily locked.`;

        const res = NextResponse.json({ error: message }, { status: 401 });
        if (remaining === 0) res.headers.set('Retry-After', String(LOCKOUT_SECONDS));
        return res;
    }

    // Write Supabase session cookies onto the response
    const response = NextResponse.json({ success: true });
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });
    return response;
}
