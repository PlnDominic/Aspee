'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { ResetPasswordStyles } from '@/components/ResetPasswordStyles';

type Phase = 'verifying' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('verifying');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Establish the recovery session from whatever the email link delivered.
    // Supabase reset links come in a few shapes depending on project config —
    // handle each: a hash token (implicit, auto-detected by the client), a
    // ?code= (PKCE), or a ?token_hash=&type=recovery. Any working one leaves us
    // with a session; without one, the link is invalid or expired.
    useEffect(() => {
        let active = true;

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (active && session) setPhase('ready');
        });

        (async () => {
            const url = new URL(window.location.href);
            const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
            const linkError = url.searchParams.get('error_description') || hashParams.get('error_description');
            if (linkError) {
                if (active) { setPhase('invalid'); setError(decodeURIComponent(linkError)); }
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session) { if (active) setPhase('ready'); return; }

            const code = url.searchParams.get('code');
            const tokenHash = url.searchParams.get('token_hash');
            const type = url.searchParams.get('type');

            try {
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    if (active) setPhase('ready');
                    return;
                }
                if (tokenHash && type) {
                    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
                    if (error) throw error;
                    if (active) setPhase('ready');
                    return;
                }
            } catch {
                if (active) { setPhase('invalid'); setError('This reset link is invalid or has expired.'); }
                return;
            }

            // Hash-token (implicit) links are picked up asynchronously by the
            // client — give it a moment, then confirm a session actually landed.
            setTimeout(async () => {
                if (!active) return;
                const { data: { session: s } } = await supabase.auth.getSession();
                if (s) setPhase('ready');
                else { setPhase('invalid'); setError('This reset link is invalid or has expired.'); }
            }, 1800);
        })();

        return () => { active = false; sub.subscription.unsubscribe(); };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setPhase('done');
            // Clear the recovery session so they sign in fresh with the new password.
            await supabase.auth.signOut();
            setTimeout(() => router.push('/login'), 2500);
        } catch (err: any) {
            setError(err.message || 'Failed to update password. Please try again.');
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

                {phase === 'verifying' && (
                    <>
                        <h2 className="rp-title">Verifying link…</h2>
                        <p className="rp-subtitle">Hold on while we confirm your password reset link.</p>
                        <Loader2 size={26} className="rp-spin" style={{ color: '#0891b2', margin: '4px auto 0' }} />
                    </>
                )}

                {phase === 'invalid' && (
                    <>
                        <div className="rp-icon-badge" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                            <AlertCircle size={26} />
                        </div>
                        <h2 className="rp-title">Link invalid or expired</h2>
                        <p className="rp-subtitle">{error || 'This password reset link is no longer valid.'}</p>
                        <Link href="/forgot-password" className="rp-submit" style={{ textDecoration: 'none' }}>
                            Request a new link
                        </Link>
                        <Link href="/login" className="rp-back">
                            <ArrowLeft size={15} /> Back to sign in
                        </Link>
                    </>
                )}

                {phase === 'done' && (
                    <>
                        <div className="rp-icon-badge">
                            <ShieldCheck size={26} />
                        </div>
                        <h2 className="rp-title">Password updated</h2>
                        <p className="rp-subtitle">
                            Your password has been changed. Redirecting you to sign in…
                        </p>
                        <Link href="/login" className="rp-back">
                            <ArrowLeft size={15} /> Go to sign in now
                        </Link>
                    </>
                )}

                {phase === 'ready' && (
                    <>
                        <h2 className="rp-title">Set a new password</h2>
                        <p className="rp-subtitle">Choose a strong password you don&apos;t use elsewhere.</p>

                        {error && (
                            <div className="rp-error">
                                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate>
                            <div className="rp-field">
                                <label className="rp-label">New Password</label>
                                <div className="rp-input-wrap">
                                    <input
                                        type={show ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="At least 6 characters"
                                        className="rp-input"
                                        style={{ paddingRight: 44 }}
                                        autoComplete="new-password"
                                        autoFocus
                                    />
                                    <button type="button" className="rp-eye-btn" onClick={() => setShow(s => !s)} aria-label="Toggle password visibility">
                                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="rp-field">
                                <label className="rp-label">Confirm New Password</label>
                                <input
                                    type={show ? 'text' : 'password'}
                                    required
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Re-enter password"
                                    className="rp-input"
                                    autoComplete="new-password"
                                />
                            </div>

                            <button type="submit" disabled={loading} className="rp-submit">
                                {loading
                                    ? <><Loader2 size={18} className="rp-spin" /> Updating…</>
                                    : 'Update password'}
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
