import { createBrowserClient } from '@supabase/ssr';
import { SECURE_COOKIE_OPTIONS } from './cookieOptions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Warning for production build if env vars are missing
if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    console.warn('⚠️ Supabase environment variables are missing! Prerendering will use placeholders. Ensure secrets are added to Vercel/Production.');
}

// flowType 'implicit' (not the @supabase/ssr default of 'pkce'): password
// reset links are requested in one browser session but opened from an email
// client, which very often launches a *different* browser/webview with no
// access to the PKCE code_verifier stored by the requesting session —
// exchangeCodeForSession then fails with a generic "invalid or expired"
// error even on a perfectly valid, freshly-clicked link. Implicit flow has
// Supabase verify the recovery token server-side and hand back a session
// directly, so it works regardless of which browser/device opens the link.
// Nothing else in this app relies on PKCE (no OAuth/magic-link sign-in), so
// this is safe to set globally.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'implicit' },
    cookieOptions: SECURE_COOKIE_OPTIONS,
});
