'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { BookOpen, TrendingUp, TrendingDown, Scale, ChevronDown, ChevronRight, ExternalLink, Calendar } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface JournalEntry {
    id: string;
    entry_number: string;
    date: string;
    description: string;
    ref_type: string;
    debit_account: string;
    debit_amount: number;
    credit_account: string;
    credit_amount: number;
    notes?: string;
    created_by: string;
}

interface AccountBalance {
    name: string;
    type: string;
    subtype: string;
    code: string;
    totalDebit: number;
    totalCredit: number;
    balance: number;      // debit - credit (natural balance direction varies by type)
    entries: LedgerLine[];
}

interface LedgerLine {
    date: string;
    entry_number: string;
    description: string;
    ref_type: string;
    debit: number;
    credit: number;
    runningBalance: number;
    notes?: string;
}

// For account types: Assets & Expenses carry a DEBIT normal balance.
//                    Liabilities, Equity & Revenue carry a CREDIT normal balance.
function normalBalance(type: string, debit: number, credit: number): number {
    if (type === 'Asset' || type === 'Expense') return debit - credit;
    return credit - debit;
}

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    Asset:     { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    Liability: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    Equity:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    Revenue:   { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
    Expense:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

const REF_COLORS: Record<string, string> = {
    Sales:      '#15803d',
    Purchase:   '#a16207',
    Manual:     '#0369a1',
    Expense:    '#b91c1c',
    Payroll:    '#7c3aed',
    Adjustment: '#c2410c',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function GeneralLedgerPage() {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [accounts, setAccounts] = useState<{ code: string; name: string; type: string; subtype: string }[]>([]);
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState<string>('All');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [journalRes, coaRes] = await Promise.all([
                supabase
                    .from('journal_entries')
                    .select('*')
                    .gte('date', startDate)
                    .lte('date', endDate)
                    .order('date', { ascending: true }),
                supabase
                    .from('chart_of_accounts')
                    .select('code, name, type, subtype')
                    .eq('is_active', true)
                    .order('code'),
            ]);

            if (journalRes.error) throw journalRes.error;
            if (coaRes.error) throw coaRes.error;

            setEntries(journalRes.data || []);
            setAccounts(coaRes.data || []);
        } catch (err: any) {
            toast.error('Failed to load ledger: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Build account ledger map ────────────────────────────────────────────────

    const accountBalances = useMemo((): AccountBalance[] => {
        // Create a map from account name → COA metadata
        const coaMap = new Map(accounts.map(a => [a.name, a]));

        // Collect all account names referenced in journal entries
        const accountNames = new Set<string>();
        entries.forEach(e => {
            if (e.debit_account) accountNames.add(e.debit_account);
            if (e.credit_account) accountNames.add(e.credit_account);
        });

        const result: AccountBalance[] = [];

        for (const name of accountNames) {
            const coa = coaMap.get(name);
            const type = coa?.type || 'Asset';
            const subtype = coa?.subtype || '';
            const code = coa?.code || '????';

            // Gather debit lines
            const debitLines = entries
                .filter(e => e.debit_account === name)
                .map(e => ({ date: e.date, entry_number: e.entry_number, description: e.description, ref_type: e.ref_type, debit: Number(e.debit_amount), credit: 0, notes: e.notes }));

            // Gather credit lines
            const creditLines = entries
                .filter(e => e.credit_account === name)
                .map(e => ({ date: e.date, entry_number: e.entry_number, description: e.description, ref_type: e.ref_type, debit: 0, credit: Number(e.credit_amount), notes: e.notes }));

            // Merge and sort by date
            const allLines = [...debitLines, ...creditLines].sort((a, b) => a.date.localeCompare(b.date));

            // Compute running balances
            let running = 0;
            const lines: LedgerLine[] = allLines.map(l => {
                const movement = (type === 'Asset' || type === 'Expense')
                    ? l.debit - l.credit
                    : l.credit - l.debit;
                running += movement;
                return { ...l, runningBalance: running };
            });

            const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
            const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

            result.push({
                name,
                type,
                subtype,
                code,
                totalDebit,
                totalCredit,
                balance: normalBalance(type, totalDebit, totalCredit),
                entries: lines,
            });
        }

        return result.sort((a, b) => {
            const ti = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
            if (ti !== 0) return ti;
            return a.code.localeCompare(b.code);
        });
    }, [entries, accounts]);

    // ── Filtered accounts ──────────────────────────────────────────────────────

    const filtered = filterType === 'All' ? accountBalances : accountBalances.filter(a => a.type === filterType);

    // ── Summary stats ──────────────────────────────────────────────────────────

    const totalDebits  = entries.reduce((s, e) => s + Number(e.debit_amount), 0);
    const totalCredits = entries.reduce((s, e) => s + Number(e.credit_amount), 0);
    const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01;

    const totalAssets      = accountBalances.filter(a => a.type === 'Asset').reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = accountBalances.filter(a => a.type === 'Liability').reduce((s, a) => s + a.balance, 0);
    const totalRevenue     = accountBalances.filter(a => a.type === 'Revenue').reduce((s, a) => s + a.balance, 0);
    const totalExpenses    = accountBalances.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const toggle = (name: string) =>
        setExpandedAccounts(prev => {
            const next = new Set(prev);
            if (next.has(name)) { next.delete(name); } else { next.add(name); }
            return next;
        });

    const fmt = (v: number) => formatCurrency(v);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="General Ledger"
                subtitle="Account-level balances and transaction history"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'General Ledger' },
                ]}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Date Range */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '6px 12px', borderRadius: 8 }}>
                            <Calendar size={14} color="var(--slate-400)" />
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }} />
                            <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>–</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }} />
                        </div>
                        {/* Type filter */}
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            style={{ padding: '7px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none', background: 'var(--card-bg)' }}
                        >
                            <option value="All">All Types</option>
                            {TYPE_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                }
            />

            {/* Cross-dept navigation links */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { label: 'Journal Entries', href: '/accounting/journal' },
                    { label: 'Sales Invoices', href: '/sales/invoices' },
                    { label: 'Sales Receipts', href: '/sales/receipts' },
                    { label: 'Supplier Payments', href: '/purchasing/payments' },
                    { label: 'Cash Flow', href: '/accounting/cash-flow' },
                    { label: 'Financial Position', href: '/accounting/financial-position' },
                ].map(l => (
                    <Link key={l.href} href={l.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={11} /> {l.label}
                    </Link>
                ))}
            </div>

            {/* Summary stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total Assets', value: totalAssets, icon: <TrendingUp size={18} />, color: '#1d4ed8', bg: '#eff6ff' },
                    { label: 'Total Revenue', value: totalRevenue, icon: <TrendingUp size={18} />, color: '#15803d', bg: '#f0fdf4' },
                    { label: 'Total Expenses', value: totalExpenses, icon: <TrendingDown size={18} />, color: '#c2410c', bg: '#fff7ed' },
                    {
                        label: isBalanced ? 'Books Balanced' : 'Imbalance!',
                        value: Math.abs(totalDebits - totalCredits),
                        icon: <Scale size={18} />,
                        color: isBalanced ? '#15803d' : '#b91c1c',
                        bg: isBalanced ? '#f0fdf4' : '#fef2f2',
                    },
                ].map(card => (
                    <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}30`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                            {card.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 2 }}>{card.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: card.color }}>{fmt(card.value)}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Ledger accounts */}
            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading ledger…</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>No journal entries in this period. Auto-entries from Sales and Purchasing will appear here.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(account => {
                        const style = TYPE_COLORS[account.type] || TYPE_COLORS.Asset;
                        const isOpen = expandedAccounts.has(account.name);

                        return (
                            <div key={account.name} style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden' }}>

                                {/* Account header row */}
                                <button
                                    onClick={() => toggle(account.name)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    {/* Expand arrow */}
                                    <span style={{ color: 'var(--slate-400)', flexShrink: 0 }}>
                                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </span>

                                    {/* Code badge */}
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: style.color, background: style.bg, border: `1px solid ${style.border}`, padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                                        {account.code}
                                    </span>

                                    {/* Account name */}
                                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--slate-800)' }}>{account.name}</span>

                                    {/* Type */}
                                    <span style={{ fontSize: 10, fontWeight: 600, color: style.color, background: style.bg, border: `1px solid ${style.border}`, padding: '2px 10px', borderRadius: 20 }}>
                                        {account.type}
                                    </span>

                                    {/* Debit total */}
                                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>DEBIT</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{fmt(account.totalDebit)}</div>
                                    </div>

                                    {/* Credit total */}
                                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>CREDIT</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{fmt(account.totalCredit)}</div>
                                    </div>

                                    {/* Net balance */}
                                    <div style={{ textAlign: 'right', minWidth: 140 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>BALANCE</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: account.balance >= 0 ? style.color : '#b91c1c' }}>
                                            {fmt(Math.abs(account.balance))}
                                            {account.balance < 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>(Cr)</span>}
                                        </div>
                                    </div>
                                </button>

                                {/* Transaction detail rows */}
                                {isOpen && (
                                    <div style={{ borderTop: '1px solid var(--slate-100)' }}>
                                        {/* Column headings */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 120px 1fr 90px 110px 110px 130px', gap: 8, padding: '8px 20px', background: 'var(--slate-50)', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            <span>Date</span>
                                            <span>Entry No.</span>
                                            <span>Description</span>
                                            <span>Type</span>
                                            <span style={{ textAlign: 'right' }}>Debit</span>
                                            <span style={{ textAlign: 'right' }}>Credit</span>
                                            <span style={{ textAlign: 'right' }}>Balance</span>
                                        </div>

                                        {account.entries.map((line, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '110px 120px 1fr 90px 110px 110px 130px',
                                                    gap: 8, padding: '9px 20px',
                                                    borderTop: '1px solid var(--slate-50)',
                                                    fontSize: 12,
                                                    background: idx % 2 === 0 ? 'transparent' : 'var(--slate-50)',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <span style={{ color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{line.date}</span>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--primary-600)' }}>{line.entry_number}</span>
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'var(--slate-700)' }}>{line.description}</div>
                                                    {line.notes && <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>{line.notes}</div>}
                                                </div>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 600,
                                                    color: REF_COLORS[line.ref_type] || '#555',
                                                    background: `${REF_COLORS[line.ref_type] || '#555'}15`,
                                                    padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                                                }}>
                                                    {line.ref_type}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 600, color: line.debit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                                    {line.debit > 0 ? fmt(line.debit) : '—'}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 600, color: line.credit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                                    {line.credit > 0 ? fmt(line.credit) : '—'}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, color: line.runningBalance >= 0 ? 'var(--slate-800)' : '#b91c1c' }}>
                                                    {fmt(Math.abs(line.runningBalance))}
                                                    {line.runningBalance < 0 && <span style={{ fontSize: 9, marginLeft: 3, color: '#b91c1c' }}>Cr</span>}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Account totals footer */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '110px 120px 1fr 90px 110px 110px 130px',
                                            gap: 8, padding: '10px 20px',
                                            borderTop: '2px solid var(--slate-200)',
                                            background: style.bg,
                                            fontSize: 12, fontWeight: 800,
                                        }}>
                                            <span style={{ gridColumn: '1 / 5', color: style.color }}>TOTALS</span>
                                            <span style={{ textAlign: 'right', color: style.color }}>{fmt(account.totalDebit)}</span>
                                            <span style={{ textAlign: 'right', color: style.color }}>{fmt(account.totalCredit)}</span>
                                            <span style={{ textAlign: 'right', color: style.color }}>{fmt(Math.abs(account.balance))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
