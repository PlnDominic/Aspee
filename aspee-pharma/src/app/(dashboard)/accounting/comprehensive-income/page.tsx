'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Calendar, Printer, Save, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import Link from 'next/link';

interface LedgerEntry {
    source: string;
    date: string;
    account_name: string;
    debit: number;
    credit: number;
    description: string;
    type: string;
    subtype: string;
    code: string;
}

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
    subtype: string;
}

// Manual overrides keyed by line item
type Overrides = Record<string, number>;

export default function ComprehensiveIncomePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [showBreakdown, setShowBreakdown] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [overrides, setOverrides] = useState<Overrides>({});
    const [invoiceRevenue, setInvoiceRevenue] = useState<number>(0);

    useEffect(() => {
        fetchReportData();
        fetchAccounts();
        fetchInvoiceRevenue();
    }, [startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_ledgers')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);
            if (error) throw error;
            setEntries(data || []);
        } catch (error: any) {
            toast.error('Failed to load report data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoiceRevenue = async () => {
        try {
            const { data, error } = await supabase
                .from('sales_invoices')
                .select('total_amount, status')
                .gte('date', startDate)
                .lte('date', endDate)
                .neq('status', 'DRAFT')
                .neq('status', 'draft');
            if (error) throw error;
            const total = (data || []).reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
            setInvoiceRevenue(total);
        } catch {
            // non-fatal — revenue will fall back to ledger
        }
    };

    const fetchAccounts = async () => {
        const { data } = await supabase.from('chart_of_accounts').select('id, code, name, type, subtype').eq('is_active', true);
        setAccounts(data || []);
    };

    // --- Calculations from ledger ---
    const revenueEntries = entries.filter(e => e.type === 'Revenue' && e.subtype !== 'Other Income');
    const cosEntries = entries.filter(e => e.subtype?.includes('Cost of Sales'));
    const adminEntries = entries.filter(e => e.subtype?.startsWith('S&A') && !e.subtype.includes('Financial'));
    const financeEntries = entries.filter(e => e.subtype?.includes('Financial'));
    const taxEntries = entries.filter(e => e.subtype?.includes('Tax'));

    const getLedgerValue = (key: string, ledgerAmount: number) => 
        overrides[key] !== undefined ? overrides[key] : ledgerAmount;

    const ledgerRevenue = invoiceRevenue > 0
        ? invoiceRevenue
        : revenueEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
    const ledgerCOS = cosEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const ledgerAdmin = adminEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const ledgerFinance = financeEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const ledgerTax = taxEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    const totalRevenue = getLedgerValue('revenue', ledgerRevenue);
    const totalCOS = getLedgerValue('cos', ledgerCOS);
    const grossProfit = totalRevenue - totalCOS;
    const totalAdmin = getLedgerValue('admin', ledgerAdmin);
    const profitFromOps = grossProfit - totalAdmin;
    const totalFinance = getLedgerValue('finance', ledgerFinance);
    const profitBeforeTax = profitFromOps - totalFinance;
    const totalTax = getLedgerValue('tax', ledgerTax);
    const netProfit = profitBeforeTax - totalTax;

    const handleOverride = (key: string, value: string) => {
        const num = parseFloat(value);
        setOverrides(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    };

    const saveAdjustments = async () => {
        if (Object.keys(overrides).length === 0) {
            toast.info('No adjustments to save');
            return;
        }

        setSaving(true);
        try {
            const adjustments: { key: string; amount: number; ledger: number; accountName: string }[] = [];

            const checkOverride = (key: string, ledger: number, accountName: string) => {
                if (overrides[key] !== undefined && Math.abs(overrides[key] - ledger) > 0.01) {
                    adjustments.push({ key, amount: overrides[key] - ledger, ledger, accountName });
                }
            };

            checkOverride('revenue', ledgerRevenue, 'Sales - Finished goods');
            checkOverride('cos', ledgerCOS, 'Cost of finished goods sold');
            checkOverride('admin', ledgerAdmin, 'Misc. expenses (S&A)');
            checkOverride('finance', ledgerFinance, 'Bank Charges');
            checkOverride('tax', ledgerTax, 'Income taxes (Current Year)');

            for (const adj of adjustments) {
                const debitAcc = adj.amount > 0 
                    ? accounts.find(a => a.name === adj.accountName)?.name || adj.accountName
                    : 'Cash for Expenses';
                const creditAcc = adj.amount > 0 
                    ? 'Cash for Expenses'
                    : accounts.find(a => a.name === adj.accountName)?.name || adj.accountName;

                const now = new Date();
                const entryNum = `ADJ-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

                const { error } = await supabase.from('journal_entries').insert({
                    entry_number: entryNum,
                    date: endDate,
                    description: `Statement adjustment: ${adj.key} (${adj.amount > 0 ? '+' : ''}${adj.amount.toFixed(2)})`,
                    ref_type: 'Adjustment',
                    debit_account: debitAcc,
                    debit_amount: Math.abs(adj.amount),
                    credit_account: creditAcc,
                    credit_amount: Math.abs(adj.amount),
                    created_by: 'Accountant',
                    notes: `Manual override from Statement of Comprehensive Income`,
                });
                if (error) throw error;
            }

            toast.success(`${adjustments.length} adjustment(s) saved as journal entries`);
            setOverrides({});
            setEditMode(false);
            fetchReportData();
            fetchInvoiceRevenue();
        } catch (error: any) {
            toast.error('Failed to save: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => window.print();

    const fmt = (v: number) => formatCurrency(v).replace('GHS', '').trim();

    const EditableCell = ({ fieldKey, ledgerValue, isSubtract }: { fieldKey: string; ledgerValue: number; isSubtract?: boolean }) => {
        const currentVal = getLedgerValue(fieldKey, ledgerValue);
        const isOverridden = overrides[fieldKey] !== undefined && Math.abs(overrides[fieldKey] - ledgerValue) > 0.01;
        const [localVal, setLocalVal] = useState<string>(String(currentVal));

        useEffect(() => {
            setLocalVal(String(getLedgerValue(fieldKey, ledgerValue)));
        }, [editMode, ledgerValue]);

        if (!editMode) {
            return (
                <span style={{ color: isOverridden ? 'var(--primary-600)' : 'inherit' }}>
                    {isSubtract ? `(${fmt(currentVal)})` : fmt(currentVal)}
                </span>
            );
        }

        return (
            <input
                type="number"
                step="0.01"
                value={localVal}
                onChange={(e) => setLocalVal(e.target.value)}
                onBlur={() => handleOverride(fieldKey, localVal)}
                style={{
                    width: 120,
                    padding: '4px 8px',
                    border: isOverridden ? '2px solid var(--primary-500)' : '1px solid var(--slate-300)',
                    borderRadius: 6,
                    fontSize: 12,
                    textAlign: 'right',
                    outline: 'none',
                    background: isOverridden ? '#eff6ff' : '#fff',
                    fontWeight: 600,
                }}
            />
        );
    };

    const BreakdownSection = ({ title, entries: sectionEntries, onClose }: { title: string; entries: LedgerEntry[]; onClose: () => void }) => {
        const accs = Array.from(new Set(sectionEntries.map(e => e.account_name)));
        return (
            <div className="animate-fade-in" style={{ marginTop: 40, border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                <div style={{ padding: '12px 20px', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700 }}>Note Breakdown: {title}</h4>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Link href="/accounting/journal" style={{ fontSize: 11, color: 'var(--primary-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={12} /> View in Journal
                        </Link>
                        <button onClick={onClose} style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Close</button>
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                            <th style={{ padding: '8px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)' }}>ACCOUNT</th>
                            <th style={{ padding: '8px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)' }}>SOURCE</th>
                            <th style={{ padding: '8px 20px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)' }}>AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accs.map(acc => {
                            const accEntries = sectionEntries.filter(e => e.account_name === acc);
                            const amount = accEntries.reduce((sum, e) => sum + (e.type === 'Revenue' ? (e.credit - e.debit) : (e.debit - e.credit)), 0);
                            if (amount === 0) return null;
                            const sources = Array.from(new Set(accEntries.map(e => e.source)));
                            return (
                                <tr key={acc} style={{ borderBottom: '1px solid var(--slate-50)' }}>
                                    <td style={{ padding: '10px 20px', fontSize: 11 }}>{acc}</td>
                                    <td style={{ padding: '10px 20px', fontSize: 10 }}>
                                        {sources.map(s => (
                                            <span key={s} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, marginRight: 4, background: s === 'Expense' ? '#fef2f2' : s === 'Sales' ? '#f0fdf4' : '#f0f9ff', color: s === 'Expense' ? '#b91c1c' : s === 'Sales' ? '#15803d' : '#0369a1', border: '1px solid' }}>
                                                {s}
                                            </span>
                                        ))}
                                    </td>
                                    <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{formatCurrency(amount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div style={{ padding: 20 }}>
            <div className="no-print">
                <PageHeader
                    title="Comprehensive Income"
                    subtitle="Statement of Comprehensive Income"
                    actions={
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--slate-200)', padding: '4px 12px', borderRadius: 8 }}>
                                <Calendar size={14} color="var(--slate-400)" />
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none' }} />
                                <span>-</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none' }} />
                            </div>
                            {editMode ? (
                                <>
                                    <button onClick={() => { setEditMode(false); setOverrides({}); }} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--slate-300)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={saveAdjustments} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--primary-600)', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                        <Save size={16} /> {saving ? 'Saving...' : 'Save Adjustments'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setEditMode(true)} style={{ padding: '10px 20px', background: '#fff', border: '1px solid var(--primary-400)', color: 'var(--primary-600)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                        Edit Values
                                    </button>
                                    <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--slate-900)', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                        <Printer size={16} /> Print
                                    </button>
                                </>
                            )}
                        </div>
                    }
                />

                {editMode && (
                    <div style={{ margin: '16px 0', padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af' }}>
                        <strong>Edit Mode:</strong> Type new values directly into the amount fields. Changes will be saved as adjustment journal entries, keeping your books balanced and traceable.
                    </div>
                )}

                {/* CONNECTED LINKS */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Journal Entries', href: '/accounting/journal' },
                        { label: 'Expenses', href: '/accounting/expenses' },
                        { label: 'Invoices (Sales)', href: '/sales/invoices' },
                        { label: 'Purchase Orders', href: '/purchasing/purchase-orders' },
                        { label: 'Payroll', href: '/accounting/payroll' },
                        { label: 'Tax Periods', href: '/accounting/tax' },
                    ].map(link => (
                        <Link key={link.href} href={link.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                            <ExternalLink size={11} /> {link.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* FORMAL STATEMENT */}
            <div style={{ background: '#fff', maxWidth: 850, margin: '0 auto', padding: '80px 100px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: '1056px', position: 'relative', color: '#000' }}>
                <div style={{ textAlign: 'center', marginBottom: 60 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, textDecoration: 'underline', marginBottom: 10, letterSpacing: '0.05em' }}>ASPEE PHARMACEUTICALS LIMITED</h1>
                    <h2 style={{ fontSize: 18, fontWeight: 700, textDecoration: 'underline', marginBottom: 40 }}>STATEMENT OF COMPREHENSIVE INCOME</h2>
                    <h3 style={{ fontSize: 14, fontWeight: 800, textDecoration: 'underline' }}>NOTES</h3>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 80, paddingRight: 20, marginBottom: 10, borderBottom: '2px solid #000' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        {/* Revenue */}
                        <tr style={{ height: 45 }}>
                            <td style={{ padding: '0 10px', fontSize: 13, fontWeight: 400 }}>Revenue</td>
                            <td></td>
                            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}><EditableCell fieldKey="revenue" ledgerValue={ledgerRevenue} /></td>
                            <td></td>
                        </tr>
                        {/* Cost of Sales */}
                        <tr style={{ height: 45 }}>
                            <td style={{ padding: '0 10px', fontSize: 13 }}>-Cost of Sales</td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>
                                <Link href="/accounting/notes" style={{ color: 'var(--primary-600)', fontWeight: 700 }}>4</Link>
                            </td>
                            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}><EditableCell fieldKey="cos" ledgerValue={ledgerCOS} isSubtract /></td>
                            <td></td>
                        </tr>
                        {/* Gross Profit */}
                        <tr style={{ height: 45, borderBottom: '2px solid #000' }}>
                            <td style={{ padding: '0 10px', fontSize: 13, fontWeight: 700 }}>Gross Profit</td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 13, fontWeight: 700 }}>{fmt(grossProfit)}</td>
                        </tr>
                        {/* Admin Expenses */}
                        <tr style={{ height: 45 }}>
                            <td style={{ padding: '0 10px', fontSize: 13 }}>+Admin. & Gen. Exps</td>
                            <td style={{ textAlign: 'center', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary-600)' }} onClick={() => setShowBreakdown(showBreakdown === 'admin' ? null : 'admin')}>3</td>
                            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}><EditableCell fieldKey="admin" ledgerValue={ledgerAdmin} isSubtract /></td>
                            <td></td>
                        </tr>
                        {/* Profit from Operations */}
                        <tr style={{ height: 45, borderBottom: '2px solid #000' }}>
                            <td style={{ padding: '0 10px', fontSize: 13, fontWeight: 700 }}>Profit from Operations</td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 13, fontWeight: 700 }}>{fmt(profitFromOps)}</td>
                        </tr>
                        {/* Finance Cost */}
                        <tr style={{ height: 45 }}>
                            <td style={{ padding: '0 10px', fontSize: 13 }}>-Finance Cost</td>
                            <td style={{ textAlign: 'center', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary-600)' }} onClick={() => setShowBreakdown(showBreakdown === 'finance' ? null : 'finance')}>4</td>
                            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}><EditableCell fieldKey="finance" ledgerValue={ledgerFinance} isSubtract /></td>
                            <td></td>
                        </tr>
                        {/* Profit Before Tax */}
                        <tr style={{ height: 45, borderBottom: '2px solid #000' }}>
                            <td style={{ padding: '0 10px', fontSize: 13, fontWeight: 700 }}>Profit Before Tax</td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 13, fontWeight: 700 }}>{fmt(profitBeforeTax)}</td>
                        </tr>
                        {/* Tax */}
                        <tr style={{ height: 45 }}>
                            <td style={{ padding: '0 10px', fontSize: 13 }}>-Tax Provision</td>
                            <td></td>
                            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}><EditableCell fieldKey="tax" ledgerValue={ledgerTax} isSubtract /></td>
                            <td></td>
                        </tr>
                        <tr style={{ height: 10 }}></tr>
                        {/* Net Profit */}
                        <tr style={{ height: 50, borderTop: '3px double #000', borderBottom: '3px double #000' }}>
                            <td style={{ padding: '0 10px', fontSize: 14, fontWeight: 800 }}>Profit for the Period</td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 14, fontWeight: 800 }}>{fmt(netProfit)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Note breakdowns */}
                <div className="no-print">
                    {showBreakdown === 'cos' && <BreakdownSection title="Cost of Sales (Note 2)" entries={cosEntries} onClose={() => setShowBreakdown(null)} />}
                    {showBreakdown === 'admin' && <BreakdownSection title="Admin. & Gen. Exps (Note 3)" entries={adminEntries} onClose={() => setShowBreakdown(null)} />}
                    {showBreakdown === 'finance' && <BreakdownSection title="Finance Cost (Note 4)" entries={financeEntries} onClose={() => setShowBreakdown(null)} />}
                </div>

                <div style={{ marginTop: 100, display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', width: 200, marginTop: 40, marginBottom: 10 }}></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>MANAGING DIRECTOR</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', width: 200, marginTop: 40, marginBottom: 10 }}></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>FINANCE MANAGER</span>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .main-content { padding: 0 !important; margin: 0 !important; }
                    aside { display: none !important; }
                    header { display: none !important; }
                    input[type="number"] { border: none !important; background: transparent !important; }
                }
            `}</style>
        </div>
    );
}
