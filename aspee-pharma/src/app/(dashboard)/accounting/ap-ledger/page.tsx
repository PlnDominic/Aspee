'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import { useFetch } from '@/lib/hooks';
import { exportToCsv } from '@/lib/csvExport';
import {
    Download, Landmark, AlertTriangle, CheckCircle2,
    ChevronDown, ChevronRight, Search, Scale,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LedgerLine {
    date: string;
    type: 'Bill' | 'Payment';
    ref: string;
    description: string;
    debit: number;   // reduces payable (payment)
    credit: number;  // increases payable (goods received / billed)
    runningBalance: number;
}

interface SupplierLedger {
    supplierId: string;
    supplierName: string;
    category: string;
    status: string;
    totalBilled: number;
    totalPaid: number;
    balanceDue: number;
    lines: LedgerLine[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AccountsPayableLedgerPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading ledger…</div>}>
            <AccountsPayableLedgerContent />
        </Suspense>
    );
}

function AccountsPayableLedgerContent() {
    const searchParams = useSearchParams();
    const initialSearch = searchParams.get('search') || '';

    const [search, setSearch] = useState(initialSearch);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [autoExpanded, setAutoExpanded] = useState(false);

    const { data, isLoading: loading } = useFetch<{
        suppliers: any[];
        grnItems: any[];
        payments: any[];
        glEntries: any[];
    }>(
        ['ap_ledger'],
        async () => {
            const [suppliersRes, grnItemsRes, paymentsRes, glRes] = await Promise.all([
                supabase.from('suppliers').select('id, name, category, status').order('name'),
                supabase
                    .from('grn_items')
                    .select(`
                        quantity_received, qa_status,
                        purchase_order_items:po_item_id ( unit_price ),
                        grn:grn_id ( grn_number, received_date, qa_status,
                            purchase_orders:po_id ( po_number, supplier_id, currency, approved_by, approval_level ) )
                    `)
                    .eq('qa_status', 'Approved'),
                supabase
                    .from('supplier_payments')
                    .select('id, supplier_id, payment_number, payment_date, amount, status, po_id, purchase_orders:po_id(po_number, currency)')
                    .in('status', ['Approved', 'Completed']),
                supabase
                    .from('journal_entries')
                    .select('debit_account, debit_amount, credit_account, credit_amount')
                    .or('debit_account.eq.Accounts Payable,credit_account.eq.Accounts Payable'),
            ]);

            if (suppliersRes.error) return { data: null, error: suppliersRes.error };
            if (grnItemsRes.error) return { data: null, error: grnItemsRes.error };
            if (paymentsRes.error) return { data: null, error: paymentsRes.error };
            if (glRes.error) return { data: null, error: glRes.error };

            return {
                data: {
                    suppliers: suppliersRes.data || [],
                    grnItems: grnItemsRes.data || [],
                    payments: paymentsRes.data || [],
                    glEntries: glRes.data || [],
                },
                error: null,
            };
        }
    );

    // ── Build independent subsidiary ledger, one per supplier ──────────────────
    // Bills are recognized off GRN receipts (goods actually received & QA-approved),
    // valued at the linked PO item's unit price — not from GL narration text —
    // so this ledger can be reconciled against, rather than derived from, the GL.
    // A receipt only counts as Billed once the underlying PO carries a Manager or
    // Finance/Accountant approval — i.e. the amount was sign off on, not just ordered.
    const ledgers = useMemo((): SupplierLedger[] => {
        if (!data) return [];
        const { suppliers, grnItems, payments } = data;

        const bySupplier = new Map<string, SupplierLedger>();
        for (const s of suppliers) {
            bySupplier.set(s.id, {
                supplierId: s.id,
                supplierName: s.name,
                category: s.category,
                status: s.status,
                totalBilled: 0,
                totalPaid: 0,
                balanceDue: 0,
                lines: [],
            });
        }

        for (const gi of grnItems) {
            const grn = gi.grn;
            const po = grn?.purchase_orders;
            const supplierId = po?.supplier_id;
            if (!supplierId || !bySupplier.has(supplierId)) continue;
            if (!po.approved_by || !['Manager', 'Finance'].includes(po.approval_level)) continue;

            const unitPrice = Number(gi.purchase_order_items?.unit_price) || 0;
            const value = unitPrice * Number(gi.quantity_received || 0);
            if (value <= 0) continue;

            const ledger = bySupplier.get(supplierId)!;
            ledger.totalBilled += value;
            ledger.lines.push({
                date: grn.received_date,
                type: 'Bill',
                ref: grn.grn_number,
                description: `Goods received against PO ${po.po_number || '—'}`,
                debit: 0,
                credit: value,
                runningBalance: 0,
            });
        }

        for (const p of payments) {
            const supplierId = p.supplier_id;
            if (!supplierId || !bySupplier.has(supplierId)) continue;

            const amount = Number(p.amount) || 0;
            const ledger = bySupplier.get(supplierId)!;
            ledger.totalPaid += amount;
            ledger.lines.push({
                date: p.payment_date,
                type: 'Payment',
                ref: p.payment_number,
                description: `Payment against PO ${p.purchase_orders?.po_number || '—'}`,
                debit: amount,
                credit: 0,
                runningBalance: 0,
            });
        }

        const result: SupplierLedger[] = [];
        for (const ledger of bySupplier.values()) {
            ledger.lines.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            let running = 0;
            ledger.lines = ledger.lines.map(l => {
                running += l.credit - l.debit;
                return { ...l, runningBalance: running };
            });
            ledger.balanceDue = ledger.totalBilled - ledger.totalPaid;
            if (ledger.totalBilled > 0 || ledger.totalPaid > 0) result.push(ledger);
        }

        return result.sort((a, b) => b.balanceDue - a.balanceDue);
    }, [data]);

    useEffect(() => {
        if (autoExpanded || !initialSearch || ledgers.length === 0) return;
        const match = ledgers.find(l => l.supplierName.toLowerCase().includes(initialSearch.trim().toLowerCase()));
        if (match) setExpanded(prev => new Set(prev).add(match.supplierId));
        setAutoExpanded(true);
    }, [ledgers, initialSearch, autoExpanded]);

    const filtered = search.trim()
        ? ledgers.filter(l => l.supplierName.toLowerCase().includes(search.trim().toLowerCase()))
        : ledgers;

    // ── GL reconciliation ───────────────────────────────────────────────────────
    // Accounts Payable is a Liability, so its normal balance is credit − debit.
    const glBalance = useMemo(() => {
        if (!data) return 0;
        let debit = 0, credit = 0;
        for (const e of data.glEntries) {
            if (e.debit_account === 'Accounts Payable') debit += Number(e.debit_amount || 0);
            if (e.credit_account === 'Accounts Payable') credit += Number(e.credit_amount || 0);
        }
        return credit - debit;
    }, [data]);

    const subledgerTotal = ledgers.reduce((s, l) => s + l.balanceDue, 0);
    const variance = subledgerTotal - glBalance;
    const isReconciled = Math.abs(variance) < 0.01;

    const toggle = (id: string) =>
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const handleExport = () => {
        if (filtered.length === 0) {
            toast.error('No data to export');
            return;
        }
        exportToCsv(
            `Accounts_Payable_Ledger_${new Date().toISOString().split('T')[0]}.csv`,
            filtered,
            [
                { header: 'Supplier', accessor: r => r.supplierName },
                { header: 'Category', accessor: r => r.category },
                { header: 'Total Billed', accessor: r => r.totalBilled },
                { header: 'Total Paid', accessor: r => r.totalPaid },
                { header: 'Balance Due', accessor: r => r.balanceDue },
            ]
        );
        toast.success('Exported to CSV successfully');
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Accounts Payable Ledger"
                subtitle="Independent, supplier-level subsidiary ledger — reconciled against the General Ledger control account"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'A/P Ledger' },
                ]}
                actions={
                    <button
                        onClick={handleExport}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 500, color: 'var(--slate-700)', cursor: 'pointer' }}
                    >
                        <Download size={16} /> Export
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Payable (Subledger)" value={formatCurrency(subledgerTotal)} icon={<Landmark size={20} />} color="blue" />
                <StatCard title="Accounts Payable (GL)" value={formatCurrency(glBalance)} icon={<Scale size={20} />} color="purple" />
                <StatCard
                    title={isReconciled ? 'Reconciled' : 'Variance Detected'}
                    value={formatCurrency(Math.abs(variance))}
                    subtitle={isReconciled ? 'Subledger matches GL control account' : 'Subledger does not match GL — investigate'}
                    icon={isReconciled ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    color={isReconciled ? 'green' : 'red'}
                />
            </div>

            {!isReconciled && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 20,
                    fontSize: 12, color: '#b91c1c',
                }}>
                    <AlertTriangle size={16} />
                    <span>
                        The supplier subledger total ({formatCurrency(subledgerTotal)}) does not match the
                        Accounts Payable balance in the General Ledger ({formatCurrency(glBalance)}). This usually means a
                        goods receipt or payment was posted to the GL without a matching source document, or vice versa.
                    </span>
                </div>
            )}

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '8px 14px', borderRadius: 8, marginBottom: 16, maxWidth: 360 }}>
                <Search size={14} color="var(--slate-400)" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search supplier..."
                    style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: '100%' }}
                />
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading ledger…</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>No outstanding or historical supplier balances found.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(ledger => {
                        const isOpen = expanded.has(ledger.supplierId);
                        const currency = 'GHS';
                        return (
                            <div key={ledger.supplierId} style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden' }}>
                                <button
                                    onClick={() => toggle(ledger.supplierId)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                    <span style={{ color: 'var(--slate-400)', flexShrink: 0 }}>
                                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </span>
                                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--slate-800)' }}>{ledger.supplierName}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', background: 'var(--slate-100)', padding: '2px 10px', borderRadius: 20 }}>
                                        {ledger.category}
                                    </span>
                                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>BILLED</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{formatCurrency(ledger.totalBilled, currency)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>PAID</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{formatCurrency(ledger.totalPaid, currency)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 140 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>BALANCE DUE</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: ledger.balanceDue > 0 ? '#b91c1c' : '#15803d' }}>
                                            {formatCurrency(Math.abs(ledger.balanceDue), currency)}
                                        </div>
                                    </div>
                                </button>

                                {isOpen && (
                                    <div style={{ borderTop: '1px solid var(--slate-100)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 1fr 110px 110px 130px', gap: 8, padding: '8px 20px', background: 'var(--slate-50)', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            <span>Date</span>
                                            <span>Reference</span>
                                            <span>Description</span>
                                            <span style={{ textAlign: 'right' }}>Billed</span>
                                            <span style={{ textAlign: 'right' }}>Paid</span>
                                            <span style={{ textAlign: 'right' }}>Balance</span>
                                        </div>
                                        {ledger.lines.length === 0 ? (
                                            <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--slate-400)' }}>No transactions.</div>
                                        ) : ledger.lines.map((line, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'grid', gridTemplateColumns: '110px 130px 1fr 110px 110px 130px', gap: 8,
                                                    padding: '9px 20px', borderTop: '1px solid var(--slate-50)', fontSize: 12,
                                                    background: idx % 2 === 0 ? 'transparent' : 'var(--slate-50)', alignItems: 'center',
                                                }}
                                            >
                                                <span style={{ color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                                    {line.date ? new Date(line.date).toLocaleDateString('en-GB') : '-'}
                                                </span>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--primary-600)' }}>{line.ref}</span>
                                                <span style={{ color: 'var(--slate-700)' }}>{line.description}</span>
                                                <span style={{ textAlign: 'right', fontWeight: 600, color: line.credit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                                    {line.credit > 0 ? formatCurrency(line.credit, currency) : '—'}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 600, color: line.debit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                                    {line.debit > 0 ? formatCurrency(line.debit, currency) : '—'}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, color: line.runningBalance > 0 ? '#b91c1c' : '#15803d' }}>
                                                    {formatCurrency(Math.abs(line.runningBalance), currency)}
                                                </span>
                                            </div>
                                        ))}
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
