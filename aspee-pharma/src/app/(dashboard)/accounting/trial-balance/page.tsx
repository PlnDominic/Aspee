'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { Calendar, Printer, Scale, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface JournalEntry {
    date: string;
    debit_account: string;
    debit_amount: number;
    credit_account: string;
    credit_amount: number;
}

interface COARecord {
    code: string;
    name: string;
    type: string;
    subtype: string;
}

interface TrialBalanceLine {
    code: string;
    name: string;
    type: string;
    subtype: string;
    totalDebit: number;   // sum of all debit postings to this account
    totalCredit: number;  // sum of all credit postings to this account
    /** Net shown in the DR column — positive when account has a debit net balance */
    drBalance: number;
    /** Net shown in the CR column — positive when account has a credit net balance */
    crBalance: number;
}

// Account type display order (standard accounting convention)
const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const TYPE_COLORS: Record<string, { label: string; bg: string; color: string; border: string }> = {
    Asset:     { label: 'Asset',     bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    Liability: { label: 'Liability', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    Equity:    { label: 'Equity',    bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
    Revenue:   { label: 'Revenue',   bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    Expense:   { label: 'Expense',   bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: number): string {
    return v === 0 ? '—' : formatCurrency(v).replace(/^GH[SC]?\s*/, '');
}

function fmtFull(v: number): string {
    return formatCurrency(v);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TrialBalancePage() {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [coa, setCoa] = useState<COARecord[]>([]);
    const [asAt, setAsAt] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchData();
    }, [asAt]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [journalRes, coaRes] = await Promise.all([
                supabase
                    .from('journal_entries')
                    .select('date, debit_account, debit_amount, credit_account, credit_amount')
                    .lte('date', asAt),
                supabase
                    .from('chart_of_accounts')
                    .select('code, name, type, subtype')
                    .eq('is_active', true)
                    .order('code'),
            ]);

            if (journalRes.error) throw journalRes.error;
            if (coaRes.error) throw coaRes.error;

            setEntries(journalRes.data || []);
            setCoa(coaRes.data || []);
        } catch (err: any) {
            toast.error('Failed to load trial balance: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Build trial balance lines ──────────────────────────────────────────────

    const lines = useMemo((): TrialBalanceLine[] => {
        const coaMap = new Map(coa.map(a => [a.name, a]));

        // Accumulate totals per account name
        const totals = new Map<string, { debit: number; credit: number }>();

        const accum = (name: string, debit: number, credit: number) => {
            const existing = totals.get(name) ?? { debit: 0, credit: 0 };
            totals.set(name, {
                debit: existing.debit + debit,
                credit: existing.credit + credit,
            });
        };

        for (const e of entries) {
            if (e.debit_account)  accum(e.debit_account,  Number(e.debit_amount) || 0, 0);
            if (e.credit_account) accum(e.credit_account, 0, Number(e.credit_amount) || 0);
        }

        const result: TrialBalanceLine[] = [];

        for (const [name, { debit, credit }] of totals) {
            if (debit === 0 && credit === 0) continue;

            const meta = coaMap.get(name);
            const net = debit - credit;

            result.push({
                code:        meta?.code    ?? '—',
                name,
                type:        meta?.type    ?? 'Asset',
                subtype:     meta?.subtype ?? '',
                totalDebit:  debit,
                totalCredit: credit,
                // Positive net → debit balance; negative net → credit balance
                drBalance: net > 0 ? net : 0,
                crBalance: net < 0 ? Math.abs(net) : 0,
            });
        }

        // Sort by type order then account code
        return result.sort((a, b) => {
            const ti = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
            if (ti !== 0) return ti;
            return a.code.localeCompare(b.code);
        });
    }, [entries, coa]);

    // ── Totals & balance check ─────────────────────────────────────────────────

    const grandDR     = lines.reduce((s, l) => s + l.drBalance, 0);
    const grandCR     = lines.reduce((s, l) => s + l.crBalance, 0);
    const isBalanced  = Math.abs(grandDR - grandCR) < 0.01;
    const imbalance   = Math.abs(grandDR - grandCR);

    // Subtotals per type
    const subtotals = useMemo(() => {
        const map: Record<string, { dr: number; cr: number }> = {};
        for (const l of lines) {
            if (!map[l.type]) map[l.type] = { dr: 0, cr: 0 };
            map[l.type].dr += l.drBalance;
            map[l.type].cr += l.crBalance;
        }
        return map;
    }, [lines]);

    // Group lines by type for rendering
    const grouped = useMemo(() => {
        const map = new Map<string, TrialBalanceLine[]>();
        for (const type of TYPE_ORDER) map.set(type, []);
        for (const l of lines) map.get(l.type)?.push(l);
        return map;
    }, [lines]);

    const asAtFormatted = new Date(asAt + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="animate-fade-in">
            {/* ── Header ── */}
            <div className="no-print">
                <PageHeader
                    title="Trial Balance"
                    subtitle="Formal columnar statement of all account debit/credit balances"
                    breadcrumbs={[
                        { label: 'Accounting', href: '/accounting/journal' },
                        { label: 'Trial Balance' },
                    ]}
                    actions={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '7px 14px', borderRadius: 8 }}>
                                <Calendar size={14} color="var(--slate-400)" />
                                <span style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 600 }}>As at</span>
                                <input
                                    type="date"
                                    value={asAt}
                                    onChange={e => setAsAt(e.target.value)}
                                    style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }}
                                />
                            </div>
                            <button
                                onClick={() => window.print()}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--slate-900)', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            >
                                <Printer size={15} /> Print
                            </button>
                        </div>
                    }
                />

                {/* Balance status banner */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 18px', borderRadius: 10, marginBottom: 20,
                    background: isBalanced ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'}`,
                }}>
                    {isBalanced
                        ? <CheckCircle size={18} color="#15803d" />
                        : <AlertTriangle size={18} color="#b91c1c" />
                    }
                    <span style={{ fontWeight: 700, fontSize: 13, color: isBalanced ? '#15803d' : '#b91c1c' }}>
                        {isBalanced
                            ? 'Books are balanced — total debits equal total credits'
                            : `Imbalance detected: ${fmtFull(imbalance)} difference between debits and credits`
                        }
                    </span>
                </div>

                {/* Cross-dept navigation */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                        { label: 'General Ledger',      href: '/accounting/ledger' },
                        { label: 'Journal Entries',     href: '/accounting/journal' },
                        { label: 'Financial Position',  href: '/accounting/financial-position' },
                        { label: 'Comprehensive Income',href: '/accounting/comprehensive-income' },
                        { label: 'Cash Flow',           href: '/accounting/cash-flow' },
                    ].map(l => (
                        <Link key={l.href} href={l.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={11} /> {l.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Formal statement (printable) ── */}
            <div className="tb-paper">

                {/* Company heading */}
                <div className="tb-heading">
                    <div className="tb-company">ASPEE PHARMACEUTICALS LIMITED</div>
                    <div className="tb-title">TRIAL BALANCE</div>
                    <div className="tb-period">As at {asAtFormatted}</div>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                        Loading trial balance…
                    </div>
                ) : (
                    <table className="tb-table">
                        <thead>
                            <tr className="tb-head-row">
                                <th className="tb-th tb-col-code">Code</th>
                                <th className="tb-th tb-col-name">Account Name</th>
                                <th className="tb-th tb-col-type">Type</th>
                                <th className="tb-th tb-col-amt">Debit (GH₵)</th>
                                <th className="tb-th tb-col-amt">Credit (GH₵)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {TYPE_ORDER.map(type => {
                                const typeLines = grouped.get(type) ?? [];
                                if (typeLines.length === 0) return null;
                                const sub = subtotals[type] ?? { dr: 0, cr: 0 };
                                const style = TYPE_COLORS[type] ?? TYPE_COLORS.Asset;

                                return (
                                    <React.Fragment key={type}>
                                        {/* Section header */}
                                        <tr className="tb-section-row">
                                            <td colSpan={5} className="tb-section-label" style={{ color: style.color, background: style.bg, borderLeft: `3px solid ${style.color}` }}>
                                                {type.toUpperCase()} ACCOUNTS
                                            </td>
                                        </tr>

                                        {/* Account lines */}
                                        {typeLines.map((line, idx) => (
                                            <tr key={line.name} className={`tb-row ${idx % 2 === 1 ? 'tb-row-alt' : ''}`}>
                                                <td className="tb-td tb-col-code tb-mono">{line.code}</td>
                                                <td className="tb-td tb-col-name">{line.name}</td>
                                                <td className="tb-td tb-col-type">
                                                    <span className="tb-type-badge" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                                                        {line.subtype || type}
                                                    </span>
                                                </td>
                                                <td className="tb-td tb-col-amt tb-amt">
                                                    {line.drBalance > 0 ? fmt(line.drBalance) : ''}
                                                </td>
                                                <td className="tb-td tb-col-amt tb-amt">
                                                    {line.crBalance > 0 ? fmt(line.crBalance) : ''}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Section subtotal */}
                                        <tr className="tb-subtotal-row">
                                            <td colSpan={3} className="tb-td tb-subtotal-label" style={{ color: style.color }}>
                                                Total {type} Accounts
                                            </td>
                                            <td className="tb-td tb-col-amt tb-subtotal-amt" style={{ color: style.color }}>
                                                {sub.dr > 0 ? fmt(sub.dr) : '—'}
                                            </td>
                                            <td className="tb-td tb-col-amt tb-subtotal-amt" style={{ color: style.color }}>
                                                {sub.cr > 0 ? fmt(sub.cr) : '—'}
                                            </td>
                                        </tr>

                                        <tr className="tb-spacer"><td colSpan={5} /></tr>
                                    </React.Fragment>
                                );
                            })}

                            {/* Grand totals */}
                            <tr className="tb-total-row">
                                <td colSpan={3} className="tb-td tb-total-label">
                                    <Scale size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                                    GRAND TOTAL
                                </td>
                                <td className="tb-td tb-col-amt tb-total-amt">{fmt(grandDR)}</td>
                                <td className="tb-td tb-col-amt tb-total-amt">{fmt(grandCR)}</td>
                            </tr>

                            {/* Balance check row */}
                            {!isBalanced && (
                                <tr className="tb-imbalance-row">
                                    <td colSpan={3} className="tb-td tb-imbalance-label">Difference (imbalance)</td>
                                    <td className="tb-td tb-col-amt tb-imbalance-amt">
                                        {grandDR > grandCR ? fmt(imbalance) : ''}
                                    </td>
                                    <td className="tb-td tb-col-amt tb-imbalance-amt">
                                        {grandCR > grandDR ? fmt(imbalance) : ''}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* Footer note */}
                {!loading && (
                    <div className="tb-footer">
                        <p>Prepared from general ledger as at {asAtFormatted}.</p>
                        <p>All amounts in Ghana Cedis (GH₵). Auto-posted entries included.</p>
                    </div>
                )}
            </div>

            {/* ── Styles ── */}
            <style jsx global>{`
                /* Shared layout */
                .tb-paper {
                    background: #fff;
                    max-width: 860px;
                    margin: 0 auto;
                    padding: 60px 80px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                    border-radius: 4px;
                    color: #0f172a;
                    font-family: 'Times New Roman', Times, serif;
                }

                /* Heading */
                .tb-heading { text-align: center; margin-bottom: 40px; }
                .tb-company  { font-size: 17px; font-weight: 800; text-decoration: underline; letter-spacing: .04em; margin-bottom: 6px; }
                .tb-title    { font-size: 14px; font-weight: 700; text-decoration: underline; margin-bottom: 4px; }
                .tb-period   { font-size: 13px; font-style: italic; color: #334155; }

                /* Table */
                .tb-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }

                .tb-head-row { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
                .tb-th { padding: 8px 10px; font-weight: 800; font-size: 11.5px; text-align: left; letter-spacing: .04em; }
                .tb-col-code { width: 72px; }
                .tb-col-name { width: auto; }
                .tb-col-type { width: 150px; }
                .tb-col-amt  { width: 130px; text-align: right !important; }

                /* Section header */
                .tb-section-row td {
                    padding-top: 12px;
                }
                .tb-section-label {
                    padding: 6px 10px;
                    font-size: 10.5px;
                    font-weight: 800;
                    letter-spacing: .08em;
                    font-family: 'Segoe UI', sans-serif;
                }

                /* Data rows */
                .tb-row { border-bottom: 1px solid #f1f5f9; }
                .tb-row-alt { background: #f8fafc; }
                .tb-td { padding: 7px 10px; font-size: 12.5px; vertical-align: middle; }
                .tb-mono { font-family: 'Courier New', monospace; font-size: 11.5px; color: #475569; }
                .tb-amt { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }

                /* Type badge */
                .tb-type-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 20px;
                    font-size: 10px;
                    font-weight: 700;
                    font-family: 'Segoe UI', sans-serif;
                    white-space: nowrap;
                }

                /* Subtotal row */
                .tb-subtotal-row { border-top: 1.5px solid #cbd5e1; }
                .tb-subtotal-label { padding: 7px 10px; font-weight: 700; font-size: 12px; font-style: italic; }
                .tb-subtotal-amt { text-align: right; font-weight: 700; font-family: 'Courier New', monospace; padding: 7px 10px; }

                /* Spacer */
                .tb-spacer td { height: 16px; }

                /* Grand total row */
                .tb-total-row { border-top: 2.5px double #0f172a; border-bottom: 2.5px double #0f172a; }
                .tb-total-label { padding: 10px 10px; font-weight: 900; font-size: 13px; letter-spacing: .03em; }
                .tb-total-amt   { text-align: right; font-weight: 900; font-size: 14px; font-family: 'Courier New', monospace; padding: 10px 10px; }

                /* Imbalance row */
                .tb-imbalance-row { background: #fef2f2; }
                .tb-imbalance-label { padding: 7px 10px; font-weight: 700; font-size: 12px; color: #b91c1c; }
                .tb-imbalance-amt   { text-align: right; font-weight: 700; font-family: 'Courier New', monospace; padding: 7px 10px; color: #b91c1c; }

                /* Footer */
                .tb-footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; font-style: italic; line-height: 1.8; }

                /* Print */
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    aside, header { display: none !important; }
                    .main-content { padding: 0 !important; margin: 0 !important; }
                    .tb-paper { box-shadow: none; padding: 20px 40px; max-width: 100%; }
                    .tb-row-alt { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
}
