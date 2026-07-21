'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, MailCheck, ArrowLeft } from 'lucide-react';
import { ResetPasswordStyles } from '@/components/ResetPasswordStyles';

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

            <ResetPasswordStyles />
        </div>
    );
}
