'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import PrintableCustomerLedger, { StatementRow } from '@/components/PrintableCustomerLedger';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import { generatePDF } from '@/lib/pdfGenerator';
import { useFetch } from '@/lib/hooks';
import { exportToCsv } from '@/lib/csvExport';
import {
    Download, Users, AlertTriangle, CheckCircle2,
    ChevronDown, ChevronRight, Search, Scale, ExternalLink, Calendar, Printer, Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LedgerLine {
    date: string;
    type: 'Invoice' | 'Receipt' | 'Credit Note';
    ref: string;
    description: string;
    debit: number;   // increases receivable (invoice raised)
    credit: number;  // reduces receivable (payment / credit note)
    runningBalance: number;
}

interface CustomerLedger {
    key: string;
    customerName: string;
    category: string;
    route: string;
    totalInvoiced: number;
    totalReceived: number;
    totalCredited: number;
    balanceDue: number;
    lines: LedgerLine[];
}

const normalizeName = (name: string | null | undefined) => (name || '').trim().toLowerCase();

// ── Component ──────────────────────────────────────────────────────────────────

export default function AccountsReceivableLedgerPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading ledger…</div>}>
            <AccountsReceivableLedgerContent />
        </Suspense>
    );
}

function AccountsReceivableLedgerContent() {
    const searchParams = useSearchParams();
    const initialSearch = searchParams.get('search') || '';

    const [search, setSearch] = useState(initialSearch);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [autoExpanded, setAutoExpanded] = useState(false);

    // Statement (Book by Slip) period + PDF generation state
    const [stmtFrom, setStmtFrom] = useState(`${new Date().getFullYear()}-01-01`);
    const [stmtTo, setStmtTo] = useState(new Date().toISOString().split('T')[0]);
    const [generating, setGenerating] = useState<string | null>(null);
    const [statement, setStatement] = useState<{ customer: any; rows: StatementRow[]; period: { from: string; to: string }; generatedAt: string } | null>(null);

    const { data, isLoading: loading } = useFetch<{
        customers: any[];
        invoices: any[];
        receipts: any[];
        creditNotes: any[];
        glEntries: any[];
    }>(
        ['ar_ledger'],
        async () => {
            const [customersRes, invoicesRes, receiptsRes, creditNotesRes, glRes] = await Promise.all([
                supabase.from('customers').select('*').order('name'),
                supabase
                    .from('sales_invoices')
                    .select('id, invoice_number, date, customer_name, total_amount, status'),
                supabase
                    .from('sales_receipts')
                    .select('id, receipt_number, date, customer_name, amount, payment_method, status'),
                // credit_notes has schema drift across migrations (amount vs original_amount,
                // credit_note_number vs cn_number) — select * and read the fields defensively.
                supabase
                    .from('credit_notes')
                    .select('*'),
                supabase
                    .from('journal_entries')
                    .select('debit_account, debit_amount, credit_account, credit_amount')
                    .or('debit_account.eq.Accounts Receivable,credit_account.eq.Accounts Receivable'),
            ]);

            if (customersRes.error) return { data: null, error: customersRes.error };
            if (invoicesRes.error) return { data: null, error: invoicesRes.error };
            if (receiptsRes.error) return { data: null, error: receiptsRes.error };
            if (creditNotesRes.error) return { data: null, error: creditNotesRes.error };
            if (glRes.error) return { data: null, error: glRes.error };

            return {
                data: {
                    customers: customersRes.data || [],
                    invoices: invoicesRes.data || [],
                    receipts: receiptsRes.data || [],
                    creditNotes: creditNotesRes.data || [],
                    glEntries: glRes.data || [],
                },
                error: null,
            };
        }
    );

    // ── Build independent subsidiary ledger, one per customer ──────────────────
    // Invoices raise the receivable (debit), receipts and credit notes reduce it
    // (credit). Documents are grouped by customer name so the subledger can be
    // reconciled against — rather than derived from — the Accounts Receivable
    // control account in the General Ledger. Draft/cancelled/void documents are
    // excluded to match the balances shown on the Customers and Invoices pages.
    const ledgers = useMemo((): CustomerLedger[] => {
        if (!data) return [];
        const { customers, invoices, receipts, creditNotes } = data;

        const byCustomer = new Map<string, CustomerLedger>();

        const getOrCreate = (name: string): CustomerLedger => {
            const key = normalizeName(name);
            let ledger = byCustomer.get(key);
            if (!ledger) {
                ledger = {
                    key,
                    customerName: name || 'Unknown',
                    category: '',
                    route: '',
                    totalInvoiced: 0,
                    totalReceived: 0,
                    totalCredited: 0,
                    balanceDue: 0,
                    lines: [],
                };
                byCustomer.set(key, ledger);
            }
            return ledger;
        };

        // Seed from the customers master so metadata (category, route) is available
        for (const c of customers) {
            const ledger = getOrCreate(c.name);
            ledger.category = c.customer_category || c.category || '';
            ledger.route = c.route || '';
        }

        for (const inv of invoices) {
            const status = (inv.status || '').trim().toUpperCase();
            if (status === 'DRAFT' || status === 'CANCELLED') continue;
            const amount = Number(inv.total_amount) || 0;
            if (amount <= 0) continue;

            const ledger = getOrCreate(inv.customer_name);
            ledger.totalInvoiced += amount;
            ledger.lines.push({
                date: inv.date,
                type: 'Invoice',
                ref: inv.invoice_number,
                description: 'Sales invoice raised',
                debit: amount,
                credit: 0,
                runningBalance: 0,
            });
        }

        for (const r of receipts) {
            const status = (r.status || '').trim().toUpperCase();
            if (status === 'VOID' || status === 'CANCELLED') continue;
            const amount = Number(r.amount) || 0;
            if (amount <= 0) continue;

            const ledger = getOrCreate(r.customer_name);
            ledger.totalReceived += amount;
            ledger.lines.push({
                date: r.date,
                type: 'Receipt',
                ref: r.receipt_number,
                description: `Payment received${r.payment_method ? ` (${r.payment_method})` : ''}`,
                debit: 0,
                credit: amount,
                runningBalance: 0,
            });
        }

        for (const cn of creditNotes) {
            const status = (cn.status || '').trim().toUpperCase();
            if (status === 'DRAFT' || status === 'CANCELLED' || status === 'VOID') continue;
            const amount = Number(cn.amount ?? cn.original_amount ?? cn.total_amount) || 0;
            if (amount <= 0) continue;

            const ledger = getOrCreate(cn.customer_name);
            ledger.totalCredited += amount;
            ledger.lines.push({
                date: cn.date,
                type: 'Credit Note',
                ref: cn.credit_note_number ?? cn.cn_number ?? '—',
                description: 'Credit note issued',
                debit: 0,
                credit: amount,
                runningBalance: 0,
            });
        }

        const result: CustomerLedger[] = [];
        for (const ledger of byCustomer.values()) {
            ledger.lines.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            let running = 0;
            ledger.lines = ledger.lines.map(l => {
                running += l.debit - l.credit;
                return { ...l, runningBalance: running };
            });
            ledger.balanceDue = ledger.totalInvoiced - ledger.totalReceived - ledger.totalCredited;
            if (ledger.totalInvoiced > 0 || ledger.totalReceived > 0 || ledger.totalCredited > 0) {
                result.push(ledger);
            }
        }

        return result.sort((a, b) => b.balanceDue - a.balanceDue);
    }, [data]);

    useEffect(() => {
        if (autoExpanded || !initialSearch || ledgers.length === 0) return;
        const match = ledgers.find(l => l.customerName.toLowerCase().includes(initialSearch.trim().toLowerCase()));
        if (match) setExpanded(prev => new Set(prev).add(match.key));
        setAutoExpanded(true);
    }, [ledgers, initialSearch, autoExpanded]);

    const filtered = search.trim()
        ? ledgers.filter(l => l.customerName.toLowerCase().includes(search.trim().toLowerCase()))
        : ledgers;

    // ── GL reconciliation ───────────────────────────────────────────────────────
    // Accounts Receivable is an Asset, so its normal balance is debit − credit.
    const glBalance = useMemo(() => {
        if (!data) return 0;
        let debit = 0, credit = 0;
        for (const e of data.glEntries) {
            if (e.debit_account === 'Accounts Receivable') debit += Number(e.debit_amount || 0);
            if (e.credit_account === 'Accounts Receivable') credit += Number(e.credit_amount || 0);
        }
        return debit - credit;
    }, [data]);

    const subledgerTotal = ledgers.reduce((s, l) => s + l.balanceDue, 0);
    const variance = subledgerTotal - glBalance;
    const isReconciled = Math.abs(variance) < 0.01;

    const toggle = (key: string) =>
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    const handleExport = () => {
        if (filtered.length === 0) {
            toast.error('No data to export');
            return;
        }
        exportToCsv(
            `Accounts_Receivable_Ledger_${new Date().toISOString().split('T')[0]}.csv`,
            filtered,
            [
                { header: 'Customer', accessor: r => r.customerName },
                { header: 'Category', accessor: r => r.category },
                { header: 'Route', accessor: r => r.route },
                { header: 'Total Invoiced', accessor: r => r.totalInvoiced },
                { header: 'Total Received', accessor: r => r.totalReceived },
                { header: 'Total Credited', accessor: r => r.totalCredited },
                { header: 'Balance Due', accessor: r => r.balanceDue },
            ]
        );
        toast.success('Exported to CSV successfully');
    };

    // ── "Book (by Slip)" customer statement ─────────────────────────────────────
    const fmtDate = (d: string) => (d || '').slice(0, 10).replace(/-/g, '/');

    const handleStatement = async (ledger: CustomerLedger) => {
        if (stmtFrom > stmtTo) {
            toast.error('Statement "from" date must be before the "to" date');
            return;
        }
        setGenerating(ledger.key);
        try {
            const name = ledger.customerName;
            const customer = data?.customers.find(c => normalizeName(c.name) === ledger.key) ?? { name };

            const [invRes, rcptRes, cnRes] = await Promise.all([
                supabase
                    .from('sales_invoices')
                    .select('id, invoice_number, date, total_amount, status, items:sales_invoice_items(quantity, unit_price, total_price, product:products(name, sku))')
                    .ilike('customer_name', name),
                supabase
                    .from('sales_receipts')
                    .select('id, receipt_number, date, amount, payment_method, status')
                    .ilike('customer_name', name),
                supabase.from('credit_notes').select('*').ilike('customer_name', name),
            ]);
            if (invRes.error) throw invRes.error;
            if (rcptRes.error) throw rcptRes.error;
            if (cnRes.error) throw cnRes.error;

            const invoices = (invRes.data || []).filter(i => {
                const s = (i.status || '').trim().toUpperCase();
                return s !== 'DRAFT' && s !== 'CANCELLED' && Number(i.total_amount) > 0;
            });
            const receipts = (rcptRes.data || []).filter(r => {
                const s = (r.status || '').trim().toUpperCase();
                return s !== 'VOID' && s !== 'CANCELLED' && Number(r.amount) > 0;
            });
            const creditNotes = (cnRes.data || []).filter((cn: any) => {
                const s = (cn.status || '').trim().toUpperCase();
                const amt = Number(cn.amount ?? cn.original_amount ?? cn.total_amount) || 0;
                return s !== 'DRAFT' && s !== 'CANCELLED' && s !== 'VOID' && amt > 0;
            });

            // Beginning balance = net receivable movement strictly before the period start.
            const before = (d: string) => (d || '') < stmtFrom;
            const inPeriod = (d: string) => (d || '') >= stmtFrom && (d || '') <= stmtTo;

            let beginning = 0;
            invoices.forEach(i => { if (before(i.date)) beginning += Number(i.total_amount) || 0; });
            receipts.forEach(r => { if (before(r.date)) beginning -= Number(r.amount) || 0; });
            creditNotes.forEach((cn: any) => { if (before(cn.date)) beginning -= Number(cn.amount ?? cn.original_amount ?? cn.total_amount) || 0; });

            // Period events, sorted by date
            type Ev =
                | { kind: 'invoice'; date: string; total: number; items: { remark: string; sales: number }[] }
                | { kind: 'receipt'; date: string; amount: number; remark: string }
                | { kind: 'credit'; date: string; amount: number; remark: string };

            const events: Ev[] = [];
            invoices.forEach(i => {
                if (!inPeriod(i.date)) return;
                const items = (i.items || []).map((it: any) => {
                    const prod = it.product?.name ?? 'Item';
                    const qty = Number(it.quantity) || 0;
                    const price = Number(it.unit_price) || 0;
                    const line = Number(it.total_price) || qty * price;
                    return { remark: `${prod} / ${qty.toLocaleString('en-GB')} * ${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sales: line };
                });
                events.push({ kind: 'invoice', date: i.date, total: Number(i.total_amount) || 0, items });
            });
            receipts.forEach(r => {
                if (!inPeriod(r.date)) return;
                const parts = ['Payment received', r.payment_method ? `(${r.payment_method})` : '', r.receipt_number ? `- ${r.receipt_number}` : ''];
                events.push({ kind: 'receipt', date: r.date, amount: Number(r.amount) || 0, remark: parts.filter(Boolean).join(' ') });
            });
            creditNotes.forEach((cn: any) => {
                if (!inPeriod(cn.date)) return;
                const amt = Number(cn.amount ?? cn.original_amount ?? cn.total_amount) || 0;
                const ref = cn.credit_note_number ?? cn.cn_number ?? '';
                events.push({ kind: 'credit', date: cn.date, amount: amt, remark: `CREDIT NOTE ${ref}`.trim() });
            });
            events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            // Build display rows, grouped by month with sub-totals
            const rows: StatementRow[] = [{ type: 'beginning', remark: 'Beginning', balance: beginning }];
            let running = beginning;
            let ytdSales = 0, ytdReceipt = 0;
            let curMonth = '';
            let monthSales = 0, monthReceipt = 0;

            const flushMonth = () => {
                if (!curMonth) return;
                rows.push({ type: 'subtotal', remark: `${curMonth.replace('-', '/')} Sub Total`, sales: monthSales, receipt: monthReceipt });
            };

            for (const ev of events) {
                const month = (ev.date || '').slice(0, 7);
                if (month !== curMonth) {
                    flushMonth();
                    curMonth = month;
                    monthSales = 0;
                    monthReceipt = 0;
                }
                if (ev.kind === 'invoice') {
                    running += ev.total;
                    monthSales += ev.total;
                    ytdSales += ev.total;
                    rows.push({ type: 'invoice', date: fmtDate(ev.date), remark: '', sales: ev.total, balance: running });
                    ev.items.forEach(it => rows.push({ type: 'item', remark: it.remark, sales: it.sales }));
                } else {
                    running -= ev.amount;
                    monthReceipt += ev.amount;
                    ytdReceipt += ev.amount;
                    rows.push({ type: 'receipt', date: fmtDate(ev.date), remark: ev.remark, receipt: ev.amount, balance: running });
                }
            }
            flushMonth();
            rows.push({ type: 'ytd', remark: 'Year-to-Date Total', sales: ytdSales, receipt: ytdReceipt, balance: running });

            const generatedAt = new Date().toLocaleString('en-GB', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
            }).replace(',', '');

            setStatement({
                customer,
                rows,
                period: { from: fmtDate(stmtFrom), to: fmtDate(stmtTo) },
                generatedAt,
            });

            setTimeout(async () => {
                await generatePDF('printable-customer-ledger', `Statement_${name.replace(/\s+/g, '_')}_${stmtFrom}_${stmtTo}`);
                setStatement(null);
                setGenerating(null);
            }, 500);
        } catch (err: any) {
            toast.error('Failed to generate statement: ' + err.message);
            setGenerating(null);
        }
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Accounts Receivable Ledger"
                subtitle="Independent, customer-level subsidiary ledger — reconciled against the General Ledger control account"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'A/R Ledger' },
                ]}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '6px 12px', borderRadius: 8 }} title="Statement period">
                            <Calendar size={14} color="var(--slate-400)" />
                            <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }} />
                            <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>–</span>
                            <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }} />
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
                    { label: 'Sales Invoices', href: '/sales/invoices' },
                    { label: 'Sales Receipts', href: '/sales/receipts' },
                    { label: 'Credit Notes', href: '/sales/credit-notes' },
                    { label: 'General Ledger', href: '/accounting/ledger' },
                    { label: 'A/P Ledger', href: '/accounting/ap-ledger' },
                    { label: 'A/R Aging', href: '/accounting/ar-aging' },
                ].map(l => (
                    <Link key={l.href} href={l.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={11} /> {l.label}
                    </Link>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Receivable (Subledger)" value={formatCurrency(subledgerTotal)} icon={<Users size={20} />} color="blue" />
                <StatCard title="Accounts Receivable (GL)" value={formatCurrency(glBalance)} icon={<Scale size={20} />} color="purple" />
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
                        The customer subledger total ({formatCurrency(subledgerTotal)}) does not match the
                        Accounts Receivable balance in the General Ledger ({formatCurrency(glBalance)}). This usually means an
                        invoice, receipt or credit note was posted to the GL without a matching source document, or vice versa.
                    </span>
                </div>
            )}

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '8px 14px', borderRadius: 8, marginBottom: 16, maxWidth: 360 }}>
                <Search size={14} color="var(--slate-400)" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search customer..."
                    style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: '100%' }}
                />
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Loading ledger…</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>No outstanding or historical customer balances found.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(ledger => {
                        const isOpen = expanded.has(ledger.key);
                        return (
                            <div key={ledger.key} style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                    onClick={() => toggle(ledger.key)}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                    <span style={{ color: 'var(--slate-400)', flexShrink: 0 }}>
                                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </span>
                                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--slate-800)' }}>{ledger.customerName}</span>
                                    {ledger.category && (
                                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', background: 'var(--slate-100)', padding: '2px 10px', borderRadius: 20 }}>
                                            {ledger.category}
                                        </span>
                                    )}
                                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>INVOICED</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{formatCurrency(ledger.totalInvoiced)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>RECEIVED</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{formatCurrency(ledger.totalReceived)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 140 }}>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}>BALANCE DUE</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: ledger.balanceDue > 0 ? '#b91c1c' : '#15803d' }}>
                                            {formatCurrency(Math.abs(ledger.balanceDue))}
                                            {ledger.balanceDue < 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>(Cr)</span>}
                                        </div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleStatement(ledger)}
                                    disabled={generating === ledger.key}
                                    title="Download customer statement (Book by Slip)"
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 16px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 600, color: generating === ledger.key ? 'var(--slate-400)' : 'var(--primary-600)', cursor: generating === ledger.key ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                                >
                                    {generating === ledger.key
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : <Printer size={14} />}
                                    Statement
                                </button>
                                </div>

                                {isOpen && (
                                    <div style={{ borderTop: '1px solid var(--slate-100)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 1fr 110px 110px 130px', gap: 8, padding: '8px 20px', background: 'var(--slate-50)', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            <span>Date</span>
                                            <span>Reference</span>
                                            <span>Description</span>
                                            <span style={{ textAlign: 'right' }}>Invoiced</span>
                                            <span style={{ textAlign: 'right' }}>Received</span>
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
                                                <span style={{ textAlign: 'right', fontWeight: 600, color: line.debit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 600, color: line.credit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                                                </span>
                                                <span style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, color: line.runningBalance < 0 ? '#15803d' : '#b91c1c' }}>
                                                    {formatCurrency(Math.abs(line.runningBalance))}
                                                    {line.runningBalance < 0 && <span style={{ fontSize: 9, marginLeft: 3 }}>Cr</span>}
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

            {/* Hidden printable statement — rendered off-screen for PDF capture */}
            {statement && (
                <PrintableCustomerLedger
                    customer={statement.customer}
                    period={statement.period}
                    rows={statement.rows}
                    generatedAt={statement.generatedAt}
                />
            )}
        </div>
    );
}
