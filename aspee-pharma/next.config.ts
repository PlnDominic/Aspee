import type { NextConfig } from "next";

// next/font/google (used in app/layout.tsx) self-hosts font files at build
// time — no runtime request to fonts.googleapis.com/fonts.gstatic.com, so
// the CSP below doesn't need to allow those.
//
// 'unsafe-inline' is kept for script-src and style-src as a deliberately
// conservative starting point: this app relies on inline <style> blocks
// (the docStyles/transferDocStyles/etc. print-view pattern used throughout
// the *Modal.tsx components) and hasn't been set up with a nonce/hash
// pipeline. Tightening script-src further (nonce-based) is a good follow-up
// once this baseline is confirmed not to break anything — worth doing since
// 'unsafe-inline' on script-src is the one meaningful gap left here.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
