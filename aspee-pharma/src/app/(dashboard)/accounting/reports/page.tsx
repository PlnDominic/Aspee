'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    PieChart, 
    BarChart3, 
    ArrowUpRight, 
    ArrowDownRight,
    Calendar,
    Download
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

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

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'pnl' | 'balance' | 'cashflow'>('pnl');

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // Fetch data from the joined financial_ledgers view
            const { data, error } = await supabase
                .from('financial_ledgers')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);

            if (error) throw error;

            // Data is already joined in the view
            const flattenedData = (data || []).map((item: any) => ({
                ...item,
                type: item.type,
                subtype: item.subtype,
                code: item.code
            }));

            setEntries(flattenedData);
        } catch (error: any) {
            toast.error('Failed to load report data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- P&L Calculations ---
    const revenueEntries = entries.filter(e => e.type === 'Revenue');
    const expenseEntries = entries.filter(e => e.type === 'Expense');

    const totalRevenue = revenueEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
    const totalExpenses = expenseEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const netProfit = totalRevenue - totalExpenses;

    // --- Balance Sheet Calculations ---
    const assetEntries = entries.filter(e => e.type === 'Asset');
    const liabilityEntries = entries.filter(e => e.type === 'Liability');
    const equityEntries = entries.filter(e => e.type === 'Equity');

    const totalAssets = assetEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    const totalLiabilities = liabilityEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
    const totalEquity = equityEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);

    // --- Cash Flow Calculations ---
    const cashEntries = entries.filter(e => e.subtype === 'Current Asset' && (e.account_name.toLowerCase().includes('cash') || e.account_name.toLowerCase().includes('bank')));
    const cashIn = cashEntries.reduce((sum, e) => sum + (e.debit > 0 ? e.debit : 0), 0);
    const cashOut = cashEntries.reduce((sum, e) => sum + (e.credit > 0 ? e.credit : 0), 0);
    const netCashFlow = cashIn - cashOut;

    const cardStyle = {
        background: 'var(--card-bg)',
        border: '1px solid var(--slate-200)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    };

    const tableHeaderStyle = {
        textAlign: 'left' as const,
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--slate-500)',
        padding: '12px 16px',
        borderBottom: '2px solid var(--slate-100)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em'
    };

    const tableRowStyle = {
        fontSize: 11,
        borderBottom: '1px solid var(--slate-50)',
        transition: 'background 0.2s'
    };

    const renderPNL = () => {
        // Group expenses by class
        const getGroupTotal = (subtypeMatch: string) => 
            expenseEntries.filter(e => e.subtype?.includes(subtypeMatch)).reduce((sum, e) => sum + (e.debit - e.credit), 0);
        
        const getGroupEntries = (subtypeMatch: string) =>
            expenseEntries.filter(e => e.subtype?.includes(subtypeMatch));

        const revenueTotal = revenueEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const cosTotal = getGroupTotal('Cost of Sales');
        const grossProfit = revenueTotal - cosTotal;

        const saTotal = expenseEntries.filter(e => e.subtype?.startsWith('S&A')).reduce((sum, e) => sum + (e.debit - e.credit), 0);
        const operatingIncome = grossProfit - saTotal;

        const otherIncomeTotal = revenueEntries.filter(e => e.subtype === 'Other Income').reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const otherExpenseTotal = getGroupTotal('Other Expense');
        const taxTotal = getGroupTotal('Tax');
        
        const finalNetIncome = operatingIncome + otherIncomeTotal - otherExpenseTotal - taxTotal;

        const SectionHeader = ({ title, amount, color }: { title: string; amount: number; color?: string }) => (
            <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                <td style={{ padding: '12px 16px', color: color }}>{title}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: color }}>{formatCurrency(amount)}</td>
            </tr>
        );

        const AccountRow = ({ name, entries }: { name: string; entries: LedgerEntry[] }) => {
            const amount = entries.filter(e => e.account_name === name).reduce((sum, e) => sum + (e.source === 'Expense' ? (e.debit - e.credit) : (e.credit - e.debit)), 0);
            if (amount === 0) return null;
            return (
                <tr key={name} style={tableRowStyle}>
                    <td style={{ padding: '8px 16px 8px 32px', color: 'var(--slate-600)' }}>{name}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(amount)}</td>
                </tr>
            );
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-800)' }}>Statement of Profit or Loss</h2>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)' }}>For the period: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</span>
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            {/* REVENUE */}
                            <tr style={{ borderBottom: '2px solid var(--slate-100)' }}>
                                <td colSpan={2} style={{ padding: '12px 0', fontSize: 12, fontWeight: 800, color: 'var(--primary-700)' }}>REVENUE</td>
                            </tr>
                            {Array.from(new Set(revenueEntries.filter(e => e.subtype !== 'Other Income').map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={revenueEntries} />
                            ))}
                            <SectionHeader title="Total Sales Revenue" amount={revenueTotal - otherIncomeTotal} />

                            {/* COST OF SALES */}
                            <tr><td colSpan={2} style={{ padding: '24px 0 12px 0', fontSize: 12, fontWeight: 800, color: 'var(--primary-700)' }}>COST OF SALES</td></tr>
                            {Array.from(new Set(getGroupEntries('Cost of Sales').map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={expenseEntries} />
                            ))}
                            <SectionHeader title="Total Cost of Sales" amount={cosTotal} />
                            
                            {/* GROSS PROFIT */}
                            <tr style={{ background: 'var(--primary-600)', color: 'white', fontWeight: 800 }}>
                                <td style={{ padding: '14px 16px', fontSize: 13 }}>GROSS PROFIT</td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13 }}>{formatCurrency(grossProfit)}</td>
                            </tr>

                            {/* S&A EXPENSES */}
                            <tr><td colSpan={2} style={{ padding: '24px 0 12px 0', fontSize: 12, fontWeight: 800, color: 'var(--primary-700)' }}>SELLING & ADMINISTRATIVE EXPENSES</td></tr>
                            {['Payroll', 'Operations', 'Professional', 'Marketing', 'Maintenance', 'Occupancy', 'Financial', 'Taxes'].map(group => {
                                const groupEntries = getGroupEntries(`S&A - ${group}`);
                                if (groupEntries.length === 0) return null;
                                return (
                                    <React.Fragment key={group}>
                                        <tr style={{ background: 'var(--slate-50/50)' }}>
                                            <td colSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>{group}</td>
                                        </tr>
                                        {Array.from(new Set(groupEntries.map(e => e.account_name))).map(name => (
                                            <AccountRow key={name} name={name} entries={expenseEntries} />
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                            <SectionHeader title="Total Operating Expenses (S&A)" amount={saTotal} />

                            {/* OPERATING INCOME */}
                            <tr style={{ borderTop: '2px solid var(--slate-800)', fontWeight: 800 }}>
                                <td style={{ padding: '14px 16px', fontSize: 13 }}>OPERATING INCOME</td>
                                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13 }}>{formatCurrency(operatingIncome)}</td>
                            </tr>

                            {/* OTHER INCOME & EXPENSE */}
                            <tr><td colSpan={2} style={{ padding: '24px 0 12px 0', fontSize: 12, fontWeight: 800, color: 'var(--primary-700)' }}>OTHER INCOME & EXPENSES</td></tr>
                            {Array.from(new Set(revenueEntries.filter(e => e.subtype === 'Other Income').map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={revenueEntries} />
                            ))}
                            {Array.from(new Set(getGroupEntries('Other Expense').map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={expenseEntries} />
                            ))}
                            
                            {/* TAXES */}
                            <tr><td colSpan={2} style={{ padding: '24px 0 12px 0', fontSize: 12, fontWeight: 800, color: 'var(--primary-700)' }}>INCOME TAXES</td></tr>
                            {Array.from(new Set(getGroupEntries('Tax').map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={expenseEntries} />
                            ))}

                            {/* NET INCOME */}
                            <tr style={{ height: 20 }}></tr>
                            <tr style={{ background: finalNetIncome >= 0 ? 'var(--success)' : 'var(--danger)', color: 'white', fontWeight: 900 }}>
                                <td style={{ padding: '18px 16px', fontSize: 16 }}>NET INCOME</td>
                                <td style={{ padding: '18px 16px', textAlign: 'right', fontSize: 20 }}>{formatCurrency(finalNetIncome)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--slate-500)', fontWeight: 700, marginBottom: 8 }}>GROSS MARGIN</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-600)' }}>
                            {revenueTotal > 0 ? ((grossProfit / revenueTotal) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--slate-500)', fontWeight: 700, marginBottom: 8 }}>OPERATING MARGIN</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-600)' }}>
                            {revenueTotal > 0 ? ((operatingIncome / revenueTotal) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--slate-500)', fontWeight: 700, marginBottom: 8 }}>EXPENSE RATIO (S&A)</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber-600)' }}>
                            {revenueTotal > 0 ? ((saTotal / revenueTotal) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--slate-500)', fontWeight: 700, marginBottom: 8 }}>NET PROFIT MARGIN</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: finalNetIncome >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {revenueTotal > 0 ? ((finalNetIncome / revenueTotal) * 100).toFixed(1) : 0}%
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderBalanceSheet = () => {
        const getGroupTotal = (entries: LedgerEntry[], subtypeMatch: string) => 
            entries.filter(e => e.subtype?.includes(subtypeMatch)).reduce((sum, e) => sum + (e.debit - e.credit), 0);
        
        const getGroupEntries = (entries: LedgerEntry[], subtypeMatch: string) =>
            entries.filter(e => e.subtype?.includes(subtypeMatch));

        const SectionHeader = ({ title, amount, color, indent = 0 }: { title: string; amount?: number; color?: string; indent?: number }) => (
            <tr style={{ background: indent === 0 ? 'var(--slate-50)' : 'transparent', borderBottom: '1px solid var(--slate-100)', fontWeight: 700 }}>
                <td style={{ padding: `12px 16px 12px ${16 + indent * 16}px`, color: color }}>{title}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: color }}>{amount !== undefined ? formatCurrency(amount) : ''}</td>
            </tr>
        );

        const AccountRow = ({ name, entries, indent = 32 }: { name: string; entries: LedgerEntry[]; indent?: number }) => {
            const amount = entries.filter(e => e.account_name === name).reduce((sum, e) => sum + (e.debit - e.credit), 0);
            if (amount === 0) return null;
            return (
                <tr key={name} style={tableRowStyle}>
                    <td style={{ padding: `8px 16px 8px ${indent}px`, color: 'var(--slate-600)', fontSize: 11 }}>{name}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 500, fontSize: 11 }}>{formatCurrency(amount)}</td>
                </tr>
            );
        };

        // Calculations
        const currentAssetsTotal = getGroupTotal(assetEntries, 'Current Asset');
        const noncurrentAssetsTotal = getGroupTotal(assetEntries, 'Noncurrent Asset') + getGroupTotal(assetEntries, 'Fixed Asset') + getGroupTotal(assetEntries, 'Intangible Asset');
        const totalAssetsValue = totalAssets; // From top-level calculation

        const currentLiabilitiesTotal = liabilityEntries.filter(e => e.subtype?.includes('Current Liability')).reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const longTermLiabilitiesTotal = liabilityEntries.filter(e => e.subtype?.includes('Long-term Liability')).reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const totalLiabilitiesValue = totalLiabilities;

        const baseEquityTotal = equityEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const totalEquityAndLiabilitiesValue = totalLiabilitiesValue + baseEquityTotal + netProfit;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-800)' }}>Statement of Financial Position (Balance Sheet)</h2>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)' }}>As at {new Date(endDate).toLocaleDateString()}</span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            {/* ASSETS */}
                            <tr style={{ borderBottom: '2px solid var(--slate-800)' }}>
                                <td colSpan={2} style={{ padding: '12px 0', fontSize: 13, fontWeight: 900, color: 'var(--primary-700)' }}>ASSETS</td>
                            </tr>

                            {/* CURRENT ASSETS */}
                            <tr style={{ background: 'var(--slate-50/50)' }}>
                                <td colSpan={2} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--slate-700)' }}>CURRENT ASSETS</td>
                            </tr>
                            {['Cash', 'Receivables', 'Other'].map(sub => (
                                <React.Fragment key={sub}>
                                    <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                                        <td colSpan={2} style={{ padding: '8px 24px', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>{sub}</td>
                                    </tr>
                                    {Array.from(new Set(getGroupEntries(assetEntries, `Current Asset - ${sub}`).map(e => e.account_name))).map(name => (
                                        <AccountRow key={name} name={name} entries={assetEntries} indent={48} />
                                    ))}
                                </React.Fragment>
                            ))}
                            <SectionHeader title="Total Current Assets" amount={currentAssetsTotal} indent={16} color="var(--primary-600)" />

                            {/* NONCURRENT ASSETS */}
                            <tr style={{ background: 'var(--slate-50/50)', borderTop: '16px solid transparent' }}>
                                <td colSpan={2} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--slate-700)' }}>NON-CURRENT ASSETS</td>
                            </tr>
                            {/* PPE Grouping */}
                            <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                                <td colSpan={2} style={{ padding: '8px 24px', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Property, Plant and Equipment</td>
                            </tr>
                            {Array.from(new Set([...getGroupEntries(assetEntries, 'Fixed Asset - PPE'), ...getGroupEntries(assetEntries, 'Fixed Asset - Contra'), ...getGroupEntries(assetEntries, 'Fixed Asset - Land')].map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={assetEntries} indent={48} />
                            ))}
                            {/* Other Noncurrent */}
                            <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                                <td colSpan={2} style={{ padding: '8px 24px', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Other Non-current & Intangibles</td>
                            </tr>
                            {Array.from(new Set([...getGroupEntries(assetEntries, 'Noncurrent Asset'), ...getGroupEntries(assetEntries, 'Intangible Asset')].map(e => e.account_name))).map(name => (
                                <AccountRow key={name} name={name} entries={assetEntries} indent={48} />
                            ))}
                            <SectionHeader title="Total Non-current Assets" amount={noncurrentAssetsTotal} indent={16} color="var(--primary-600)" />

                            {/* TOTAL ASSETS */}
                            <tr style={{ background: 'var(--primary-700)', color: 'white', fontWeight: 900 }}>
                                <td style={{ padding: '16px', fontSize: 14 }}>TOTAL ASSETS</td>
                                <td style={{ padding: '16px', textAlign: 'right', fontSize: 16 }}>{formatCurrency(totalAssetsValue)}</td>
                            </tr>

                            <tr style={{ height: 48 }}></tr>

                            {/* LIABILITIES & EQUITY */}
                            <tr style={{ borderBottom: '2px solid var(--slate-800)' }}>
                                <td colSpan={2} style={{ padding: '12px 0', fontSize: 13, fontWeight: 900, color: 'var(--primary-700)' }}>LIABILITIES & EQUITY</td>
                            </tr>

                            {/* CURRENT LIABILITIES */}
                            <tr style={{ background: 'var(--slate-50/50)' }}>
                                <td colSpan={2} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--slate-700)' }}>CURRENT LIABILITIES</td>
                            </tr>
                            {['Payables', 'Taxes', 'Payroll', 'Accruals'].map(sub => (
                                <React.Fragment key={sub}>
                                    <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                                        <td colSpan={2} style={{ padding: '8px 24px', fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>{sub}</td>
                                    </tr>
                                    {Array.from(new Set(getGroupEntries(liabilityEntries, `Liability - ${sub}`).map(e => e.account_name))).map(name => {
                                        const amount = liabilityEntries.filter(e => e.account_name === name).reduce((sum, e) => sum + (e.credit - e.debit), 0);
                                        if (amount === 0) return null;
                                        return (
                                            <tr key={name} style={tableRowStyle}>
                                                <td style={{ padding: '8px 48px', color: 'var(--slate-600)', fontSize: 11 }}>{name}</td>
                                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 500, fontSize: 11 }}>{formatCurrency(amount)}</td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            <SectionHeader title="Total Current Liabilities" amount={currentLiabilitiesTotal} indent={16} color="var(--amber-700)" />

                            {/* LONG TERM LIABILITIES */}
                            <tr style={{ background: 'var(--slate-50/50)', borderTop: '16px solid transparent' }}>
                                <td colSpan={2} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--slate-700)' }}>LONG-TERM LIABILITIES</td>
                            </tr>
                            {Array.from(new Set(getGroupEntries(liabilityEntries, 'Long-term Liability').map(e => e.account_name))).map(name => {
                                const amount = liabilityEntries.filter(e => e.account_name === name).reduce((sum, e) => sum + (e.credit - e.debit), 0);
                                if (amount === 0) return null;
                                return (
                                    <tr key={name} style={tableRowStyle}>
                                        <td style={{ padding: '8px 48px', color: 'var(--slate-600)', fontSize: 11 }}>{name}</td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 500, fontSize: 11 }}>{formatCurrency(amount)}</td>
                                    </tr>
                                );
                            })}
                            <SectionHeader title="Total Long-term Liabilities" amount={longTermLiabilitiesTotal} indent={16} color="var(--amber-700)" />

                            {/* EQUITY */}
                            <tr style={{ background: 'var(--slate-50/50)', borderTop: '16px solid transparent' }}>
                                <td colSpan={2} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--slate-700)' }}>EQUITY</td>
                            </tr>
                            {Array.from(new Set(equityEntries.map(e => e.account_name))).map(name => {
                                const amount = equityEntries.filter(e => e.account_name === name).reduce((sum, e) => sum + (e.credit - e.debit), 0);
                                if (amount === 0 && !name.includes('Net income')) return null;
                                return (
                                    <tr key={name} style={tableRowStyle}>
                                        <td style={{ padding: '8px 48px', color: 'var(--slate-600)', fontSize: 11 }}>{name}</td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 500, fontSize: 11 }}>{formatCurrency(name.includes('Net income') ? netProfit : amount)}</td>
                                    </tr>
                                );
                            })}
                            <SectionHeader title="Total Equity" amount={baseEquityTotal + netProfit} indent={16} color="var(--primary-600)" />

                            {/* TOTAL LIABILITIES & EQUITY */}
                            <tr style={{ background: 'var(--primary-700)', color: 'white', fontWeight: 900 }}>
                                <td style={{ padding: '16px', fontSize: 14 }}>TOTAL LIABILITIES & EQUITY</td>
                                <td style={{ padding: '16px', textAlign: 'right', fontSize: 16 }}>{formatCurrency(totalEquityAndLiabilitiesValue)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* BALANCE CHECK */}
                {Math.abs(totalAssetsValue - totalEquityAndLiabilitiesValue) > 0.01 && (
                    <div style={{ padding: 12, background: 'var(--danger-light)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                        Warning: Balance Sheet is out of balance by {formatCurrency(totalAssetsValue - totalEquityAndLiabilitiesValue)}
                    </div>
                )}
            </div>
        );
    };

    const renderCashFlow = () => (
        <div style={cardStyle}>
            <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 20 }}>Cash Flow Statement</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={tableHeaderStyle}>Category</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Inflow</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Outflow</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Net</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={tableRowStyle}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>Operating Cash Flow</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(cashIn)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(cashOut)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(netCashFlow)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                <div style={{ padding: 20, background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Cash Inflow</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#166534' }}>{formatCurrency(cashIn)}</div>
                </div>
                <div style={{ padding: 20, background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Cash Outflow</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#991b1b' }}>{formatCurrency(cashOut)}</div>
                </div>
                <div style={{ padding: 20, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Net Movement</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0369a1' }}>{formatCurrency(netCashFlow)}</div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Financial Statements"
                subtitle="Performance and position reports"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'Reports' },
                ]}
                actions={
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', padding: '4px 12px', borderRadius: 8 }}>
                            <Calendar size={14} color="var(--slate-400)" />
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }}
                            />
                            <span style={{ color: 'var(--slate-300)' }}>|</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ border: 'none', fontSize: 12, outline: 'none', background: 'transparent' }}
                            />
                        </div>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <Download size={16} /> Export
                        </button>
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, paddingBottom: 4, borderBottom: '1px solid var(--slate-200)' }}>
                <button 
                    onClick={() => setActiveTab('pnl')}
                    style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: activeTab === 'pnl' ? 'var(--primary-600)' : 'var(--slate-500)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'pnl' ? '2px solid var(--primary-600)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Profit & Loss
                </button>
                <button 
                    onClick={() => setActiveTab('balance')}
                    style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: activeTab === 'balance' ? 'var(--primary-600)' : 'var(--slate-500)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'balance' ? '2px solid var(--primary-600)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Balance Sheet
                </button>
                <button 
                    onClick={() => setActiveTab('cashflow')}
                    style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: activeTab === 'cashflow' ? 'var(--primary-600)' : 'var(--slate-500)',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'cashflow' ? '2px solid var(--primary-600)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Cash Flow
                </button>
            </div>

            {loading ? (
                <div style={{ padding: 100, textAlign: 'center', color: 'var(--slate-400)' }}>Calculating financial data...</div>
            ) : (
                <div className="animate-stagger">
                    {activeTab === 'pnl' && renderPNL()}
                    {activeTab === 'balance' && renderBalanceSheet()}
                    {activeTab === 'cashflow' && renderCashFlow()}
                </div>
            )}
        </div>
    );
}
