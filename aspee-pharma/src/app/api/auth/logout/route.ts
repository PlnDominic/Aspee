import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type CookieEntry = { name: string; value: string; options: Record<string, unknown> };

export async function POST(request: NextRequest) {
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

    // Revoke the session token with Supabase Auth and clear the local session.
    // 'local' scope revokes this session only; use 'global' to sign out all devices.
    await supabase.auth.signOut({ scope: 'local' });

    const response = NextResponse.json({ success: true });

    // Apply the cleared session cookies Supabase emitted via setAll
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });

    // Safety net: explicitly expire any remaining sb-* cookies Supabase may not have touched
    request.cookies.getAll()
        .filter(c => c.name.startsWith('sb-'))
        .forEach(c => {
            if (!pendingCookies.some(pc => pc.name === c.name)) {
                response.cookies.set(c.name, '', { maxAge: 0, path: '/' });
            }
        });

    return response;
}
