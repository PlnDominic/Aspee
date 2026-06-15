'use client';

import React, { useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { BankTransactionModal } from '@/components/BankTransactionModal';
import { Landmark, ArrowDownCircle, ArrowUpCircle, TrendingUp, Clock, Wallet } from 'lucide-react';
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
                .order('created_at', { ascending: false })
                .limit(200);
            if (error) throw error;
            return data as BankTransaction[];
        },
    });

    const refresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['bank_transactions'] });
    }, [queryClient]);

    const totalBalance = banks.reduce((sum, b) => sum + (b.balance ?? 0), 0);
    const totalDepositsAll = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const totalWithdrawalsAll = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);

    const getStats = (bank: BankAccount) => {
        const txs = transactions.filter(t => t.bank_account_id === bank.id);
        const totalDeposits = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
        const recent = txs.slice(0, 3);
        return { totalDeposits, totalWithdrawals, recent };
    };

    return (
        <div style={{ padding: '24px 28px' }}>
            <PageHeader title="Banks" subtitle="Banking partners & balances" />

            {/* Summary bar */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                marginBottom: 32,
            }}>
                {[
                    { label: 'Total Bank Balance', value: totalBalance, icon: <Wallet size={20} color="#2563eb" />, bg: '#eff6ff', color: '#1d4ed8' },
                    { label: 'Total Deposits', value: totalDepositsAll, icon: <ArrowDownCircle size={20} color="#16a34a" />, bg: '#f0fdf4', color: '#15803d' },
                    { label: 'Total Withdrawals', value: totalWithdrawalsAll, icon: <ArrowUpCircle size={20} color="#dc2626" />, bg: '#fef2f2', color: '#b91c1c' },
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18, marginBottom: 32 }}>
                    {banks.map(bank => {
                        const { totalDeposits, totalWithdrawals, recent } = getStats(bank);
                        return (
                            <div key={bank.id} style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 16,
                                padding: '22px 22px 18px',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16,
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        background: 'var(--slate-100)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Landmark size={22} color="var(--slate-500)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.2 }}>{bank.bank_name}</div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)', marginTop: 3, letterSpacing: '0.06em' }}>{bank.short_name}</div>
                                    </div>
                                </div>

                                {/* Balance */}
                                <div style={{
                                    background: 'var(--slate-50)',
                                    border: '1px solid var(--slate-100)',
                                    borderRadius: 10,
                                    padding: '14px 16px',
                                }}>
                                    <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 700, marginBottom: 5, letterSpacing: '0.06em' }}>CURRENT BALANCE</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(bank.balance ?? 0)}</div>
                                </div>

                                {/* Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, marginBottom: 4, letterSpacing: '0.04em' }}>DEPOSITS</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>{formatCurrency(totalDeposits)}</div>
                                    </div>
                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700, marginBottom: 4, letterSpacing: '0.04em' }}>WITHDRAWALS</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#b91c1c' }}>{formatCurrency(totalWithdrawals)}</div>
                                    </div>
                                </div>

                                {/* Recent */}
                                {recent.length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-400)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em' }}>
                                            <Clock size={10} /> RECENT ACTIVITY
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {recent.map(tx => (
                                                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    {tx.type === 'deposit'
                                                        ? <ArrowDownCircle size={13} color="#16a34a" />
                                                        : <ArrowUpCircle size={13} color="#dc2626" />}
                                                    <span style={{ color: 'var(--slate-500)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {tx.description || tx.type}
                                                    </span>
                                                    <span style={{ fontWeight: 700, color: tx.type === 'deposit' ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                                                        {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
                                    <button
                                        onClick={() => setModal({ bank, type: 'deposit' })}
                                        style={{
                                            padding: '10px 0',
                                            borderRadius: 9,
                                            border: '1px solid #bbf7d0',
                                            background: '#f0fdf4',
                                            color: '#15803d',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 5,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <ArrowDownCircle size={13} /> Deposit
                                    </button>
                                    <button
                                        onClick={() => setModal({ bank, type: 'withdrawal' })}
                                        style={{
                                            padding: '10px 0',
                                            borderRadius: 9,
                                            border: '1px solid #fecaca',
                                            background: '#fef2f2',
                                            color: '#b91c1c',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 5,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <ArrowUpCircle size={13} /> Withdrawal
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Transaction history table */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Transaction History</div>
                    <div style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 500 }}>
                        {transactions.length} record{transactions.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {transactions.length === 0 ? (
                    <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--slate-400)', fontSize: 13 }}>
                        No transactions yet. Record a deposit or withdrawal to get started.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
                                    {[
                                        { label: 'Date', align: 'left' },
                                        { label: 'Bank', align: 'left' },
                                        { label: 'Type', align: 'left' },
                                        { label: 'Description', align: 'left' },
                                        { label: 'Amount', align: 'right' },
                                    ].map(h => (
                                        <th key={h.label} style={{
                                            padding: '11px 20px',
                                            textAlign: h.align as any,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: 'var(--slate-500)',
                                            letterSpacing: '0.05em',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {h.label.toUpperCase()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, i) => {
                                    const bank = banks.find(b => b.id === tx.bank_account_id);
                                    return (
                                        <tr key={tx.id} style={{
                                            borderBottom: '1px solid var(--slate-100)',
                                            background: i % 2 === 0 ? 'transparent' : 'var(--slate-50)',
                                            transition: 'background 0.1s',
                                        }}>
                                            <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--slate-500)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                {tx.date}
                                            </td>
                                            <td style={{ padding: '13px 20px', fontSize: 13 }}>
                                                {bank ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Landmark size={13} color="var(--slate-500)" />
                                                        </div>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bank.bank_name}</span>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '13px 20px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                                    background: tx.type === 'deposit' ? '#f0fdf4' : '#fef2f2',
                                                    color: tx.type === 'deposit' ? '#16a34a' : '#dc2626',
                                                    border: `1px solid ${tx.type === 'deposit' ? '#bbf7d0' : '#fecaca'}`,
                                                }}>
                                                    {tx.type === 'deposit' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                                                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--slate-500)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {tx.description || <span style={{ color: 'var(--slate-300)' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: tx.type === 'deposit' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
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
