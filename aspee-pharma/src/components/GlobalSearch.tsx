'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search, X, Package, Users, FileText, ClipboardList, Truck, ShoppingCart,
    Factory, ShieldCheck, Calculator, Banknote, BookOpen, Coins, CreditCard,
    UserCircle, CalendarDays, AlertTriangle, ClipboardCheck, Boxes, ArrowLeftRight,
    Receipt, BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
}

type ResultType =
    | 'product' | 'stock' | 'transfer'
    | 'customer' | 'invoice' | 'receipt' | 'credit-note' | 'dispatch'
    | 'supplier' | 'po' | 'grn' | 'supplier-payment'
    | 'production' | 'bom' | 'material-request'
    | 'qa-inprocess' | 'qa-finished'
    | 'journal' | 'expense' | 'payroll' | 'petty-cash' | 'tax'
    | 'employee' | 'leave'
    | 'audit-plan' | 'audit-report' | 'ncr'
    | 'van';

type SearchResult = {
    id: string;
    type: ResultType;
    group: string;
    title: string;
    subtitle?: string;
    url: string;
    icon: React.ReactNode;
    color: string;
};

const GROUP_ORDER = [
    'Products & Stock', 'Sales', 'Purchasing', 'Production', 'Quality Assurance',
    'Customers', 'Accounting', 'HR', 'Internal Audit', 'Routes & Vans',
];

// Safe query runner — returns [] on error (e.g. table doesn't exist yet)
async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
    try {
        const { data, error } = await promise;
        if (error) return [];
        return data ?? [];
    } catch {
        return [];
    }
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSelect = useCallback((result: SearchResult) => {
        onClose();
        router.push(result.url);
    }, [onClose, router]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (isOpen) onClose();
                else document.dispatchEvent(new CustomEvent('open-global-search'));
            }
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => Math.min(p + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(p - 1, 0)); }
            else if (e.key === 'Enter' && results.length > 0) { e.preventDefault(); handleSelect(results[selectedIndex]); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex, onClose, handleSelect]);

    useEffect(() => {
        if (isOpen) { setQuery(''); setResults([]); setSelectedIndex(0); setTimeout(() => inputRef.current?.focus(), 100); }
    }, [isOpen]);

    useEffect(() => {
        const t = setTimeout(() => {
            if (query.trim().length >= 2) performSearch(query.trim());
            else { setResults([]); setLoading(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const performSearch = async (q: string) => {
        setLoading(true);
        const s = `%${q}%`;

        const [
            products, customers, invoices, receipts, creditNotes, dispatches,
            suppliers, pos, grns, supplierPayments,
            productions, boms, matRequests,
            qaInProcess, qaFinished,
            journals, expenses, payrolls, pettyCash, taxes,
            employees, leaves,
            auditPlans, auditReports, ncrs,
            vans,
        ] = await Promise.all([
            // Products & Stock
            safeQuery(supabase.from('products').select('id, name, sku').or(`name.ilike.${s},sku.ilike.${s}`).limit(4)),
            // Customers
            safeQuery(supabase.from('customers').select('id, name, phone').ilike('name', s).limit(4)),
            // Sales
            safeQuery(supabase.from('sales_invoices').select('id, invoice_number, customer_name, status').or(`invoice_number.ilike.${s},customer_name.ilike.${s}`).limit(4)),
            safeQuery(supabase.from('sales_receipts').select('id, receipt_number, customer_name').or(`receipt_number.ilike.${s},customer_name.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('credit_notes').select('id, credit_note_number, customer_name').or(`credit_note_number.ilike.${s},customer_name.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('dispatch_orders').select('id, dispatch_number, customer_name').or(`dispatch_number.ilike.${s},customer_name.ilike.${s}`).limit(3)),
            // Purchasing
            safeQuery(supabase.from('suppliers').select('id, name, contact_person').ilike('name', s).limit(4)),
            safeQuery(supabase.from('purchase_orders').select('id, po_number, supplier_name').or(`po_number.ilike.${s},supplier_name.ilike.${s}`).limit(4)),
            safeQuery(supabase.from('goods_receipt_notes').select('id, grn_number, supplier_name').or(`grn_number.ilike.${s},supplier_name.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('supplier_payments').select('id, payment_reference, supplier_name').or(`payment_reference.ilike.${s},supplier_name.ilike.${s}`).limit(3)),
            // Production
            safeQuery(supabase.from('production_orders').select('id, order_number, product_name').or(`order_number.ilike.${s},product_name.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('bill_of_materials').select('id, product_name').ilike('product_name', s).limit(3)),
            safeQuery(supabase.from('material_requests').select('id, request_number, requested_by').or(`request_number.ilike.${s},requested_by.ilike.${s}`).limit(3)),
            // QA
            safeQuery(supabase.from('qa_in_process').select('id, batch_number, product_name').or(`batch_number.ilike.${s},product_name.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('qa_finished_products').select('id, batch_number, product_name').or(`batch_number.ilike.${s},product_name.ilike.${s}`).limit(3)),
            // Accounting
            safeQuery(supabase.from('journal_entries').select('id, entry_number, description').or(`entry_number.ilike.${s},description.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('expenses').select('id, description, category').or(`description.ilike.${s},category.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('payroll').select('id, employee_name, employee_id_number, pay_period').or(`employee_name.ilike.${s},employee_id_number.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('petty_cash').select('id, description, category').or(`description.ilike.${s},category.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('tax_periods').select('id, period_name').ilike('period_name', s).limit(3)),
            // HR
            safeQuery(supabase.from('employees').select('id, full_name, employee_id, department').or(`full_name.ilike.${s},employee_id.ilike.${s},department.ilike.${s}`).limit(4)),
            safeQuery(supabase.from('leave_requests').select('id, employee_name, leave_type').or(`employee_name.ilike.${s},leave_type.ilike.${s}`).limit(3)),
            // Internal Audit
            safeQuery(supabase.from('audit_plans').select('id, title, area').or(`title.ilike.${s},area.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('audit_reports').select('id, report_number, audit_area').or(`report_number.ilike.${s},audit_area.ilike.${s}`).limit(3)),
            safeQuery(supabase.from('non_conformances').select('id, ncr_number, department').or(`ncr_number.ilike.${s},department.ilike.${s}`).limit(3)),
            // Vans
            safeQuery(supabase.from('vans').select('id, name, driver_name').or(`name.ilike.${s},driver_name.ilike.${s}`).limit(3)),
        ]);

        const r: SearchResult[] = [
            // Products & Stock
            ...products.map((p: any) => ({ id: `prod-${p.id}`, type: 'product' as ResultType, group: 'Products & Stock', title: p.name, subtitle: p.sku, url: '/stores/products', icon: <Package size={15} />, color: '#3b82f6' })),
            // Customers
            ...customers.map((c: any) => ({ id: `cust-${c.id}`, type: 'customer' as ResultType, group: 'Customers', title: c.name, subtitle: c.phone, url: '/customers', icon: <Users size={15} />, color: '#10b981' })),
            // Sales
            ...invoices.map((i: any) => ({ id: `inv-${i.id}`, type: 'invoice' as ResultType, group: 'Sales', title: i.invoice_number, subtitle: `Invoice · ${i.customer_name}`, url: '/sales/invoices', icon: <FileText size={15} />, color: '#8b5cf6' })),
            ...receipts.map((r: any) => ({ id: `rec-${r.id}`, type: 'receipt' as ResultType, group: 'Sales', title: r.receipt_number, subtitle: `Receipt · ${r.customer_name}`, url: '/sales/receipts', icon: <Receipt size={15} />, color: '#8b5cf6' })),
            ...creditNotes.map((c: any) => ({ id: `cn-${c.id}`, type: 'credit-note' as ResultType, group: 'Sales', title: c.credit_note_number, subtitle: `Credit Note · ${c.customer_name}`, url: '/sales/credit-notes', icon: <BookOpen size={15} />, color: '#8b5cf6' })),
            ...dispatches.map((d: any) => ({ id: `dis-${d.id}`, type: 'dispatch' as ResultType, group: 'Sales', title: d.dispatch_number, subtitle: `Dispatch · ${d.customer_name}`, url: '/sales/dispatch', icon: <Truck size={15} />, color: '#8b5cf6' })),
            // Purchasing
            ...suppliers.map((s: any) => ({ id: `sup-${s.id}`, type: 'supplier' as ResultType, group: 'Purchasing', title: s.name, subtitle: s.contact_person, url: '/purchasing/suppliers', icon: <Truck size={15} />, color: '#f59e0b' })),
            ...pos.map((p: any) => ({ id: `po-${p.id}`, type: 'po' as ResultType, group: 'Purchasing', title: p.po_number, subtitle: `PO · ${p.supplier_name}`, url: '/purchasing/purchase-orders', icon: <ClipboardList size={15} />, color: '#f59e0b' })),
            ...grns.map((g: any) => ({ id: `grn-${g.id}`, type: 'grn' as ResultType, group: 'Purchasing', title: g.grn_number, subtitle: `GRN · ${g.supplier_name}`, url: '/purchasing/grn', icon: <ShoppingCart size={15} />, color: '#f59e0b' })),
            ...supplierPayments.map((p: any) => ({ id: `sp-${p.id}`, type: 'supplier-payment' as ResultType, group: 'Purchasing', title: p.payment_reference, subtitle: `Payment · ${p.supplier_name}`, url: '/purchasing/payments', icon: <CreditCard size={15} />, color: '#f59e0b' })),
            // Production
            ...productions.map((p: any) => ({ id: `prd-${p.id}`, type: 'production' as ResultType, group: 'Production', title: p.order_number, subtitle: `Job Order · ${p.product_name}`, url: '/production', icon: <Factory size={15} />, color: '#14b8a6' })),
            ...boms.map((b: any) => ({ id: `bom-${b.id}`, type: 'bom' as ResultType, group: 'Production', title: b.product_name, subtitle: 'Bill of Materials', url: '/production/bom', icon: <BarChart3 size={15} />, color: '#14b8a6' })),
            ...matRequests.map((m: any) => ({ id: `mr-${m.id}`, type: 'material-request' as ResultType, group: 'Production', title: m.request_number, subtitle: `Material Request · ${m.requested_by}`, url: '/production/material-requests', icon: <ArrowLeftRight size={15} />, color: '#14b8a6' })),
            // QA
            ...qaInProcess.map((q: any) => ({ id: `qai-${q.id}`, type: 'qa-inprocess' as ResultType, group: 'Quality Assurance', title: q.batch_number, subtitle: `In Process · ${q.product_name}`, url: '/qa/in-process', icon: <ShieldCheck size={15} />, color: '#06b6d4' })),
            ...qaFinished.map((q: any) => ({ id: `qaf-${q.id}`, type: 'qa-finished' as ResultType, group: 'Quality Assurance', title: q.batch_number, subtitle: `Finished · ${q.product_name}`, url: '/qa/finished-products', icon: <ShieldCheck size={15} />, color: '#06b6d4' })),
            // Accounting
            ...journals.map((j: any) => ({ id: `jnl-${j.id}`, type: 'journal' as ResultType, group: 'Accounting', title: j.entry_number, subtitle: j.description, url: '/accounting/journal', icon: <BookOpen size={15} />, color: '#6366f1' })),
            ...expenses.map((e: any) => ({ id: `exp-${e.id}`, type: 'expense' as ResultType, group: 'Accounting', title: e.description, subtitle: e.category, url: '/accounting/expenses', icon: <Banknote size={15} />, color: '#6366f1' })),
            ...payrolls.map((p: any) => ({ id: `pay-${p.id}`, type: 'payroll' as ResultType, group: 'Accounting', title: p.employee_name, subtitle: `Payroll · ${p.pay_period}`, url: '/accounting/payroll', icon: <Users size={15} />, color: '#6366f1' })),
            ...pettyCash.map((p: any) => ({ id: `pc-${p.id}`, type: 'petty-cash' as ResultType, group: 'Accounting', title: p.description, subtitle: p.category, url: '/accounting/petty-cash', icon: <Coins size={15} />, color: '#6366f1' })),
            ...taxes.map((t: any) => ({ id: `tax-${t.id}`, type: 'tax' as ResultType, group: 'Accounting', title: t.period_name, subtitle: 'Tax Period', url: '/accounting/tax', icon: <Calculator size={15} />, color: '#6366f1' })),
            // HR
            ...employees.map((e: any) => ({ id: `emp-${e.id}`, type: 'employee' as ResultType, group: 'HR', title: e.full_name, subtitle: `${e.employee_id} · ${e.department}`, url: '/hr/employees', icon: <UserCircle size={15} />, color: '#ec4899' })),
            ...leaves.map((l: any) => ({ id: `lv-${l.id}`, type: 'leave' as ResultType, group: 'HR', title: l.employee_name, subtitle: `Leave · ${l.leave_type}`, url: '/hr/leave', icon: <CalendarDays size={15} />, color: '#ec4899' })),
            // Internal Audit
            ...auditPlans.map((a: any) => ({ id: `ap-${a.id}`, type: 'audit-plan' as ResultType, group: 'Internal Audit', title: a.title, subtitle: `Audit · ${a.area}`, url: '/internal-audit', icon: <ClipboardCheck size={15} />, color: '#eab308' })),
            ...auditReports.map((a: any) => ({ id: `ar-${a.id}`, type: 'audit-report' as ResultType, group: 'Internal Audit', title: a.report_number, subtitle: `Report · ${a.audit_area}`, url: '/internal-audit/reports', icon: <FileText size={15} />, color: '#eab308' })),
            ...ncrs.map((n: any) => ({ id: `ncr-${n.id}`, type: 'ncr' as ResultType, group: 'Internal Audit', title: n.ncr_number, subtitle: `NCR · ${n.department}`, url: '/internal-audit/non-conformances', icon: <AlertTriangle size={15} />, color: '#eab308' })),
            // Vans
            ...vans.map((v: any) => ({ id: `van-${v.id}`, type: 'van' as ResultType, group: 'Routes & Vans', title: v.name, subtitle: v.driver_name, url: '/routes', icon: <Truck size={15} />, color: '#06b6d4' })),
        ];

        setResults(r);
        setSelectedIndex(0);
        setLoading(false);
    };

    // Group results preserving GROUP_ORDER
    const grouped = GROUP_ORDER.reduce<Record<string, SearchResult[]>>((acc, g) => {
        const items = results.filter(r => r.group === g);
        if (items.length > 0) acc[g] = items;
        return acc;
    }, {});

    // Flat index map for keyboard navigation
    const flatResults = Object.values(grouped).flat();

    if (!isOpen) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}
            onClick={onClose}
        >
            <div
                style={{ width: '100%', maxWidth: 620, backgroundColor: 'var(--card-bg)', borderRadius: 14, boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Input */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', gap: 10 }}>
                    <Search size={18} color="var(--slate-400)" style={{ flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search across all modules…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--slate-800)', background: 'transparent' }}
                    />
                    {query && (
                        <button onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                            <X size={15} color="var(--slate-400)" />
                        </button>
                    )}
                    <kbd style={{ fontSize: 10, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, color: 'var(--slate-500)', flexShrink: 0 }}>ESC</kbd>
                </div>

                {/* Results */}
                <div style={{ maxHeight: 460, overflowY: 'auto', padding: '6px 0' }}>
                    {loading && results.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Searching…</div>
                    ) : query.length > 0 && query.length < 2 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>Type at least 2 characters</div>
                    ) : flatResults.length > 0 ? (
                        Object.entries(grouped).map(([group, items]) => (
                            <div key={group}>
                                {/* Group header */}
                                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-400)' }}>
                                    {group}
                                </div>
                                {items.map(result => {
                                    const flatIdx = flatResults.indexOf(result);
                                    const isSelected = flatIdx === selectedIndex;
                                    return (
                                        <div
                                            key={result.id}
                                            onClick={() => handleSelect(result)}
                                            onMouseEnter={() => setSelectedIndex(flatIdx)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', backgroundColor: isSelected ? 'var(--slate-50)' : 'transparent', borderLeft: `3px solid ${isSelected ? result.color : 'transparent'}`, transition: 'all 0.1s' }}
                                        >
                                            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${result.color}18`, border: `1px solid ${result.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: result.color, flexShrink: 0 }}>
                                                {result.icon}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.title}</p>
                                                {result.subtitle && <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.subtitle}</p>}
                                            </div>
                                            {isSelected && <span style={{ fontSize: 10, color: 'var(--slate-400)', flexShrink: 0 }}>↵</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    ) : query.length >= 2 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>No results for "<strong>{query}</strong>"</div>
                    ) : (
                        /* Empty state — show all searchable modules */
                        <div style={{ padding: '12px 16px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Search across all modules</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                {[
                                    { label: 'Products', icon: <Package size={13} />, color: '#3b82f6' },
                                    { label: 'Customers', icon: <Users size={13} />, color: '#10b981' },
                                    { label: 'Invoices', icon: <FileText size={13} />, color: '#8b5cf6' },
                                    { label: 'Receipts', icon: <Receipt size={13} />, color: '#8b5cf6' },
                                    { label: 'Purchase Orders', icon: <ClipboardList size={13} />, color: '#f59e0b' },
                                    { label: 'Suppliers', icon: <Truck size={13} />, color: '#f59e0b' },
                                    { label: 'GRN', icon: <ShoppingCart size={13} />, color: '#f59e0b' },
                                    { label: 'Production', icon: <Factory size={13} />, color: '#14b8a6' },
                                    { label: 'QA', icon: <ShieldCheck size={13} />, color: '#06b6d4' },
                                    { label: 'Payroll', icon: <Users size={13} />, color: '#6366f1' },
                                    { label: 'Expenses', icon: <Banknote size={13} />, color: '#6366f1' },
                                    { label: 'Employees', icon: <UserCircle size={13} />, color: '#ec4899' },
                                    { label: 'Leave', icon: <CalendarDays size={13} />, color: '#ec4899' },
                                    { label: 'Audit Plans', icon: <ClipboardCheck size={13} />, color: '#eab308' },
                                    { label: 'NCRs', icon: <AlertTriangle size={13} />, color: '#eab308' },
                                ].map(m => (
                                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: `${m.color}0f`, borderRadius: 7, fontSize: 12, color: 'var(--slate-600)', border: `1px solid ${m.color}20` }}>
                                        <span style={{ color: m.color }}>{m.icon}</span> {m.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--slate-100)', background: 'var(--slate-50)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--slate-500)' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                        {[['↑', '↓', 'navigate'], ['↵', '', 'select']].map(([a, b, label]) => (
                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <kbd style={{ padding: '2px 5px', background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 4 }}>{a}</kbd>
                                {b && <kbd style={{ padding: '2px 5px', background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 4 }}>{b}</kbd>}
                                {label}
                            </span>
                        ))}
                    </div>
                    {flatResults.length > 0 && (
                        <span>{flatResults.length} result{flatResults.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
