'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, MailCheck, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            // Don't reveal whether the email exists — only surface real failures
            // (e.g. rate limiting). A missing account still returns success.
            if (error && /rate|too many/i.test(error.message)) {
                setError('Too many attempts. Please wait a few minutes and try again.');
                return;
            }
            setSent(true);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rp-root">
            <div className="rp-card">
                <div className="rp-logo-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Aspee Pharma" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                </div>

                {sent ? (
                    <>
                        <div className="rp-icon-badge">
                            <MailCheck size={26} />
                        </div>
                        <h2 className="rp-title">Check your email</h2>
                        <p className="rp-subtitle">
                            If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent a link to
                            reset your password. The link expires in 1 hour.
                        </p>
                        <p className="rp-hint">
                            Didn&apos;t get it? Check your spam folder, or{' '}
                            <button type="button" className="rp-linkbtn" onClick={() => { setSent(false); }}>
                                try a different email
                            </button>.
                        </p>
                        <Link href="/login" className="rp-back">
                            <ArrowLeft size={15} /> Back to sign in
                        </Link>
                    </>
                ) : (
                    <>
                        <h2 className="rp-title">Reset your password</h2>
                        <p className="rp-subtitle">
                            Enter the email address for your account and we&apos;ll send you a link to set a new password.
                        </p>

                        {error && (
                            <div className="rp-error">
                                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate>
                            <div className="rp-field">
                                <label className="rp-label">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="name@aspeepharma.com"
                                    className="rp-input"
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>

                            <button type="submit" disabled={loading} className="rp-submit">
                                {loading
                                    ? <><Loader2 size={18} className="rp-spin" /> Sending link...</>
                                    : 'Send reset link'}
                            </button>
                        </form>

                        <Link href="/login" className="rp-back">
                            <ArrowLeft size={15} /> Back to sign in
                        </Link>
                    </>
                )}
            </div>

            <ResetStyles />
        </div>
    );
}

export function ResetStyles() {
    return (
        <style>{`
            .rp-root {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: radial-gradient(1200px 600px at 50% -10%, #ecfeff 0%, #f8fafc 55%);
            }
            .dark .rp-root { background: radial-gradient(1200px 600px at 50% -10%, #0b1620 0%, #0f172a 55%); }
            .rp-card {
                width: 100%;
                max-width: 420px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                padding: 36px 32px;
                box-shadow: 0 12px 40px rgba(15,23,42,0.08);
                text-align: center;
            }
            .dark .rp-card { background: #1e1e1e; border-color: #333; }
            .rp-logo-wrap {
                width: 64px; height: 64px; margin: 0 auto 20px;
                display: flex; align-items: center; justify-content: center;
                background: #ecfeff; border-radius: 16px;
            }
            .dark .rp-logo-wrap { background: #0b1620; }
            .rp-icon-badge {
                width: 56px; height: 56px; margin: 0 auto 16px;
                display: flex; align-items: center; justify-content: center;
                background: #ecfdf5; color: #0d9488; border-radius: 50%;
            }
            .rp-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 8px; letter-spacing: -0.02em; }
            .dark .rp-title { color: #f1f5f9; }
            .rp-subtitle { font-size: 13.5px; color: #64748b; line-height: 1.55; margin: 0 0 24px; }
            .dark .rp-subtitle { color: #94a3b8; }
            .rp-hint { font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px; }
            .rp-field { text-align: left; margin-bottom: 20px; }
            .rp-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 7px; }
            .dark .rp-label { color: #cbd5e1; }
            .rp-input {
                width: 100%; padding: 12px 14px; border-radius: 10px;
                border: 1px solid #e2e8f0; font-size: 14px; font-family: inherit;
                color: #0f172a; background: #fff; outline: none; box-sizing: border-box;
                transition: border-color 0.15s, box-shadow 0.15s;
            }
            .rp-input::placeholder { color: #94a3b8; }
            .rp-input:focus { border-color: #0891b2; box-shadow: 0 0 0 3px rgba(8,145,178,0.12); }
            .dark .rp-input { background: #262626; border-color: #404040; color: #f1f5f9; }
            .rp-input-wrap { position: relative; }
            .rp-eye-btn {
                position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                background: transparent; border: none; cursor: pointer; color: #94a3b8;
                display: flex; align-items: center; padding: 4px; border-radius: 6px;
            }
            .rp-eye-btn:hover { color: #64748b; background: #f1f5f9; }
            .rp-submit {
                width: 100%; padding: 13px; border-radius: 10px; border: none;
                background: linear-gradient(135deg, #0891b2, #0d9488); color: #fff;
                font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 10px;
                box-shadow: 0 4px 20px rgba(8,145,178,0.3);
                transition: opacity 0.2s, transform 0.15s;
            }
            .rp-submit:hover:not(:disabled) { transform: translateY(-1px); }
            .rp-submit:disabled { opacity: 0.65; cursor: not-allowed; }
            .rp-error {
                display: flex; align-items: center; gap: 8px; text-align: left;
                background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
                padding: 11px 13px; border-radius: 10px; font-size: 13px; margin-bottom: 18px;
            }
            .rp-success {
                display: flex; align-items: center; gap: 8px; text-align: left;
                background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
                padding: 11px 13px; border-radius: 10px; font-size: 13px; margin-bottom: 18px;
            }
            .rp-back {
                display: inline-flex; align-items: center; gap: 6px; margin-top: 22px;
                font-size: 13px; font-weight: 600; color: #0891b2; text-decoration: none;
            }
            .rp-back:hover { color: #0e7490; }
            .rp-linkbtn {
                background: none; border: none; padding: 0; color: #0891b2;
                font-weight: 600; font-size: inherit; cursor: pointer; text-decoration: underline;
            }
            .rp-spin { animation: rp-spin 0.8s linear infinite; }
            @keyframes rp-spin { to { transform: rotate(360deg); } }
        `}</style>
    );
}
