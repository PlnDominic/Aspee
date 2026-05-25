import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type SystemUserRecord = {
    id: string;
    auth_user_id?: string | null;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    department?: string | null;
    status?: string | null;
};

export type AppUser = {
    authUser: {
        id: string;
        email?: string | null;
    };
    systemUser: SystemUserRecord;
};

function getSupabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

function getAnonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

function getServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY!;
}

export async function createAuthenticatedRouteClient() {
    const cookieStore = await cookies();

    return createServerClient(getSupabaseUrl(), getAnonKey(), {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Route handlers do not need session refresh writes.
                }
            },
        },
    });
}

export function createServiceRoleClient() {
    return createClient(getSupabaseUrl(), getServiceRoleKey(), {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
    const supabase = await createAuthenticatedRouteClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
        return null;
    }

    let systemUser: SystemUserRecord | null = null;

    const { data: byId } = await supabase
        .from('system_users')
        .select('id, auth_user_id, email, name, role, department, status')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    systemUser = byId as SystemUserRecord | null;

    if (!systemUser && user.email) {
        const { data: byEmail } = await supabase
            .from('system_users')
            .select('id, auth_user_id, email, name, role, department, status')
            .ilike('email', user.email)
            .maybeSingle();

        systemUser = byEmail as SystemUserRecord | null;
    }

    if (!systemUser) {
        return null;
    }

    return {
        authUser: { id: user.id, email: user.email },
        systemUser,
    };
}

export async function requireAuthenticatedUser() {
    const appUser = await getCurrentAppUser();

    if (!appUser) {
        return {
            appUser: null,
            error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
        };
    }

    if (appUser.systemUser.status && appUser.systemUser.status !== 'Active') {
        return {
            appUser: null,
            error: NextResponse.json({ error: 'Your account is inactive.' }, { status: 403 }),
        };
    }

    return { appUser, error: null };
}

export async function requireRoles(roles: readonly string[]) {
    const { appUser, error } = await requireAuthenticatedUser();
    if (error || !appUser) return { appUser: null, error };

    if (!roles.includes(appUser.systemUser.role || '')) {
        return {
            appUser: null,
            error: NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 }),
        };
    }

    return { appUser, error: null };
}

export function hasRole(appUser: AppUser, roles: readonly string[]) {
    return roles.includes(appUser.systemUser.role || '');
}

export function isAuthorizedCronRequest(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;

    const bearer = request.headers.get('authorization');
    const headerSecret = request.headers.get('x-cron-secret');

    return bearer === `Bearer ${secret}` || headerSecret === secret;
}
