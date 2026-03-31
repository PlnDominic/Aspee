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

type Overrides = Record<string, number>;

export default function FinancialPositionPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [editMode, setEditMode] = useState(false);
    const [overrides, setOverrides] = useState<Overrides>({});

    useEffect(() => {
        fetchReportData();
        fetchAccounts();
    }, [endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_ledgers')
                .select('*')
                .lte('date', endDate);
            if (error) throw error;
            setEntries(data || []);
        } catch (error: any) {
            toast.error('Failed to load report data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        const { data } = await supabase.from('chart_of_accounts').select('id, code, name, type, subtype').eq('is_active', true);
        setAccounts(data || []);
    };

    // --- Asset Calculations ---
    const getAssetTotal = (subtypeMatch: string) =>
        entries.filter(e => e.type === 'Asset' && e.subtype?.includes(subtypeMatch)).reduce((sum, e) => sum + (e.debit - e.credit), 0);

    const getLiabilityTotal = (subtypeMatch: string) =>
        entries.filter(e => e.type === 'Liability' && e.subtype?.includes(subtypeMatch)).reduce((sum, e) => sum + (e.credit - e.debit), 0);

    const getEquityByName = (nameMatch: string) =>
        entries.filter(e => e.type === 'Equity' && e.account_name.toLowerCase().includes(nameMatch.toLowerCase())).reduce((sum, e) => sum + (e.credit - e.debit), 0);

    // Ledger values
    const ledgerPPE = getAssetTotal('Fixed Asset') + getAssetTotal('Intangible');
    const ledgerInventories = getAssetTotal('Inventory');
    const ledgerReceivables = getAssetTotal('Receivables');
    const ledgerCash = getAssetTotal('Cash');

    const ledgerStatedCapital = getEquityByName('Capital');
    const ledgerShareDeposit = getEquityByName('Shares Deposit');
    const revenueEntries = entries.filter(e => e.type === 'Revenue');
    const expenseEntries = entries.filter(e => e.type === 'Expense');
    const netProfit = revenueEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0) -
                    expenseEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const ledgerIncomeSurplus = getEquityByName('Surplus') + getEquityByName('Retained Earnings') + netProfit;
    const ledgerDirectors = getEquityByName('Directors') + getAssetTotal('Director Current');

    const ledgerTradeCreditors = getLiabilityTotal('Payables') + getLiabilityTotal('Accruals');
    const ledgerTaxation = getLiabilityTotal('Taxes');
    const ledgerOverdraft = getLiabilityTotal('Overdraft');

    // Apply overrides
    const val = (key: string, ledger: number) => overrides[key] !== undefined ? overrides[key] : ledger;

    const ppe = val('ppe', ledgerPPE);
    const inventories = val('inventories', ledgerInventories);
    const receivables = val('receivables', ledgerReceivables);
    const cash = val('cash', ledgerCash);
    const totalAssets = ppe + inventories + receivables + cash;

    const statedCapital = val('statedCapital', ledgerStatedCapital);
    const shareDeposit = val('shareDeposit', ledgerShareDeposit);
    const incomeSurplus = val('incomeSurplus', ledgerIncomeSurplus);
    const directors = val('directors', ledgerDirectors);
    const totalEquity = statedCapital + shareDeposit + incomeSurplus + directors;

    const tradeCreditors = val('tradeCreditors', ledgerTradeCreditors);
    const taxation = val('taxation', ledgerTaxation);
    const overdraft = val('overdraft', ledgerOverdraft);
    const totalLiabilities = tradeCreditors + taxation + overdraft;

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
            const adjustmentMap: Record<string, { ledger: number; debitAcc: string; creditAcc: string }> = {
                ppe: { ledger: ledgerPPE, debitAcc: 'Buildings', creditAcc: 'Cash for Expenses' },
                inventories: { ledger: ledgerInventories, debitAcc: 'Inventories', creditAcc: 'Cash for Expenses' },
                receivables: { ledger: ledgerReceivables, debitAcc: 'Accounts receivable', creditAcc: 'Cash for Expenses' },
                cash: { ledger: ledgerCash, debitAcc: 'Cash from Sales', creditAcc: 'Accounts receivable' },
                statedCapital: { ledger: ledgerStatedCapital, debitAcc: 'Cash from Sales', creditAcc: 'Capital Stated' },
                shareDeposit: { ledger: ledgerShareDeposit, debitAcc: 'Cash from Sales', creditAcc: 'Shares Deposit' },
                incomeSurplus: { ledger: ledgerIncomeSurplus, debitAcc: 'Cash from Sales', creditAcc: 'Appropriated Retained Earnings (Income Surplus)' },
                directors: { ledger: ledgerDirectors, debitAcc: 'Director Current Account', creditAcc: 'Cash for Expenses' },
                tradeCreditors: { ledger: ledgerTradeCreditors, debitAcc: 'Cash for Expenses', creditAcc: 'Accounts payable' },
                taxation: { ledger: ledgerTaxation, debitAcc: 'Cash for Expenses', creditAcc: 'PAYE Payable' },
                overdraft: { ledger: ledgerOverdraft, debitAcc: 'Cash for Expenses', creditAcc: 'Bank Overdraft' },
            };

            let count = 0;
            for (const [key, override] of Object.entries(overrides)) {
                const map = adjustmentMap[key];
                if (!map) continue;
                const diff = override - map.ledger;
                if (Math.abs(diff) < 0.01) continue;

                const now = new Date();
                const entryNum = `ADJ-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

                const { error } = await supabase.from('journal_entries').insert({
                    entry_number: entryNum,
                    date: endDate,
                    description: `Balance sheet adjustment: ${key} (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`,
                    ref_type: 'Adjustment',
                    debit_account: diff > 0 ? map.debitAcc : map.creditAcc,
                    debit_amount: Math.abs(diff),
                    credit_account: diff > 0 ? map.creditAcc : map.debitAcc,
                    credit_amount: Math.abs(diff),
                    created_by: 'Accountant',
                    notes: 'Manual override from Statement of Financial Position',
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
    const fmt = (v: number) => formatCurrency(v).replace('GHS', '').trim();

    const EditableCell = ({ fieldKey, ledgerValue }: { fieldKey: string; ledgerValue: number }) => {
        const v = val(fieldKey, ledgerValue);
        const isOverridden = overrides[fieldKey] !== undefined && Math.abs(overrides[fieldKey] - ledgerValue) > 0.01;
        const [localVal, setLocalVal] = useState<string>(String(v));

        useEffect(() => {
            setLocalVal(String(val(fieldKey, ledgerValue)));
        }, [editMode, ledgerValue]);

        if (!editMode) {
            return <span style={{ color: isOverridden ? 'var(--primary-600)' : 'inherit' }}>{fmt(v)}</span>;
        }

        return (
            <input
                type="number"
                step="0.01"
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

    const SectionHeader = ({ title }: any) => (
        <tr style={{ height: 40 }}>
            <td colSpan={4} style={{ padding: '10px 0', fontSize: 13, fontWeight: 800, textDecoration: 'underline', textTransform: 'uppercase' }}>{title}</td>
        </tr>
    );

    const AccountRow = ({ label, fieldKey, ledgerValue, isTotal = false }: any) => (
        <tr style={{ height: 35, borderTop: isTotal ? '1.5px solid #000' : 'none' }}>
            <td style={{ fontSize: 13, fontWeight: isTotal ? 700 : 400 }}>{label}</td>
            <td></td>
            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}>
                {!isTotal && fieldKey ? <EditableCell fieldKey={fieldKey} ledgerValue={ledgerValue} /> : (!isTotal ? fmt(ledgerValue) : '')}
            </td>
            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 13, fontWeight: isTotal ? 700 : 400 }}>
                {isTotal ? fmt(ledgerValue) : ''}
            </td>
        </tr>
    );

    return (
        <div style={{ padding: 20 }}>
            <div className="no-print">
                <PageHeader
                    title="Financial Position"
                    subtitle="Statement of Financial Position"
                    actions={
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--slate-200)', padding: '4px 12px', borderRadius: 8 }}>
                                <Calendar size={14} color="var(--slate-400)" />
                                <span style={{ fontSize: 12, fontWeight: 600 }}>As at:</span>
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
                        <strong>Edit Mode:</strong> Type values directly into the fields. Changes are saved as balanced adjustment journal entries for full traceability.
                    </div>
                )}

                {/* CONNECTED LINKS */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Journal Entries', href: '/accounting/journal' },
                        { label: 'Expenses', href: '/accounting/expenses' },
                        { label: 'Supplier Payments', href: '/purchasing/payments' },
                        { label: 'Invoices (A/R)', href: '/sales/invoices' },
                        { label: 'A/R Aging', href: '/accounting/ar-aging' },
                        { label: 'Stock Inventory', href: '/stores/stock' },
                        { label: 'Petty Cash', href: '/accounting/petty-cash' },
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
                    <h2 style={{ fontSize: 18, fontWeight: 700, textDecoration: 'underline', marginBottom: 40 }}>STATEMENT OF FINANCIAL POSITION AS AT</h2>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 30, paddingRight: 10, marginBottom: 10 }}>
                    <div style={{ width: 60, textAlign: 'center', fontWeight: 800, fontSize: 12, textDecoration: 'underline' }}>NOTES</div>
                    <div style={{ width: 60, textAlign: 'center', fontWeight: 800, fontSize: 12, textDecoration: 'underline' }}>AT</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 80, paddingRight: 20, marginBottom: 10, borderBottom: '2px solid #000' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <SectionHeader title="ASSETS" />
                        <SectionHeader title="NON-CURRENT ASSETS" />
                        <AccountRow label="Property, Plant & Equipment" fieldKey="ppe" ledgerValue={ledgerPPE} />

                        <tr style={{ height: 20 }}></tr>
                        <SectionHeader title="CURRENT ASSETS:" />
                        <AccountRow label="Inventories" fieldKey="inventories" ledgerValue={ledgerInventories} />
                        <AccountRow label="Receivables" fieldKey="receivables" ledgerValue={ledgerReceivables} />
                        <AccountRow label="Cash & Bank Balances" fieldKey="cash" ledgerValue={ledgerCash} />

                        <tr style={{ height: 20 }}></tr>
                        <AccountRow label="TOTAL ASSETS" isTotal ledgerValue={totalAssets} />

                        <tr style={{ height: 40 }}></tr>
                        <SectionHeader title="EQUITY & LIABILITIES:" />
                        <SectionHeader title="CAPITAL & RESERVES" />
                        <AccountRow label="Stated Capital" fieldKey="statedCapital" ledgerValue={ledgerStatedCapital} />
                        <AccountRow label="Share Deposit" fieldKey="shareDeposit" ledgerValue={ledgerShareDeposit} />
                        <AccountRow label="Income Surplus" fieldKey="incomeSurplus" ledgerValue={ledgerIncomeSurplus} />
                        <AccountRow label="Directors Account" fieldKey="directors" ledgerValue={ledgerDirectors} />

                        <tr style={{ height: 40 }}></tr>
                        <SectionHeader title="CURRENT LIABILITIES" />
                        <AccountRow label="Trade Creditors & Accruals" fieldKey="tradeCreditors" ledgerValue={ledgerTradeCreditors} />
                        <AccountRow label="Taxation" fieldKey="taxation" ledgerValue={ledgerTaxation} />
                        <AccountRow label="Bank Overdraft" fieldKey="overdraft" ledgerValue={ledgerOverdraft} />

                        <tr style={{ height: 20 }}></tr>
                        <AccountRow label="TOTAL EQUITY & LIABILITIES" isTotal ledgerValue={totalEquity + totalLiabilities} />
                    </tbody>
                </table>

                {/* Balance check */}
                {Math.abs(totalAssets - (totalEquity + totalLiabilities)) > 0.01 && (
                    <div className="no-print" style={{ marginTop: 16, padding: 10, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, fontWeight: 700, color: '#b91c1c', textAlign: 'center' }}>
                        ⚠ Out of balance by {fmt(totalAssets - (totalEquity + totalLiabilities))}
                    </div>
                )}

                {/* SIGNATURE SECTION */}
                <div style={{ marginTop: 100, fontSize: 13 }}>
                    <p style={{ marginBottom: 60 }}>
                        Approved by the Board of Directors on .............................................................. and signed on its behalf by:
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 100 }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ borderTop: '1px dotted #000', marginBottom: 10 }}></div>
                            <div style={{ fontWeight: 800 }}>DIRECTOR</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ borderTop: '1px dotted #000', marginBottom: 10 }}></div>
                            <div style={{ fontWeight: 800 }}>DIRECTOR</div>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', fontSize: 13 }}>2</div>
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
