// Shared cookie security policy for every Supabase server client in the
// app (middleware, API routes). @supabase/ssr's own DEFAULT_COOKIE_OPTIONS
// sets sameSite: 'lax' but never sets `secure` at all, so without this the
// session cookie isn't guaranteed to carry the Secure flag. Kept in its
// own file (no imports) so it's safe to use from Edge middleware too.
//
// secure is gated on production so local `next dev` over plain HTTP still
// works — browsers silently drop Secure cookies over non-HTTPS connections.
// Vercel production and preview deployments are always HTTPS, and both run
// with NODE_ENV=production, so this is 'secure everywhere it matters'.
//
// httpOnly is deliberately left at the library default (false): the app's
// browser-side Supabase client (src/lib/supabase.ts, used on nearly every
// page) reads the session out of these cookies via JS to authorize its own
// requests. Making them httpOnly would break that everywhere at once.
export const SECURE_COOKIE_OPTIONS = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
};
