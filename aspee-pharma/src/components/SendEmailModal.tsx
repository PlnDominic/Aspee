'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { Mail, Send, Users, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface SendEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: any[];
    preselectedUser?: any;
}

const emailTemplates = [
    { label: 'Custom Message', value: 'custom' },
    { label: 'Welcome to Aspee Pharma', value: 'welcome' },
    { label: 'Role Update Notification', value: 'role_update' },
    { label: 'Account Deactivation Notice', value: 'deactivation' },
    { label: 'General Announcement', value: 'announcement' },
];

const roleOptions = [
    'All Staff',
    'Super Admin',
    'Managing Director',
    'Sales Manager',
    'Store Manager',
    'Purchasing Manager',
    'Accountant',
    'Production Manager',
    'Van Sales Rep',
];

/* ─── Branding constants ──────────────────────────────────────────────── */
const LOGO_URL = 'https://aspee-pharma.vercel.app/logo.png';
const COMPANY_NAME = 'ASPEE PHARMACEUTICALS LTD';
const COMPANY_TAGLINE = 'Quality Healthcare for All';
const COMPANY_ADDRESS = 'Ejisu - Asamang';
const COMPANY_PHONE = '0244791052';
const COMPANY_EMAIL = 'aspeepharmaceuticalsgh@gmail.com';
const LOGIN_URL = 'https://aspee-pharma.vercel.app/login';

/* ─── Shared email building blocks ────────────────────────────────────── */
function emailHeader(bannerColor: string, title: string) {
    return `
    <div style="background:${bannerColor};padding:28px 36px;border-radius:16px 16px 0 0;text-align:center;">
        <img src="${LOGO_URL}" alt="Aspee Pharma" style="width:60px;height:60px;border-radius:12px;margin-bottom:12px;border:2px solid rgba(255,255,255,0.3);" />
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;">${title}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;font-style:italic;">${COMPANY_TAGLINE}</p>
    </div>`;
}

function emailFooter() {
    return `
    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:12px;color:#64748b;line-height:1.6;">
                <strong style="color:#334155;">${COMPANY_NAME}</strong><br/>
                📍 ${COMPANY_ADDRESS}<br/>
                📞 ${COMPANY_PHONE}<br/>
                ✉️ <a href="mailto:${COMPANY_EMAIL}" style="color:#0891b2;text-decoration:none;">${COMPANY_EMAIL}</a>
            </td>
        </tr></table>
    </div>
    <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">
            This email was sent from the Aspee Pharmaceuticals ERP System<br/>
            © ${new Date().getFullYear()} ${COMPANY_NAME} — All rights reserved
        </p>
    </div>`;
}

function wrapEmail(bannerColor: string, title: string, bodyContent: string) {
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        ${emailHeader(bannerColor, title)}
        <div style="padding:32px 36px;">
            ${bodyContent}
            ${emailFooter()}
        </div>
    </div>`;
}

/* ─── Templates ───────────────────────────────────────────────────────── */
function getTemplateContent(template: string, userName?: string): { subject: string; body: string } {
    switch (template) {
        case 'welcome':
            return {
                subject: 'Welcome to Aspee Pharmaceuticals',
                body: wrapEmail('linear-gradient(135deg,#0891b2,#0d9488)', 'Welcome to the Team', `
                    <p style="color:#334155;font-size:15px;margin:0 0 16px;">Dear <strong>${userName || '[Staff Name]'}</strong>,</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">Welcome to the <strong>Aspee Pharmaceuticals</strong> team! Your account has been created and you can now access the Factory Management System.</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 24px;">Please log in using your registered email address. If you have any questions, reach out to your department head or the IT team.</p>
                    <div style="text-align:center;margin-bottom:24px;">
                        <a href="${LOGIN_URL}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0891b2,#0d9488);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">Sign In to Your Account</a>
                    </div>
                    <p style="color:#64748b;font-size:14px;margin-top:20px;">Best regards,<br/><strong>Aspee Pharmaceuticals Management</strong></p>
                `)
            };
        case 'role_update':
            return {
                subject: 'Your Role Has Been Updated — Aspee Pharmaceuticals',
                body: wrapEmail('linear-gradient(135deg,#7c3aed,#8b5cf6)', 'Role Update', `
                    <p style="color:#334155;font-size:15px;margin:0 0 16px;">Dear <strong>${userName || '[Staff Name]'}</strong>,</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">This is to inform you that your role within the Aspee Pharmaceuticals system has been updated. Your access permissions have been adjusted accordingly.</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">If you believe this change was made in error, please contact the Administrator immediately.</p>
                    <p style="color:#64748b;font-size:14px;margin-top:20px;">Best regards,<br/><strong>Aspee Pharmaceuticals Management</strong></p>
                `)
            };
        case 'deactivation':
            return {
                subject: 'Account Deactivation Notice — Aspee Pharmaceuticals',
                body: wrapEmail('linear-gradient(135deg,#dc2626,#ef4444)', 'Account Notice', `
                    <p style="color:#334155;font-size:15px;margin:0 0 16px;">Dear <strong>${userName || '[Staff Name]'}</strong>,</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">This is to inform you that your account has been deactivated. You will no longer be able to access the Aspee Pharmaceuticals system.</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">If you have any questions or concerns, please contact the Human Resources department.</p>
                    <p style="color:#64748b;font-size:14px;margin-top:20px;">Best regards,<br/><strong>Aspee Pharmaceuticals Management</strong></p>
                `)
            };
        case 'announcement':
            return {
                subject: 'Announcement — Aspee Pharmaceuticals',
                body: wrapEmail('linear-gradient(135deg,#0891b2,#06b6d4)', 'Announcement', `
                    <p style="color:#334155;font-size:15px;margin:0 0 16px;">Dear Team,</p>
                    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">[Enter your announcement message here]</p>
                    <p style="color:#64748b;font-size:14px;margin-top:20px;">Best regards,<br/><strong>Aspee Pharmaceuticals Management</strong></p>
                `)
            };
        default:
            return { subject: '', body: '' };
    }
}

/* ─── Component ───────────────────────────────────────────────────────── */
export default function SendEmailModal({ isOpen, onClose, users, preselectedUser }: SendEmailModalProps) {
    const [sending, setSending] = useState(false);
    const [recipientMode, setRecipientMode] = useState<'individual' | 'role'>('individual');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState('All Staff');
    const [template, setTemplate] = useState('custom');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            if (preselectedUser) {
                setRecipientMode('individual');
                setSelectedUserIds([preselectedUser.id]);
            } else {
                setSelectedUserIds([]);
            }
            setTemplate('custom');
            setSubject('');
            setBody('');
            setSelectedRole('All Staff');
        }
    }, [isOpen, preselectedUser]);

    const handleTemplateChange = (tmpl: string) => {
        setTemplate(tmpl);
        if (tmpl !== 'custom') {
            const firstName = preselectedUser?.name?.split(' ')[0];
            const content = getTemplateContent(tmpl, firstName);
            setSubject(content.subject);
            setBody(content.body);
        }
    };

    const getRecipientEmails = (): string[] => {
        if (recipientMode === 'individual') {
            return users
                .filter(u => selectedUserIds.includes(u.id))
                .map(u => u.email)
                .filter(Boolean);
        } else {
            const filtered = selectedRole === 'All Staff'
                ? users.filter(u => u.status === 'Active')
                : users.filter(u => u.role === selectedRole && u.status === 'Active');
            return filtered.map(u => u.email).filter(Boolean);
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        const emails = getRecipientEmails();
        if (emails.length === 0) {
            toast.error('Please select at least one recipient');
            return;
        }
        if (!subject.trim()) {
            toast.error('Please enter a subject');
            return;
        }
        if (!body.trim()) {
            toast.error('Please enter a message body');
            return;
        }

        setSending(true);
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emails,
                    subject,
                    html: template === 'custom'
                        ? wrapEmail('linear-gradient(135deg,#2563eb,#3b82f6)', subject, `
                            <div style="color:#334155;font-size:14px;line-height:1.7;">
                                ${body.replace(/\n/g, '<br/>')}
                            </div>
                            <p style="color:#64748b;font-size:14px;margin-top:24px;">Best regards,<br/><strong>Aspee Pharmaceuticals Management</strong></p>
                        `)
                        : body,
                }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            toast.success(`Email sent to ${emails.length} recipient(s) successfully!`);
            onClose();
        } catch (error: any) {
            toast.error('Failed to send email: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    const recipientCount = getRecipientEmails().length;
    const activeUsers = users.filter(u => u.status === 'Active');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Send Email"
            subtitle="Compose and send emails to staff members"
            width={700}
        >
            <form onSubmit={handleSend}>
                {/* Recipient Mode Toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                    <button
                        type="button"
                        onClick={() => setRecipientMode('individual')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid',
                            borderColor: recipientMode === 'individual' ? 'var(--primary-500)' : 'var(--slate-200)',
                            background: recipientMode === 'individual' ? 'var(--primary-50)' : 'var(--card-bg)',
                            color: recipientMode === 'individual' ? 'var(--primary-700)' : 'var(--slate-600)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            fontFamily: 'inherit',
                        }}
                    >
                        <Mail size={14} /> Individual
                    </button>
                    <button
                        type="button"
                        onClick={() => setRecipientMode('role')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid',
                            borderColor: recipientMode === 'role' ? 'var(--primary-500)' : 'var(--slate-200)',
                            background: recipientMode === 'role' ? 'var(--primary-50)' : 'var(--card-bg)',
                            color: recipientMode === 'role' ? 'var(--primary-700)' : 'var(--slate-600)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            fontFamily: 'inherit',
                        }}
                    >
                        <Users size={14} /> By Role
                    </button>
                </div>

                {/* Recipients */}
                {recipientMode === 'individual' ? (
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 8 }}>
                            Select Recipients
                        </label>
                        <div style={{
                            maxHeight: 160, overflowY: 'auto', border: '1px solid var(--slate-200)',
                            borderRadius: 10, padding: 6, background: 'var(--card-bg)',
                        }}>
                            {activeUsers.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => toggleUser(user.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                                        borderRadius: 8, cursor: 'pointer',
                                        background: selectedUserIds.includes(user.id) ? 'var(--primary-50)' : 'transparent',
                                        border: selectedUserIds.includes(user.id) ? '1px solid var(--primary-200)' : '1px solid transparent',
                                        marginBottom: 2, transition: 'all 0.15s ease',
                                    }}
                                >
                                    <div style={{
                                        width: 18, height: 18, borderRadius: 4,
                                        border: selectedUserIds.includes(user.id) ? '2px solid var(--primary-500)' : '2px solid var(--slate-300)',
                                        background: selectedUserIds.includes(user.id) ? 'var(--primary-500)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0,
                                    }}>
                                        {selectedUserIds.includes(user.id) && '✓'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-800)' }}>{user.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--slate-500)' }}>{user.email} · {user.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 8 }}>
                            Send To Role
                        </label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: 10,
                                border: '1.5px solid var(--slate-200)', fontSize: 12, color: 'var(--slate-800)',
                                background: 'var(--card-bg)', outline: 'none', fontFamily: 'inherit',
                            }}
                        >
                            {roleOptions.map(role => (
                                <option key={role} value={role}>
                                    {role} ({role === 'All Staff' ? activeUsers.length : activeUsers.filter(u => u.role === role).length} users)
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Template Selector */}
                <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 8 }}>
                        Email Template
                    </label>
                    <select
                        value={template}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10,
                            border: '1.5px solid var(--slate-200)', fontSize: 12, color: 'var(--slate-800)',
                            background: 'var(--card-bg)', outline: 'none', fontFamily: 'inherit',
                        }}
                    >
                        {emailTemplates.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Subject */}
                <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 8 }}>
                        Subject <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        required
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Enter email subject..."
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10,
                            border: '1.5px solid var(--slate-200)', fontSize: 12, color: 'var(--slate-800)',
                            background: 'var(--card-bg)', outline: 'none', fontFamily: 'inherit',
                        }}
                    />
                </div>

                {/* Body */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 8 }}>
                        Message Body <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    {template === 'custom' ? (
                        <textarea
                            required
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write your email message here..."
                            rows={8}
                            style={{
                                width: '100%', padding: '14px', borderRadius: 10,
                                border: '1.5px solid var(--slate-200)', fontSize: 12, color: 'var(--slate-800)',
                                background: 'var(--card-bg)', outline: 'none', fontFamily: 'inherit',
                                resize: 'vertical', lineHeight: 1.6,
                            }}
                        />
                    ) : (
                        <div style={{
                            padding: 16, borderRadius: 10, border: '1px solid var(--slate-200)',
                            background: 'var(--slate-50)', fontSize: 12, color: 'var(--slate-600)',
                            maxHeight: 200, overflowY: 'auto',
                        }}>
                            <div dangerouslySetInnerHTML={{ __html: body }} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 16, borderTop: '1px solid var(--slate-100)',
                }}>
                    <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                        {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type="button" onClick={onClose}
                            style={{
                                padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--slate-200)',
                                background: 'var(--card-bg)', color: 'var(--slate-600)', fontSize: 12,
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit" disabled={sending || recipientCount === 0}
                            style={{
                                padding: '10px 28px', borderRadius: 10, border: 'none',
                                background: sending || recipientCount === 0
                                    ? 'var(--slate-300)'
                                    : 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                color: 'white', fontSize: 12, fontWeight: 600, cursor: sending || recipientCount === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8,
                                boxShadow: sending || recipientCount === 0 ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.3)',
                                fontFamily: 'inherit',
                            }}
                        >
                            <Send size={14} />
                            {sending ? 'Sending...' : 'Send Email'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
