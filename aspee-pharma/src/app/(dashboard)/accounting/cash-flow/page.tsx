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

type Overrides = Record<string, number>;

export default function CashFlowStatementPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [editMode, setEditMode] = useState(false);
    const [overrides, setOverrides] = useState<Overrides>({});

    // Also fetch beginning-of-period balances for the Analysis section
    const [beginEntries, setBeginEntries] = useState<LedgerEntry[]>([]);

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // Period entries for the cash flow
            const { data, error } = await supabase
                .from('financial_ledgers')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);
            if (error) throw error;
            setEntries(data || []);

            // Cumulative entries up to start date for opening balances
            const { data: beginData } = await supabase
                .from('financial_ledgers')
                .select('*')
                .lt('date', startDate);
            setBeginEntries(beginData || []);
        } catch (error: any) {
            toast.error('Failed to load report data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Helpers ---
    const val = (key: string, ledger: number) => overrides[key] !== undefined ? overrides[key] : ledger;
    const fmt = (v: number) => formatCurrency(v).replace('GHS', '').trim();
    const handleOverride = (key: string, value: string) => {
        const num = parseFloat(value);
        setOverrides(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    };

    // --- Cash Flow Calculations from ledger ---
    // Operating Profit before tax (Revenue - COGS - S&A expenses)
    const revenueEntries = entries.filter(e => e.type === 'Revenue');
    const expenseEntries = entries.filter(e => e.type === 'Expense' && !e.subtype?.includes('Tax'));
    const ledgerOpProfit = revenueEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0) -
                           expenseEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    // Depreciation (contra asset entries)
    const depEntries = entries.filter(e => e.subtype?.includes('Contra'));
    const ledgerDepreciation = depEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);

    // Changes in Stock (Inventory movement for the period)
    const invEntries = entries.filter(e => e.subtype?.includes('Inventory'));
    const ledgerStockChange = invEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    // Changes in Trade Receivables
    const recEntries = entries.filter(e => e.subtype?.includes('Receivables'));
    const ledgerRecChange = recEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    // Changes in Creditors & Accruals
    const credEntries = entries.filter(e => (e.subtype?.includes('Payables') || e.subtype?.includes('Accruals')) && e.type === 'Liability');
    const ledgerCredChange = credEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);

    // Taxation
    const taxEntries = entries.filter(e => e.subtype?.includes('Tax'));
    const ledgerTaxPaid = taxEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    // Capital Expenditure (Fixed Asset purchases)
    const capexEntries = entries.filter(e => e.subtype?.includes('Fixed Asset') && !e.subtype?.includes('Contra'));
    const ledgerCapex = capexEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    // Apply overrides
    const opProfit = val('opProfit', ledgerOpProfit);
    const depreciation = val('depreciation', ledgerDepreciation);
    const stockChange = val('stockChange', ledgerStockChange);
    const recChange = val('recChange', ledgerRecChange);
    const credChange = val('credChange', ledgerCredChange);

    const netCashOps = opProfit + depreciation - stockChange - recChange + credChange;

    const taxPaid = val('taxPaid', ledgerTaxPaid);
    const afterTax = netCashOps - taxPaid;

    const capex = val('capex', ledgerCapex);
    const netCashBeforeFinancing = afterTax - capex;

    // Analysis of Changes in Cash
    const allCashBefore = beginEntries.filter(e => e.subtype?.includes('Cash'));
    const openingCash = allCashBefore.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const closingCash = openingCash + netCashBeforeFinancing;

    // Analysis of Balances (Cash + Overdraft)
    const allEntries = [...beginEntries, ...entries];
    const totalCashBal = allEntries.filter(e => e.subtype?.includes('Cash')).reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const totalOverdraft = allEntries.filter(e => e.subtype?.includes('Overdraft')).reduce((sum, e) => sum + (e.credit - e.debit), 0);

    const saveAdjustments = async () => {
        if (Object.keys(overrides).length === 0) { toast.info('No adjustments to save'); return; }
        setSaving(true);
        try {
            let count = 0;
            for (const [key, override] of Object.entries(overrides)) {
                const ledgerMap: Record<string, number> = {
                    opProfit: ledgerOpProfit, depreciation: ledgerDepreciation,
                    stockChange: ledgerStockChange, recChange: ledgerRecChange,
                    credChange: ledgerCredChange, taxPaid: ledgerTaxPaid, capex: ledgerCapex,
                };
                const diff = override - (ledgerMap[key] ?? 0);
                if (Math.abs(diff) < 0.01) continue;

                const now = new Date();
                const entryNum = `CFA-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

                const { error } = await supabase.from('journal_entries').insert({
                    entry_number: entryNum,
                    date: endDate,
                    description: `Cash flow adjustment: ${key} (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`,
                    ref_type: 'Adjustment',
                    debit_account: 'Cash for Expenses',
                    debit_amount: Math.abs(diff),
                    credit_account: 'Cash from Sales',
                    credit_amount: Math.abs(diff),
                    created_by: 'Accountant',
                    notes: 'Manual override from Cash Flow Statement',
                });
                if (error) throw error;
                count++;
            }
            toast.success(`${count} adjustment(s) saved as journal entries`);
            setOverrides({});
            setEditMode(false);
            fetchReportData();
        } catch (error: any) {
            toast.error('Failed to save: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => window.print();

    const EditableCell = ({ fieldKey, ledgerValue }: { fieldKey: string; ledgerValue: number }) => {
        const v = val(fieldKey, ledgerValue);
        const isOverridden = overrides[fieldKey] !== undefined && Math.abs(overrides[fieldKey] - ledgerValue) > 0.01;
        const [localVal, setLocalVal] = useState<string>(String(v));

        useEffect(() => {
            setLocalVal(String(val(fieldKey, ledgerValue)));
        }, [editMode, ledgerValue]);

        if (!editMode) return <span style={{ color: isOverridden ? 'var(--primary-600)' : 'inherit' }}>{fmt(v)}</span>;
        return (
            <input
                type="number" step="0.01"
                value={localVal}
                onChange={(e) => setLocalVal(e.target.value)}
                onBlur={() => handleOverride(fieldKey, localVal)}
                style={{
                    width: 120, padding: '4px 8px',
                    border: isOverridden ? '2px solid var(--primary-500)' : '1px solid var(--slate-300)',
                    borderRadius: 6, fontSize: 12, textAlign: 'right', outline: 'none',
                    background: isOverridden ? '#eff6ff' : '#fff', fontWeight: 600,
                }}
            />
        );
    };

    const SectionHeader = ({ title }: { title: string }) => (
        <tr style={{ height: 40 }}>
            <td colSpan={4} style={{ padding: '10px 0', fontSize: 13, fontWeight: 800, textDecoration: 'underline' }}>{title}</td>
        </tr>
    );

    const Row = ({ label, fieldKey, ledgerValue, isTotal = false, isBold = false }: any) => (
        <tr style={{ height: 38, borderTop: isTotal ? '1.5px solid #000' : 'none' }}>
            <td style={{ fontSize: 13, fontWeight: isTotal || isBold ? 700 : 400 }}>{label}</td>
            <td></td>
            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}>
                {!isTotal && fieldKey ? <EditableCell fieldKey={fieldKey} ledgerValue={ledgerValue} /> : (!isTotal ? fmt(ledgerValue ?? 0) : '')}
            </td>
            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 13, fontWeight: isTotal || isBold ? 700 : 400 }}>
                {isTotal ? fmt(ledgerValue) : ''}
            </td>
        </tr>
    );

    return (
        <div style={{ padding: 20 }}>
            <div className="no-print">
                <PageHeader
                    title="Cash Flow Statement"
                    subtitle="Operating, investing, and financing cash flows"
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
                                    <button onClick={() => setEditMode(true)} style={{ padding: '10px 20px', background: '#fff', border: '1px solid var(--primary-400)', color: 'var(--primary-600)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit Values</button>
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
                        <strong>Edit Mode:</strong> Type values directly into the fields. Changes are saved as balanced adjustment journal entries.
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Comprehensive Income', href: '/accounting/comprehensive-income' },
                        { label: 'Financial Position', href: '/accounting/financial-position' },
                        { label: 'Journal Entries', href: '/accounting/journal' },
                        { label: 'Expenses', href: '/accounting/expenses' },
                        { label: 'Invoices (Sales)', href: '/sales/invoices' },
                        { label: 'Supplier Payments', href: '/purchasing/payments' },
                    ].map(link => (
                        <Link key={link.href} href={link.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={11} /> {link.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* FORMAL STATEMENT */}
            <div style={{ background: '#fff', maxWidth: 850, margin: '0 auto', padding: '80px 100px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: '1056px', position: 'relative', color: '#000' }}>
                <div style={{ textAlign: 'center', marginBottom: 60 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, textDecoration: 'underline', marginBottom: 10, letterSpacing: '0.05em' }}>ASPEE PHARMACEUTICALS LIMITED</h1>
                    <h2 style={{ fontSize: 18, fontWeight: 700, textDecoration: 'underline', marginBottom: 40 }}>CASH FLOW STATEMENT</h2>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 80, paddingRight: 20, marginBottom: 10, borderBottom: '2px solid #000' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        {/* OPERATING ACTIVITIES */}
                        <Row label="Operating Profit before tax" fieldKey="opProfit" ledgerValue={ledgerOpProfit} />
                        <Row label="Depreciation" fieldKey="depreciation" ledgerValue={ledgerDepreciation} />
                        <Row label="Changes in Stock" fieldKey="stockChange" ledgerValue={ledgerStockChange} />
                        <Row label="Changes in Trade Receivables" fieldKey="recChange" ledgerValue={ledgerRecChange} />
                        <Row label="Changes in Creditors and Accruals" fieldKey="credChange" ledgerValue={ledgerCredChange} />

                        <tr style={{ height: 20 }}></tr>
                        <Row label="Net Cash Inflow from Operating Activities" isTotal ledgerValue={netCashOps} isBold />

                        <tr style={{ height: 30 }}></tr>
                        <SectionHeader title="TAXATION" />
                        <Row label="Corporate Tax Paid" fieldKey="taxPaid" ledgerValue={ledgerTaxPaid} />

                        <tr style={{ height: 30 }}></tr>
                        <SectionHeader title="INVESTING ACTIVITIES" />
                        <Row label="Capital Expenditure" fieldKey="capex" ledgerValue={ledgerCapex} />

                        <tr style={{ height: 20 }}></tr>
                        <Row label="Net Cash Outflow before Financing Activities" isTotal ledgerValue={netCashBeforeFinancing} isBold />

                        {/* ANALYSIS OF CHANGES */}
                        <tr style={{ height: 40 }}></tr>
                        <tr style={{ height: 40 }}>
                            <td colSpan={4} style={{ padding: '10px 0', fontSize: 13, fontWeight: 800, textDecoration: 'underline' }}>
                                Analysis of Changes in Cash and Cash Equivalent during the year
                            </td>
                        </tr>
                        <Row label={`Balance at ${new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`} ledgerValue={openingCash} />
                        <Row label="Net Cash Inflow" ledgerValue={netCashBeforeFinancing} />
                        <Row label={`Balance at ${new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`} isTotal ledgerValue={closingCash} isBold />

                        {/* ANALYSIS OF BALANCES */}
                        <tr style={{ height: 40 }}></tr>
                        <tr style={{ height: 40 }}>
                            <td colSpan={4} style={{ padding: '10px 0', fontSize: 13, fontWeight: 800, textDecoration: 'underline' }}>
                                Analysis of Balances of Cash and Cash Equivalent Shown in the Balance Sheet
                            </td>
                        </tr>
                        <Row label="Cash and Bank Balances" ledgerValue={totalCashBal} />
                        <Row label="Overdraft Balances" ledgerValue={totalOverdraft} />
                    </tbody>
                </table>
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
