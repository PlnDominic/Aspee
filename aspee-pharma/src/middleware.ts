import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routePermissions } from '@/lib/routePermissions';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip auth check for landing page, login page, and API routes
    if (pathname === '/' || pathname === '/login' || pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
        // If logged-in user visits '/', send them straight to the dashboard
        if (pathname === '/') {
            const supabaseCheck = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll() { return request.cookies.getAll(); },
                        setAll() {},
                    },
                }
            );
            const { data: { user } } = await supabaseCheck.auth.getUser();
            if (user) {
                const url = request.nextUrl.clone();
                url.pathname = '/overview';
                return NextResponse.redirect(url);
            }
        }
        return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Not logged in -> redirect to login
    if (!user && pathname !== '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // If logged in, check role for specific routes
    if (user && pathname !== '/login' && pathname !== '/overview' && pathname !== '/') {
        // Fetch user role from system_users — match by email so the admin
        // only needs to enter the user's email in User Management (no UUID required).
        const { data: userData, error: roleError } = await supabase
            .from('system_users')
            .select('role')
            .eq('email', user.email)
            .single();

        const userRole = userData?.role;

        if (roleError || !userData) {
            const url = request.nextUrl.clone();
            url.pathname = '/overview';
            return NextResponse.redirect(url);
        }

        let hasAccess = false;

        // Find the matching base route
        const baseRoute = Object.keys(routePermissions).find(route => pathname.startsWith(route));

        if (!baseRoute) {
            // Unrestricted route
            hasAccess = true;
        } else {
            const allowedRoles = routePermissions[baseRoute];
            if (allowedRoles.includes('*') || (userRole && allowedRoles.includes(userRole))) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            // Redirect to overview (home) page
            const url = request.nextUrl.clone();
            url.pathname = '/overview';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)',
    ],
};
