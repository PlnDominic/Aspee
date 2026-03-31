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

export default function ChangesInEquityPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [editMode, setEditMode] = useState(false);
    const [overrides, setOverrides] = useState<Overrides>({});

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate]);

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

    const val = (key: string, ledger: number) => overrides[key] !== undefined ? overrides[key] : ledger;
    const fmt = (v: number) => formatCurrency(v).replace('GHS', '').trim();

    // --- Data Split ---
    const priorEntries = entries.filter(e => e.date < startDate);
    const periodEntries = entries.filter(e => e.date >= startDate && e.date <= endDate);

    const getBalance = (list: LedgerEntry[], nameMatch: string, typeMatch?: string) => 
        list.filter(e => 
            e.account_name.toLowerCase().includes(nameMatch.toLowerCase()) && 
            (!typeMatch || e.type === typeMatch)
        ).reduce((sum, e) => {
            if (e.type === 'Equity' || e.type === 'Revenue' || e.type === 'Liability') return sum + (e.credit - e.debit);
            return sum + (e.debit - e.credit);
        }, 0);

    const getProfit = (list: LedgerEntry[]) => {
        const rev = list.filter(e => e.type === 'Revenue').reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const exp = list.filter(e => e.type === 'Expense').reduce((sum, e) => sum + (e.debit - e.credit), 0);
        return rev - exp;
    };

    // Stated Capital
    const ledgerCapBf = getBalance(priorEntries, 'Capital');
    const ledgerCapAdditions = getBalance(periodEntries, 'Capital'); // Direct postings to capital in period
    const capBf = val('capBf', ledgerCapBf);
    const capAdditions = val('capAdditions', ledgerCapAdditions);
    const capCf = capBf + capAdditions;

    // Retained Earnings (Income Surplus)
    const ledgerRetBfProfit = getProfit(priorEntries);
    const ledgerRetBfBalance = getBalance(priorEntries, 'Retained Earnings') + getBalance(priorEntries, 'Surplus');
    const ledgerRetBf = ledgerRetBfProfit + ledgerRetBfBalance;

    const ledgerProfitPeriod = getProfit(periodEntries);
    const ledgerDividend = getBalance(periodEntries, 'Dividend'); // Usually debit if paid

    const retBf = val('retBf', ledgerRetBf);
    const profitPeriod = val('profitPeriod', ledgerProfitPeriod);
    const dividend = val('dividend', ledgerDividend);
    const retCf = retBf + profitPeriod - Math.abs(dividend);

    const handleOverride = (key: string, value: string) => {
        const num = parseFloat(value);
        setOverrides(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
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
                    width: '100%', padding: '4px 8px',
                    border: isOverridden ? '2px solid var(--primary-500)' : '1px solid var(--slate-300)',
                    borderRadius: 6, fontSize: 12, textAlign: 'right', outline: 'none',
                    background: isOverridden ? '#eff6ff' : '#fff', fontWeight: 600,
                }}
            />
        );
    };

    return (
        <div style={{ padding: 20 }}>
            <div className="no-print">
                <PageHeader
                    title="Changes in Equity"
                    subtitle="Statement of Changes in Equity"
                    actions={
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--slate-200)', padding: '4px 12px', borderRadius: 8 }}>
                                <Calendar size={14} color="var(--slate-400)" />
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none' }} />
                                <span>-</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none' }} />
                            </div>
                            <button onClick={() => setEditMode(!editMode)} style={{ padding: '10px 20px', background: editMode ? 'var(--primary-600)' : '#fff', border: '1px solid var(--primary-400)', color: editMode ? '#fff' : 'var(--primary-600)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                {editMode ? 'Done Editing' : 'Edit Values'}
                            </button>
                            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--slate-900)', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                <Printer size={16} /> Print
                            </button>
                        </div>
                    }
                />
            </div>

            <div style={{ background: '#fff', maxWidth: 900, margin: '20px auto', padding: '60px 80px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: '800px', color: '#000', fontFamily: '"Times New Roman", Times, serif' }}>
                <div style={{ textAlign: 'center', marginBottom: 50 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, textDecoration: 'underline', marginBottom: 8 }}>ASPEE PHARMACEUTICALS LIMITED</h1>
                    <h2 style={{ fontSize: 18, fontWeight: 700, textDecoration: 'underline' }}>STATEMENT OF CHANGES IN EQUITY FOR THE PERIOD ENDED {new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</h2>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 30 }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #000' }}>
                            <th style={{ textAlign: 'left', padding: '10px 5px', fontSize: 13 }}>DESCRIPTION</th>
                            <th style={{ textAlign: 'right', padding: '10px 5px', fontSize: 13, width: 140 }}>STATED<br/>CAPITAL (GHS)</th>
                            <th style={{ textAlign: 'right', padding: '10px 5px', fontSize: 13, width: 140 }}>RETAINED<br/>EARNINGS (GHS)</th>
                            <th style={{ textAlign: 'right', padding: '10px 5px', fontSize: 13, width: 140, fontWeight: 800 }}>TOTAL<br/>EQUITY (GHS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ height: 45, borderBottom: '1px solid #eee' }}>
                            <td style={{ fontSize: 13, fontWeight: 700 }}>Balance as at {new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                            <td style={{ textAlign: 'right' }}><EditableCell fieldKey="capBf" ledgerValue={ledgerCapBf} /></td>
                            <td style={{ textAlign: 'right' }}><EditableCell fieldKey="retBf" ledgerValue={ledgerRetBf} /></td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(capBf + retBf)}</td>
                        </tr>
                        <tr style={{ height: 45, borderBottom: '1px solid #eee' }}>
                            <td style={{ fontSize: 13 }}>Net Profit for the Period</td>
                            <td style={{ textAlign: 'right', color: '#999' }}>-</td>
                            <td style={{ textAlign: 'right' }}><EditableCell fieldKey="profitPeriod" ledgerValue={ledgerProfitPeriod} /></td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(profitPeriod)}</td>
                        </tr>
                        <tr style={{ height: 45, borderBottom: '1px solid #eee' }}>
                            <td style={{ fontSize: 13 }}>Issue of Shares (Proceeds)</td>
                            <td style={{ textAlign: 'right' }}><EditableCell fieldKey="capAdditions" ledgerValue={ledgerCapAdditions} /></td>
                            <td style={{ textAlign: 'right', color: '#999' }}>-</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(capAdditions)}</td>
                        </tr>
                        <tr style={{ height: 45, borderBottom: '1px solid #eee' }}>
                            <td style={{ fontSize: 13 }}>Dividend Paid</td>
                            <td style={{ textAlign: 'right', color: '#999' }}>-</td>
                            <td style={{ textAlign: 'right' }}><EditableCell fieldKey="dividend" ledgerValue={ledgerDividend} /></td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>({fmt(Math.abs(dividend))})</td>
                        </tr>
                        <tr style={{ height: 60, borderTop: '2px solid #000', borderBottom: '4px double #000' }}>
                            <td style={{ fontSize: 14, fontWeight: 800 }}>Balance as at {new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{fmt(capCf)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{fmt(retCf)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 15 }}>{fmt(capCf + retCf)}</td>
                        </tr>
                    </tbody>
                </table>

                <div style={{ marginTop: 80, display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', width: 200, marginTop: 40, marginBottom: 10 }}></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>DIRECTOR</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', width: 200, marginTop: 40, marginBottom: 10 }}></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>DIRECTOR</span>
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
