import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/serverAuth';

export type RateLimitCheck = {
    keyType: 'user' | 'ip' | 'email';
    keyValue: string;
    max: number;
    windowMinutes: number;
};

const CLEANUP_AFTER_HOURS = 24;
const CLEANUP_PROBABILITY = 0.05; // clean up stale rows on ~5% of calls (fire-and-forget)

export function getClientIp(request: Request): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '0.0.0.0'
    );
}

/**
 * Generic sliding-window rate limiter backed by rate_limit_events (same
 * pattern as login_attempts). Checks every given key — e.g. per-user and
 * per-IP together — and rejects with 429 if ANY key is already at its
 * limit; otherwise records one event per key and lets the request through.
 *
 * Fails open on any DB error — a tracking outage must never block a
 * legitimate request.
 */
export async function enforceRateLimit(
    route: string,
    checks: RateLimitCheck[]
): Promise<NextResponse | null> {
    const admin = createServiceRoleClient();

    try {
        for (const check of checks) {
            const windowStart = new Date(Date.now() - check.windowMinutes * 60 * 1000).toISOString();
            const { count } = await admin
                .from('rate_limit_events')
                .select('*', { count: 'exact', head: true })
                .eq('route', route)
                .eq('key_type', check.keyType)
                .eq('key_value', check.keyValue)
                .gte('created_at', windowStart);

            if ((count ?? 0) >= check.max) {
                const retryAfterSeconds = check.windowMinutes * 60;
                return NextResponse.json(
                    {
                        error: `Too many requests. Please wait ${check.windowMinutes} minute${check.windowMinutes === 1 ? '' : 's'} and try again.`,
                    },
                    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
                );
            }
        }

        await admin
            .from('rate_limit_events')
            .insert(checks.map((check) => ({ route, key_type: check.keyType, key_value: check.keyValue })));
    } catch {
        // Fail open: a tracking outage must never block a legitimate request.
        return null;
    }

    // Probabilistic cleanup — deletes rows older than 24h on ~5% of calls.
    // Fire-and-forget: never awaited, never blocks the caller's response.
    if (Math.random() < CLEANUP_PROBABILITY) {
        const cutoff = new Date(Date.now() - CLEANUP_AFTER_HOURS * 3600 * 1000).toISOString();
        Promise.resolve(admin.from('rate_limit_events').delete().lt('created_at', cutoff)).catch(() => {});
    }

    return null;
}
