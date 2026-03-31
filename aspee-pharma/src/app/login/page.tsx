'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;
            router.push('/overview');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lp-root">

            {/* ── Left branding panel ── */}
            <aside className="lp-panel">
                <div className="lp-panel-decor-1" />
                <div className="lp-panel-decor-2" />

                <div className="lp-panel-inner">
                    {/* Logo */}
                    <div className="lp-logo-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo.png"
                            alt="Aspee Pharma Logo"
                            style={{ width: 56, height: 56, objectFit: 'contain', display: 'block' }}
                        />
                    </div>

                    <h1 className="lp-brand-name">Aspee Pharmaceuticals</h1>
                    <p className="lp-brand-tag">Factory Management System</p>

                    <div className="lp-divider" />

                    <p className="lp-quote">
                        "Empowering precision and efficiency in every step of our manufacturing process."
                    </p>

                    <div className="lp-pills">
                        {['Inventory Control', 'Production Tracking', 'Quality Assurance', 'Financial Reports'].map(f => (
                            <span key={f} className="lp-pill">{f}</span>
                        ))}
                    </div>
                </div>

                <p className="lp-panel-footer">&copy; 2026 Aspee Pharmaceuticals Limited</p>
            </aside>

            {/* ── Right form side ── */}
            <main className="lp-form-side">
                <div className="lp-form-card">

                    {/* Mobile-only logo header */}
                    <div className="lp-mobile-header">
                        <div className="lp-mobile-logo-wrap">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
                        </div>
                        <div>
                            <div className="lp-mobile-brand">Aspee Pharmaceuticals</div>
                            <div className="lp-mobile-sub">Factory Management System</div>
                        </div>
                    </div>

                    <h2 className="lp-title">Welcome back</h2>
                    <p className="lp-subtitle">Sign in to your account to continue</p>

                    {error && (
                        <div className="lp-error">
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSignIn} noValidate>
                        {/* Email */}
                        <div className="lp-field">
                            <label className="lp-label">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@aspeepharma.com"
                                className="lp-input"
                                autoComplete="email"
                            />
                        </div>

                        {/* Password */}
                        <div className="lp-field">
                            <label className="lp-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="lp-input lp-input-pw"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="lp-eye-btn"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember / Forgot */}
                        <div className="lp-meta-row">
                            <label className="lp-remember">
                                <input type="checkbox" className="lp-checkbox" />
                                Remember me
                            </label>
                            <a href="#" className="lp-forgot">Forgot password?</a>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loading} className="lp-submit">
                            {loading
                                ? <><Loader2 size={18} className="lp-spin" /> Signing in...</>
                                : 'Sign In'
                            }
                        </button>

                        {/* Notice */}
                        <div className="lp-notice">
                            <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                            <p>
                                Access is by invitation only.{' '}
                                <strong>Contact your system administrator</strong>{' '}
                                to request an account.
                            </p>
                        </div>
                    </form>
                </div>

                <p className="lp-form-footer">&copy; 2026 Aspee Pharmaceuticals. Precision Driven.</p>
            </main>

            {/* ── Styles ── */}
            <style>{`

                /* ─── Layout ─────────────────────────────────── */
                .lp-root {
                    min-height: 100vh;
                    display: flex;
                    background: var(--background);
                }

                /* ─── Left Panel ──────────────────────────────── */
                .lp-panel {
                    width: 420px;
                    flex-shrink: 0;
                    background: linear-gradient(150deg, #0c4a6e 0%, #0891b2 45%, #0d9488 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 48px 40px;
                    position: relative;
                    overflow: hidden;
                }

                .lp-panel-decor-1 {
                    position: absolute;
                    bottom: -100px;
                    right: -100px;
                    width: 360px;
                    height: 360px;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.07);
                    pointer-events: none;
                }

                .lp-panel-decor-2 {
                    position: absolute;
                    top: -60px;
                    left: -60px;
                    width: 240px;
                    height: 240px;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.05);
                    pointer-events: none;
                }

                .lp-panel-inner {
                    position: relative;
                    z-index: 1;
                }

                .lp-logo-wrap {
                    width: 88px;
                    height: 88px;
                    background: #ffffff;
                    border-radius: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 14px;
                    margin-bottom: 28px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15);
                    overflow: visible;
                    flex-shrink: 0;
                }

                .lp-brand-name {
                    font-size: 24px;
                    font-weight: 800;
                    color: #ffffff;
                    letter-spacing: -0.03em;
                    line-height: 1.2;
                    margin-bottom: 6px;
                }

                .lp-brand-tag {
                    font-size: 11px;
                    color: rgba(255,255,255,0.65);
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .lp-divider {
                    width: 36px;
                    height: 2px;
                    background: rgba(255,255,255,0.25);
                    margin: 28px 0;
                    border-radius: 2px;
                }

                .lp-quote {
                    font-size: 15px;
                    color: rgba(255,255,255,0.8);
                    line-height: 1.75;
                    font-style: italic;
                    margin-bottom: 28px;
                }

                .lp-pills {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .lp-pill {
                    padding: 5px 12px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 20px;
                    font-size: 11px;
                    color: rgba(255,255,255,0.88);
                    font-weight: 500;
                    backdrop-filter: blur(6px);
                }

                .lp-panel-footer {
                    font-size: 11px;
                    color: rgba(255,255,255,0.35);
                    position: relative;
                    z-index: 1;
                }

                /* ─── Right Form Side ─────────────────────────── */
                .lp-form-side {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 24px;
                    gap: 24px;
                }

                .lp-form-card {
                    width: 100%;
                    max-width: 400px;
                }

                /* Mobile header (hidden on desktop) */
                .lp-mobile-header {
                    display: none;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 32px;
                }

                .lp-mobile-logo-wrap {
                    width: 52px;
                    height: 52px;
                    background: #ffffff;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 4px 14px rgba(8,145,178,0.25);
                    padding: 8px;
                    overflow: visible;
                }

                .lp-mobile-brand {
                    font-size: 14px;
                    font-weight: 800;
                    color: var(--slate-900);
                    letter-spacing: -0.02em;
                }

                .lp-mobile-sub {
                    font-size: 11px;
                    color: var(--slate-500);
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-top: 2px;
                }

                /* Typography */
                .lp-title {
                    font-size: 28px;
                    font-weight: 800;
                    color: var(--slate-900);
                    letter-spacing: -0.03em;
                    margin-bottom: 6px;
                }

                .lp-subtitle {
                    font-size: 14px;
                    color: var(--slate-500);
                    margin-bottom: 28px;
                    line-height: 1.5;
                }

                /* Error */
                .lp-error {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 14px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 10px;
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 20px;
                    line-height: 1.4;
                }

                .dark .lp-error {
                    background: rgba(220,38,38,0.1);
                    border-color: rgba(220,38,38,0.25);
                    color: #fca5a5;
                }

                /* Field */
                .lp-field {
                    margin-bottom: 18px;
                }

                .lp-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--slate-700);
                    margin-bottom: 7px;
                }

                /* Input — explicit light values, dark overrides via .dark */
                .lp-input {
                    width: 100%;
                    padding: 13px 16px;
                    border-radius: 10px;
                    border: 1.5px solid #e2e8f0;
                    background: #f8fafc;
                    color: #0f172a;
                    font-size: 14px;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                    box-sizing: border-box;
                }

                .lp-input::placeholder { color: #94a3b8; }

                .lp-input:focus {
                    border-color: #0891b2;
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(8,145,178,0.12);
                }

                .lp-input-pw { padding-right: 48px; }

                /* Dark mode inputs */
                .dark .lp-input {
                    background: #2a2a2a;
                    border-color: #3a3a3a;
                    color: #f5f5f5;
                }

                .dark .lp-input::placeholder { color: #5a5a5a; }

                .dark .lp-input:focus {
                    border-color: #22d3ee;
                    background: #333333;
                    box-shadow: 0 0 0 3px rgba(34,211,238,0.1);
                }

                /* Eye button */
                .lp-eye-btn {
                    position: absolute;
                    right: 13px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    padding: 4px;
                    border-radius: 6px;
                    transition: color 0.15s, background 0.15s;
                }

                .lp-eye-btn:hover { color: #64748b; background: #f1f5f9; }
                .dark .lp-eye-btn { color: #525252; }
                .dark .lp-eye-btn:hover { color: #a3a3a3; background: #3a3a3a; }

                /* Remember / forgot row */
                .lp-meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .lp-remember {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: var(--slate-600);
                    cursor: pointer;
                    font-weight: 500;
                    user-select: none;
                }

                .lp-checkbox {
                    width: 16px;
                    height: 16px;
                    accent-color: #0891b2;
                    cursor: pointer;
                }

                .lp-forgot {
                    font-size: 13px;
                    color: #0891b2;
                    text-decoration: none;
                    font-weight: 600;
                    transition: color 0.15s;
                }

                .lp-forgot:hover { color: #0e7490; }
                .dark .lp-forgot { color: #22d3ee; }
                .dark .lp-forgot:hover { color: #67e8f9; }

                /* Submit button */
                .lp-submit {
                    width: 100%;
                    padding: 14px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, #0891b2, #0d9488);
                    color: white;
                    font-size: 14px;
                    font-weight: 700;
                    font-family: inherit;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s;
                    box-shadow: 0 4px 20px rgba(8,145,178,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 20px;
                    letter-spacing: 0.01em;
                }

                .lp-submit:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 28px rgba(8,145,178,0.38);
                }

                .lp-submit:active:not(:disabled) { transform: translateY(0); }
                .lp-submit:disabled { opacity: 0.65; cursor: not-allowed; }

                /* Notice */
                .lp-notice {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 12px 14px;
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 10px;
                    color: #0369a1;
                    font-size: 12px;
                    line-height: 1.6;
                }

                .lp-notice p { margin: 0; }

                .dark .lp-notice {
                    background: rgba(8,145,178,0.08);
                    border-color: rgba(34,211,238,0.2);
                    color: #67e8f9;
                }

                /* Footer below card */
                .lp-form-footer {
                    font-size: 11px;
                    color: var(--slate-400);
                    text-align: center;
                    font-weight: 500;
                }

                /* Spinner */
                .lp-spin { animation: lpSpin 0.75s linear infinite; }

                @keyframes lpSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }

                /* ─── Responsive ──────────────────────────────── */
                @media (max-width: 860px) {
                    .lp-panel { display: none; }
                    .lp-mobile-header { display: flex; }
                    .lp-form-side { justify-content: flex-start; padding-top: 60px; }
                }
            `}</style>
        </div>
    );
}
