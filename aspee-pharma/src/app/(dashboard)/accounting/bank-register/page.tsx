'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import { useFetch } from '@/lib/hooks';
import { exportToCsv } from '@/lib/csvExport';
import {
    Download, Landmark, ArrowDownCircle, ArrowUpCircle, Wallet,
    Calendar, ExternalLink,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface JournalEntry {
    entry_number: string;
    date: string;
    description: string;
    ref_type: string;
    debit_account: string;
    debit_amount: number;
    credit_account: string;
    credit_amount: number;
    notes?: string;
    counterparty_name?: string | null;
}

interface Account {
    code: string;
    name: string;
    type: string;
    subtype: string;
}

interface RegisterLine {
    date: string;
    entry_number: string;
    description: string;
    ref_type: string;
    correspondingAccount: string;
    party: string;
    dr: number;   // money into this account
    cr: number;   // money out of this account
    runningBalance: number;
}

// An account is a "bank / cash" account if its subtype or name says so.
function isCashAccount(a: Account): boolean {
    const s = `${a.subtype || ''} ${a.name || ''}`.toLowerCase();
    return a.type === 'Asset' && (s.includes('cash') || s.includes('bank') || s.includes('petty'));
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function BankRegisterPage() {
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const { data, isLoading: loading } = useFetch<{ entries: JournalEntry[]; accounts: Account[] }>(
        ['bank_register'],
        async () => {
            const [journalRes, coaRes] = await Promise.all([
                // select * so the page works whether or not the counterparty
                // migration has been applied yet (missing column → undefined).
                supabase
                    .from('journal_entries')
                    .select('*')
                    .order('date', { ascending: true }),
                supabase
                    .from('chart_of_accounts')
                    .select('code, name, type, subtype')
                    .order('code'),
            ]);
            if (journalRes.error) return { data: null, error: journalRes.error };
            if (coaRes.error) return { data: null, error: coaRes.error };
            return { data: { entries: journalRes.data || [], accounts: coaRes.data || [] }, error: null };
        }
    );

    // Candidate cash/bank accounts — from the COA, but only those actually used in
    // journal entries so the dropdown never lists a dead account.
    const bankAccounts = useMemo((): Account[] => {
        if (!data) return [];
        const usedNames = new Set<string>();
        data.entries.forEach(e => {
            if (e.debit_account) usedNames.add(e.debit_account);
            if (e.credit_account) usedNames.add(e.credit_account);
        });
        const fromCoa = data.accounts.filter(a => isCashAccount(a) && usedNames.has(a.name));
        // Include cash/bank-looking names that appear in the ledger but not in the COA.
        const known = new Set(fromCoa.map(a => a.name));
        const extra: Account[] = [];
        usedNames.forEach(name => {
            const n = name.toLowerCase();
            if (!known.has(name) && (n.includes('bank') || n.includes('cash') || n.includes('petty'))) {
                extra.push({ code: '????', name, type: 'Asset', subtype: 'Current Asset - Cash' });
            }
        });
        return [...fromCoa, ...extra].sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
    }, [data]);

    // Default the selector to 'Cash at Bank' if present, else the first candidate.
    useEffect(() => {
        if (selectedAccount || bankAccounts.length === 0) return;
        const preferred = bankAccounts.find(a => /cash at bank|bank account/i.test(a.name)) || bankAccounts[0];
        setSelectedAccount(preferred.name);
    }, [bankAccounts, selectedAccount]);

    // ── Build the register for the selected account ────────────────────────────
    const register = useMemo(() => {
        if (!data || !selectedAccount) {
            return { opening: 0, lines: [] as RegisterLine[], totalIn: 0, totalOut: 0, closing: 0 };
        }

        // Every entry touching this account, in date order.
        const touching = data.entries
            .filter(e => e.debit_account === selectedAccount || e.credit_account === selectedAccount)
            .slice()
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        // Opening balance = net movement strictly before the period start.
        let opening = 0;
        for (const e of touching) {
            if ((e.date || '') >= startDate) continue;
            if (e.debit_account === selectedAccount) opening += Number(e.debit_amount) || 0;
            if (e.credit_account === selectedAccount) opening -= Number(e.credit_amount) || 0;
        }

        let running = opening;
        let totalIn = 0, totalOut = 0;
        const lines: RegisterLine[] = [];
        for (const e of touching) {
            if ((e.date || '') < startDate || (e.date || '') > endDate) continue;
            const isDebit = e.debit_account === selectedAccount;
            const dr = isDebit ? Number(e.debit_amount) || 0 : 0;
            const cr = !isDebit ? Number(e.credit_amount) || 0 : 0;
            running += dr - cr;
            totalIn += dr;
            totalOut += cr;
            lines.push({
                date: e.date,
                entry_number: e.entry_number,
                description: e.description,
                ref_type: e.ref_type,
                correspondingAccount: isDebit ? e.credit_account : e.debit_account,
                party: e.counterparty_name || '',
                dr,
                cr,
                runningBalance: running,
            });
        }

        return { opening, lines, totalIn, totalOut, closing: running };
    }, [data, selectedAccount, startDate, endDate]);

    const selectedMeta = bankAccounts.find(a => a.name === selectedAccount);

    const handleExport = () => {
        if (register.lines.length === 0) {
            toast.error('No transactions to export');
            return;
        }
        exportToCsv(
            `Bank_Register_${selectedAccount.replace(/\s+/g, '_')}_${startDate}_${endDate}.csv`,
            register.lines,
            [
                { header: 'Date', accessor: r => r.date },
                { header: 'Reference', accessor: r => r.entry_number },
                { header: 'Remarks', accessor: r => r.description },
                { header: 'Corresponding Account', accessor: r => r.correspondingAccount },
                { header: 'Customer/Vendor', accessor: r => r.party },
                { header: 'Dr (In)', accessor: r => r.dr || '' },
                { header: 'Cr (Out)', accessor: r => r.cr || '' },
                { header: 'Balance', accessor: r => r.runningBalance },
            ]
        );
        toast.success('Exported to CSV successfully');
    };

    const cols = '92px 1fr 150px 150px 82px 105px 105px 118px';

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Bank & Cash Register"
                subtitle="Per-account cash book — money in, money out, running balance, and the corresponding (contra) account for every line"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'Bank & Cash Register' },
                ]}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <select
                            value={selectedAccount}
                            onChange={e => setSelectedAccount(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none', background: 'var(--card-bg)', maxWidth: 260 }}
                        >
                            {bankAccounts.length === 0 && <option value="">No bank/cash accounts</option>}
                            {bankAccounts.map(a => (
                                <option key={a.name} value={a.name}>{a.code !== '????' ? `${a.code} — ` : ''}{a.name}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '6px 12px', borderRadius: 8 }}>
                            <Calendar size={14} color="var(--slate-400)" />
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }} />
                            <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>–</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }} />
                        </div>
                        <button
                            onClick={handleExport}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 500, color: 'var(--slate-700)', cursor: 'pointer' }}
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                }
            />

            {/* Cross-dept navigation links */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { label: 'General Ledger', href: '/accounting/ledger' },
                    { label: 'Journal Entries', href: '/accounting/journal' },
                    { label: 'A/R Ledger', href: '/accounting/ar-ledger' },
                    { label: 'A/P Ledger', href: '/accounting/ap-ledger' },
                    { label: 'Cash Flow', href: '/accounting/cash-flow' },
                ].map(l => (
                    <Link key={l.href} href={l.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={11} /> {l.label}
                    </Link>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Opening Balance" value={formatCurrency(register.opening)} icon={<Wallet size={20} />} color="purple" />
                <StatCard title="Total In (Dr)" value={formatCurrency(register.totalIn)} icon={<ArrowDownCircle size={20} />} color="green" />
                <StatCard title="Total Out (Cr)" value={formatCurrency(register.totalOut)} icon={<ArrowUpCircle size={20} />} color="red" />
                <StatCard title="Closing Balance" value={formatCurrency(register.closing)} icon={<Landmark size={20} />} color="blue" />
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading register…</div>
            ) : bankAccounts.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>No bank or cash accounts have any journal activity yet.</div>
            ) : (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Account header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--slate-100)' }}>
                        <Landmark size={18} color="var(--primary-600)" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--slate-800)' }}>{selectedAccount}</div>
                            {selectedMeta && <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{selectedMeta.code !== '????' ? `${selectedMeta.code} · ` : ''}{selectedMeta.subtype}</div>}
                        </div>
                    </div>

                    {/* Column headings */}
                    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '8px 20px', background: 'var(--slate-50)', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        <span>Date</span>
                        <span>Remarks</span>
                        <span>Corresponding Acct</span>
                        <span>Customer/Vendor</span>
                        <span>Ref</span>
                        <span style={{ textAlign: 'right' }}>Dr (In)</span>
                        <span style={{ textAlign: 'right' }}>Cr (Out)</span>
                        <span style={{ textAlign: 'right' }}>Balance</span>
                    </div>

                    {/* Opening balance row */}
                    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '10px 20px', borderTop: '1px solid var(--slate-50)', fontSize: 12, fontWeight: 700, background: 'var(--slate-50)', alignItems: 'center' }}>
                        <span style={{ color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{startDate}</span>
                        <span style={{ color: 'var(--slate-600)' }}>Opening balance</span>
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(register.opening)}</span>
                    </div>

                    {/* Transaction rows */}
                    {register.lines.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--slate-400)' }}>No transactions in this period.</div>
                    ) : register.lines.map((line, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'grid', gridTemplateColumns: cols, gap: 8,
                                padding: '9px 20px', borderTop: '1px solid var(--slate-50)', fontSize: 12,
                                background: idx % 2 === 0 ? 'transparent' : 'var(--slate-50)', alignItems: 'center',
                            }}
                        >
                            <span style={{ color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                {line.date ? new Date(line.date).toLocaleDateString('en-GB') : '-'}
                            </span>
                            <span style={{ color: 'var(--slate-700)' }}>{line.description}</span>
                            <span style={{ color: 'var(--slate-600)', fontWeight: 500 }}>{line.correspondingAccount || '—'}</span>
                            <span style={{ color: line.party ? 'var(--slate-700)' : 'var(--slate-300)' }}>{line.party || '—'}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--primary-600)' }}>{line.entry_number}</span>
                            <span style={{ textAlign: 'right', fontWeight: 600, color: line.dr > 0 ? '#15803d' : 'var(--slate-300)' }}>
                                {line.dr > 0 ? formatCurrency(line.dr) : '—'}
                            </span>
                            <span style={{ textAlign: 'right', fontWeight: 600, color: line.cr > 0 ? '#b91c1c' : 'var(--slate-300)' }}>
                                {line.cr > 0 ? formatCurrency(line.cr) : '—'}
                            </span>
                            <span style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, color: line.runningBalance < 0 ? '#b91c1c' : 'var(--slate-800)' }}>
                                {formatCurrency(line.runningBalance)}
                            </span>
                        </div>
                    ))}

                    {/* Totals footer */}
                    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '11px 20px', borderTop: '2px solid var(--slate-200)', background: 'var(--slate-50)', fontSize: 12, fontWeight: 800, alignItems: 'center' }}>
                        <span style={{ gridColumn: '1 / 6', color: 'var(--slate-700)' }}>PERIOD TOTALS &amp; CLOSING BALANCE</span>
                        <span style={{ textAlign: 'right', color: '#15803d' }}>{formatCurrency(register.totalIn)}</span>
                        <span style={{ textAlign: 'right', color: '#b91c1c' }}>{formatCurrency(register.totalOut)}</span>
                        <span style={{ textAlign: 'right', color: 'var(--slate-800)' }}>{formatCurrency(register.closing)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
