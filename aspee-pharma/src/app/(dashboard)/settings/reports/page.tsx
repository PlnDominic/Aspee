'use client';

import React, { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Save, Send, Mail, Users, Info, CheckCircle2, Server } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ReportSettingsPage() {
    const [mdEmail, setMdEmail] = useState('');
    const [ccEmails, setCcEmails] = useState('');
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('system_settings')
                .select('key, value')
                .in('key', ['report_md_email', 'report_cc_emails']);
            if (data) {
                data.forEach((row: any) => {
                    if (row.key === 'report_md_email') setMdEmail(row.value || '');
                    if (row.key === 'report_cc_emails') setCcEmails(row.value || '');
                });
            }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        if (!mdEmail) {
            toast.error('Managing Director email is required');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert(
                    [
                        { key: 'report_md_email', value: mdEmail, updated_at: new Date().toISOString() },
                        { key: 'report_cc_emails', value: ccEmails, updated_at: new Date().toISOString() },
                    ],
                    { onConflict: 'key' }
                );
            if (error) throw error;
            toast.success('Report settings saved');
        } catch (err: any) {
            toast.error('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSendNow = async () => {
        if (!mdEmail) {
            toast.error('Save the MD email first before sending');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/weekly-report', { method: 'POST' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success('Weekly report sent successfully!');
        } catch (err: any) {
            toast.error('Failed to send: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    const envVars = [
        { name: 'SUPABASE_SERVICE_ROLE_KEY', example: 'eyJhbGci...', desc: 'Found in Supabase → Project Settings → API. Required to create auth users.' },
        { name: 'SMTP_HOST', example: 'smtp.gmail.com', desc: 'SMTP server hostname' },
        { name: 'SMTP_PORT', example: '587', desc: 'Usually 587 (TLS) or 465 (SSL)' },
        { name: 'SMTP_USER', example: 'yourapp@gmail.com', desc: 'Sender email address' },
        { name: 'SMTP_PASS', example: 'xxxx xxxx xxxx xxxx', desc: 'Gmail App Password (not your regular password)' },
        { name: 'SMTP_FROM_NAME', example: 'Aspee Pharma System', desc: 'Display name shown to recipient' },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Report Settings"
                subtitle="Configure weekly automated summaries and department submissions sent to the Managing Director"
                breadcrumbs={[
                    { label: 'Settings', href: '/settings/reports' },
                    { label: 'Report Settings' },
                ]}
                actions={
                    <button
                        onClick={handleSendNow}
                        disabled={sending || !mdEmail}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: sending || !mdEmail
                                ? 'var(--slate-200)'
                                : 'linear-gradient(135deg, var(--accent-600, #0d9488), var(--accent-500, #14b8a6))',
                            fontSize: 13, fontWeight: 600,
                            color: sending || !mdEmail ? 'var(--slate-400)' : 'white',
                            cursor: sending || !mdEmail ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Send size={15} />
                        {sending ? 'Sending...' : 'Send Report Now'}
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                {/* ── Recipients ── */}
                <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Mail size={18} color="var(--primary-600)" />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Report Recipients</h3>
                    </div>

                    {loading ? (
                        <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>Loading...</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--slate-700)', marginBottom: 6 }}>
                                    Managing Director Email <span style={{ color: 'var(--danger)' }}>*</span>
                                </label>
                                <input
                                    type="email"
                                    value={mdEmail}
                                    onChange={e => setMdEmail(e.target.value)}
                                    placeholder="md@aspeepharma.com"
                                    style={inputStyle}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--slate-200)')}
                                />
                                <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 5 }}>
                                    The weekly report will be sent to this address every Friday at 5:00 PM.
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--slate-700)', marginBottom: 6 }}>
                                    CC Recipients <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--slate-400)' }}>(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={ccEmails}
                                    onChange={e => setCcEmails(e.target.value)}
                                    placeholder="gm@aspeepharma.com, cfo@aspeepharma.com"
                                    style={inputStyle}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--slate-200)')}
                                />
                                <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 5 }}>
                                    Separate multiple emails with commas.
                                </p>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 20px', borderRadius: 8, border: 'none',
                                    background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                    fontSize: 13, fontWeight: 600, color: 'white',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    width: 'fit-content', opacity: saving ? 0.7 : 1,
                                }}
                            >
                                <Save size={15} />
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    )}
                </div>

                {/* ── What's in the report ── */}
                <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Users size={18} color="var(--primary-600)" />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>What's Included</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            { icon: '📝', dept: 'Department submissions', items: 'Executive summary, achievements, challenges, and next week plan from each department' },
                            { icon: '🧾', dept: 'Sales', items: 'Revenue, invoices raised, outstanding balances, customer count' },
                            { icon: '🛒', dept: 'Purchasing', items: 'New POs, GRNs received, pending orders & values' },
                            { icon: '🏭', dept: 'Stores', items: 'Total products, low stock alerts, stock transfers' },
                            { icon: '⚙️', dept: 'Production', items: 'Job orders created/completed, active jobs, material requests' },
                            { icon: '🔬', dept: 'Quality Assurance', items: 'Checks performed, pass rates, batches released' },
                            { icon: '💰', dept: 'Accounting', items: 'Expenses, payroll processed, supplier payments' },
                        ].map(({ icon, dept, items }) => (
                            <div key={dept} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--slate-50)', border: '1px solid var(--slate-100)' }}>
                                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                                <div>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>{dept}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--slate-500)' }}>{items}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── SMTP Configuration ── */}
                <div style={{ gridColumn: '1 / -1', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <Server size={18} color="var(--primary-600)" />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Email Server Configuration</h3>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 20, marginTop: 4 }}>
                        These must be set as Environment Variables in your Vercel project dashboard (<code style={{ background: 'var(--slate-100)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>vercel.com → Project → Settings → Environment Variables</code>).
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                        {envVars.map(({ name, example, desc }) => (
                            <div key={name} style={{ padding: '14px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700, #0369a1)', background: 'var(--primary-50, #e0f2fe)', padding: '2px 8px', borderRadius: 4 }}>{name}</code>
                                </div>
                                <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--slate-600)' }}>{desc}</p>
                                <p style={{ margin: 0, fontSize: 11, color: 'var(--slate-400)', fontFamily: 'monospace' }}>e.g. {example}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 20, padding: '14px 16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8 }}>
                        <Info size={16} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                            <strong>Using Gmail?</strong> You must generate an <strong>App Password</strong> — not your regular Gmail password.
                            Go to <strong>myaccount.google.com → Security → 2-Step Verification → App Passwords</strong> and create one for "Mail".
                        </p>
                    </div>
                </div>

                {/* ── Schedule Info ── */}
                <div style={{ gridColumn: '1 / -1', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary-100, #cffafe), var(--primary-50, #ecfeff))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle2 size={24} color="var(--primary-600)" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Automated Schedule Active</p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--slate-500)' }}>
                            The management summary runs automatically every <strong>Friday at 5:00 PM</strong>. Departments can also submit their own weekly reports at any time from the <strong>Weekly Reports</strong> page, and you can still trigger the automated summary manually using the <strong>"Send Report Now"</strong> button above.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1.5px solid var(--slate-200)',
    fontSize: 13,
    color: 'var(--slate-800)',
    background: 'var(--card-bg)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
};
