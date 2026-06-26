'use client';

import React, { useState, useCallback } from 'react';
import { BankTransactionModal } from '@/components/BankTransactionModal';
import { Landmark, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface BankAccount {
    id: string;
    bank_name: string;
    short_name: string;
    color: string;
    balance: number;
}

interface BankTransaction {
    id: string;
    bank_account_id: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    description: string | null;
    date: string;
    created_at: string;
}

export default function BanksPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'overview' | string>('overview');
    const [modal, setModal] = useState<{ bank: BankAccount; type: 'deposit' | 'withdrawal' } | null>(null);

    const { data: banks = [], isLoading } = useQuery({
        queryKey: ['bank_accounts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bank_accounts')
                .select('*')
                .order('bank_name');
            if (error) throw error;
            return data as BankAccount[];
        },
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ['bank_transactions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bank_transactions')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            return data as BankTransaction[];
        },
    });

    const refresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['bank_transactions'] });
    }, [queryClient]);

    const totalBalance = banks.reduce((sum, b) => sum + (b.balance ?? 0), 0);
    const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);

    const activeBank = banks.find(b => b.id === activeTab) ?? null;
    const bankTxs = activeBank
        ? [...transactions.filter(t => t.bank_account_id === activeBank.id)].sort((a, b) => {
            if (a.date !== b.date) return a.date < b.date ? -1 : 1;
            return a.created_at < b.created_at ? -1 : 1;
        })
        : [];

    // Build running balance from oldest → newest
    const statementRows = (() => {
        let runningBalance = 0;
        return bankTxs.map(tx => {
            runningBalance += tx.type === 'deposit' ? tx.amount : -tx.amount;
            return { tx, runningBalance };
        });
    })();
    const statementRowsDesc = [...statementRows].reverse();

    const bankDeposits = bankTxs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const bankWithdrawals = bankTxs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);

    return (
        <div style={{ padding: '8px 28px 24px' }}>
            <div style={{ marginBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Banks</h2>
                <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>Banking partners &amp; account statements</p>
            </div>

            {/* Tab bar */}
            <div style={{
                display: 'flex',
                gap: 0,
                borderBottom: '2px solid var(--slate-200)',
                marginBottom: 20,
                overflowX: 'auto',
            }}>
                {/* Overview tab */}
                <button
                    onClick={() => setActiveTab('overview')}
                    style={{
                        padding: '11px 22px',
                        border: 'none',
                        borderBottom: activeTab === 'overview' ? '2px solid #2563eb' : '2px solid transparent',
                        marginBottom: -2,
                        background: 'transparent',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'overview' ? 700 : 500,
                        fontSize: 13,
                        color: activeTab === 'overview' ? '#2563eb' : 'var(--slate-500)',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        transition: 'color 0.15s',
                    }}
                >
                    <Wallet size={14} />
                    Overview
                </button>

                {banks.map(bank => (
                    <button
                        key={bank.id}
                        onClick={() => setActiveTab(bank.id)}
                        style={{
                            padding: '11px 22px',
                            border: 'none',
                            borderBottom: activeTab === bank.id ? '2px solid #2563eb' : '2px solid transparent',
                            marginBottom: -2,
                            background: 'transparent',
                            cursor: 'pointer',
                            fontWeight: activeTab === bank.id ? 700 : 500,
                            fontSize: 13,
                            color: activeTab === bank.id ? '#2563eb' : 'var(--slate-500)',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            transition: 'color 0.15s',
                        }}
                    >
                        <Landmark size={14} />
                        {bank.short_name || bank.bank_name}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
                <>
                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                        {[
                            { label: 'Total Bank Balance', value: totalBalance, icon: <Wallet size={20} color="#2563eb" />, bg: '#eff6ff', color: '#1d4ed8' },
                            { label: 'Total Deposits', value: totalDeposits, icon: <ArrowDownCircle size={20} color="#16a34a" />, bg: '#f0fdf4', color: '#15803d' },
                            { label: 'Total Withdrawals', value: totalWithdrawals, icon: <ArrowUpCircle size={20} color="#dc2626" />, bg: '#fef2f2', color: '#b91c1c' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 14,
                                padding: '20px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}>
                                <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {s.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.03em' }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{formatCurrency(s.value)}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bank cards */}
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-400)', fontSize: 13 }}>Loading...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
                            {banks.map(bank => {
                                const txs = transactions.filter(t => t.bank_account_id === bank.id);
                                const dep = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
                                const wit = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
                                return (
                                    <div
                                        key={bank.id}
                                        onClick={() => setActiveTab(bank.id)}
                                        style={{
                                            background: 'var(--card-bg)',
                                            border: '1px solid var(--slate-200)',
                                            borderRadius: 16,
                                            padding: '20px 20px 16px',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                            cursor: 'pointer',
                                            transition: 'box-shadow 0.15s, border-color 0.15s',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.10)';
                                            (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
                                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--slate-200)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Landmark size={20} color="var(--slate-500)" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>{bank.bank_name}</div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)', marginTop: 2, letterSpacing: '0.05em' }}>{bank.short_name}</div>
                                            </div>
                                        </div>
                                        <div style={{ background: 'var(--slate-50)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em' }}>CURRENT BALANCE</div>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(bank.balance ?? 0)}</div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px' }}>
                                                <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, marginBottom: 3, letterSpacing: '0.04em' }}>DEPOSITS</div>
                                                <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d' }}>{formatCurrency(dep)}</div>
                                            </div>
                                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px' }}>
                                                <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700, marginBottom: 3, letterSpacing: '0.04em' }}>WITHDRAWALS</div>
                                                <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>{formatCurrency(wit)}</div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 12, fontSize: 11, color: '#2563eb', fontWeight: 600, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                            <FileText size={11} /> View Statement
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* All-banks transaction table */}
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>All Transactions</div>
                            <div style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 500 }}>{transactions.length} record{transactions.length !== 1 ? 's' : ''}</div>
                        </div>
                        {transactions.length === 0 ? (
                            <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>No transactions yet.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
                                            {['Date', 'Bank', 'Type', 'Description', 'Amount'].map((h, i) => (
                                                <th key={h} style={{ padding: '10px 20px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                                    {h.toUpperCase()}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((tx, i) => {
                                            const bank = banks.find(b => b.id === tx.bank_account_id);
                                            return (
                                                <tr key={tx.id} style={{ borderBottom: '1px solid var(--slate-100)', background: i % 2 === 0 ? 'transparent' : 'var(--slate-50)' }}>
                                                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--slate-500)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{tx.date}</td>
                                                    <td style={{ padding: '12px 20px', fontSize: 13 }}>
                                                        {bank ? (
                                                            <button
                                                                onClick={() => setActiveTab(bank.id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: 0 }}
                                                            >
                                                                <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Landmark size={12} color="var(--slate-500)" />
                                                                </div>
                                                                <span style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'underline', textUnderlineOffset: 2 }}>{bank.bank_name}</span>
                                                            </button>
                                                        ) : '—'}
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: tx.type === 'deposit' ? '#f0fdf4' : '#fef2f2', color: tx.type === 'deposit' ? '#16a34a' : '#dc2626', border: `1px solid ${tx.type === 'deposit' ? '#bbf7d0' : '#fecaca'}` }}>
                                                            {tx.type === 'deposit' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                                                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--slate-500)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {tx.description || <span style={{ color: 'var(--slate-300)' }}>—</span>}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: tx.type === 'deposit' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                        {tx.type === 'deposit' ? '+' : '−'}{formatCurrency(tx.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── BANK STATEMENT TAB ── */}
            {activeTab !== 'overview' && activeBank && (
                <>
                    {/* Bank header */}
                    <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 16,
                        padding: '24px 28px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 20,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Landmark size={26} color="#2563eb" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.2 }}>{activeBank.bank_name}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-400)', marginTop: 3, letterSpacing: '0.06em' }}>{activeBank.short_name} · Account Statement</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Stats */}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
                                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>TOTAL CREDITS</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>{formatCurrency(bankDeposits)}</div>
                                </div>
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
                                    <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>TOTAL DEBITS</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#b91c1c' }}>{formatCurrency(bankWithdrawals)}</div>
                                </div>
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', minWidth: 130 }}>
                                    <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>CLOSING BALANCE</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8' }}>{formatCurrency(activeBank.balance ?? 0)}</div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => setModal({ bank: activeBank, type: 'deposit' })}
                                    style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <ArrowDownCircle size={14} /> Deposit
                                </button>
                                <button
                                    onClick={() => setModal({ bank: activeBank, type: 'withdrawal' })}
                                    style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <ArrowUpCircle size={14} /> Withdrawal
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Statement table */}
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        {/* Statement header bar */}
                        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--slate-50)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={15} color="var(--slate-500)" />
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Account Statement</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 500 }}>
                                {bankTxs.length} transaction{bankTxs.length !== 1 ? 's' : ''}
                            </div>
                        </div>

                        {bankTxs.length === 0 ? (
                            <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>
                                No transactions recorded for this account yet.<br />
                                <span style={{ fontSize: 12 }}>Use the Deposit or Withdrawal buttons above to get started.</span>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--slate-50)', borderBottom: '2px solid var(--slate-200)' }}>
                                            <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>DATE</th>
                                            <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em' }}>DESCRIPTION</th>
                                            <th style={{ padding: '11px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#15803d', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>CREDIT (DR)</th>
                                            <th style={{ padding: '11px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#b91c1c', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>DEBIT (DR)</th>
                                            <th style={{ padding: '11px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>BALANCE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {statementRowsDesc.map(({ tx, runningBalance }, i) => (
                                            <tr
                                                key={tx.id}
                                                style={{
                                                    borderBottom: '1px solid var(--slate-100)',
                                                    background: i % 2 === 0 ? 'transparent' : 'var(--slate-50)',
                                                }}
                                            >
                                                <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--slate-500)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                    {new Date(tx.date).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--text-primary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {tx.description || <span style={{ color: 'var(--slate-300)', fontStyle: 'italic' }}>No description</span>}
                                                </td>
                                                <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: tx.type === 'deposit' ? 700 : 400, color: tx.type === 'deposit' ? '#16a34a' : 'var(--slate-300)' }}>
                                                    {tx.type === 'deposit' ? formatCurrency(tx.amount) : '—'}
                                                </td>
                                                <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: tx.type === 'withdrawal' ? 700 : 400, color: tx.type === 'withdrawal' ? '#dc2626' : 'var(--slate-300)' }}>
                                                    {tx.type === 'withdrawal' ? formatCurrency(tx.amount) : '—'}
                                                </td>
                                                <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: runningBalance >= 0 ? '#1d4ed8' : '#dc2626', whiteSpace: 'nowrap' }}>
                                                    {formatCurrency(Math.abs(runningBalance))}
                                                    {runningBalance < 0 && <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4, color: '#dc2626' }}>DR</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid var(--slate-200)', background: '#f8fafc' }}>
                                            <td colSpan={2} style={{ padding: '13px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                            <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(bankDeposits)}</td>
                                            <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(bankWithdrawals)}</td>
                                            <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(activeBank.balance ?? 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <BankTransactionModal
                isOpen={!!modal}
                onClose={() => setModal(null)}
                bank={modal?.bank ?? null}
                defaultType={modal?.type ?? 'deposit'}
                onSuccess={refresh}
            />
        </div>
    );
}
