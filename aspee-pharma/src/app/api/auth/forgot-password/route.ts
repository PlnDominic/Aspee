import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJsonBody } from '@/lib/requestLimits';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

// Server-side wrapper around resetPasswordForEmail so the request can be
// rate limited before it reaches Supabase — otherwise this endpoint is an
// unauthenticated way to spam a target's inbox or probe which emails have
// accounts.
export async function POST(request: NextRequest) {
    const { body, error: bodyError } = await readJsonBody<{ email?: string }>(request, 1024);
    if (bodyError) return bodyError;

    const { email } = body || {};
    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 254) {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);

    const rateLimitError = await enforceRateLimit('forgot-password', [
        { keyType: 'email', keyValue: normalizedEmail, max: 5, windowMinutes: 15 },
        { keyType: 'ip', keyValue: ip, max: 20, windowMinutes: 15 },
    ]);
    if (rateLimitError) return rateLimitError;

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    try {
        await supabase.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: `${origin}/reset-password`,
        });
    } catch {
        // ignore — never reveal whether the send failed or the account exists
    }

    // Always report success, regardless of whether the account exists or the
    // send failed — the response must not leak account existence.
    return NextResponse.json({ success: true });
}
