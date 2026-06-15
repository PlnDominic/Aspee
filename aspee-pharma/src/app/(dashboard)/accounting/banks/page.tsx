'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Landmark, Phone, MapPin, Hash, Building2, ExternalLink } from 'lucide-react';

interface Bank {
    id: number;
    name: string;
    shortName: string;
    accountNumber: string;
    branch: string;
    swiftCode: string;
    phone: string;
    color: string;
}

const BANKS: Bank[] = [
    {
        id: 1,
        name: 'Juaben Community Bank',
        shortName: 'JCB',
        accountNumber: '— — —',
        branch: 'Juaben',
        swiftCode: '—',
        phone: '—',
        color: '#16a34a',
    },
    {
        id: 2,
        name: 'GCB Bank',
        shortName: 'GCB',
        accountNumber: '— — —',
        branch: '—',
        swiftCode: 'GHCBGHAC',
        phone: '0302 680 680',
        color: '#dc2626',
    },
    {
        id: 3,
        name: 'CAL Bank',
        shortName: 'CAL',
        accountNumber: '— — —',
        branch: '—',
        swiftCode: 'CABLGHAC',
        phone: '0302 680 061',
        color: '#0369a1',
    },
    {
        id: 4,
        name: 'Zenith Bank',
        shortName: 'ZBL',
        accountNumber: '— — —',
        branch: '—',
        swiftCode: 'ZEBLGHAC',
        phone: '0302 611 500',
        color: '#7c3aed',
    },
    {
        id: 5,
        name: 'Fidelity Bank',
        shortName: 'FBL',
        accountNumber: '— — —',
        branch: '—',
        swiftCode: 'FBLIGHAC',
        phone: '0302 214 490',
        color: '#b45309',
    },
    {
        id: 6,
        name: 'Prudential Bank',
        shortName: 'PBL',
        accountNumber: '— — —',
        branch: '—',
        swiftCode: 'PRBLGHAC',
        phone: '0302 741 460',
        color: '#0f766e',
    },
];

export default function BanksPage() {
    const [search, setSearch] = useState('');

    const filtered = BANKS.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.shortName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ padding: 20 }}>
            <PageHeader
                title="Banks"
                subtitle={`${BANKS.length} banking partners`}
                actions={
                    <input
                        type="text"
                        placeholder="Search banks..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 8,
                            fontSize: 13,
                            outline: 'none',
                            width: 220,
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                        }}
                    />
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, marginTop: 8 }}>
                {filtered.map(bank => (
                    <div
                        key={bank.id}
                        style={{
                            background: 'var(--card-bg)',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 14,
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}
                    >
                        {/* Header stripe */}
                        <div style={{ height: 6, background: bank.color }} />

                        <div style={{ padding: '20px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                <div style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 12,
                                    background: bank.color + '18',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Landmark size={24} color={bank.color} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.2 }}>{bank.name}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: bank.color, marginTop: 3, letterSpacing: '0.06em' }}>{bank.shortName}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <InfoRow icon={<Hash size={13} />} label="Account No." value={bank.accountNumber} />
                                <InfoRow icon={<MapPin size={13} />} label="Branch" value={bank.branch} />
                                <InfoRow icon={<Building2 size={13} />} label="SWIFT / BIC" value={bank.swiftCode} />
                                <InfoRow icon={<Phone size={13} />} label="Phone" value={bank.phone} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-400)', fontSize: 13 }}>
                    No banks match your search.
                </div>
            )}
        </div>
    );
}

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--slate-400)', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 12, color: 'var(--slate-500)', width: 90, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
);
