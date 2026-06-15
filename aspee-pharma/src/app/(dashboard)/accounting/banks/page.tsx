'use client';

import React, { useState, useCallback } from 'react';
import { BankTransactionModal } from '@/components/BankTransactionModal';
import { Landmark, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
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
            {/* Hero bar — title + stats in one row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20,
                marginBottom: 20,
                background: 'var(--card-bg)',
                border: '1px solid var(--slate-200)',
                borderRadius: 14,
                padding: '16px 22px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                flexWrap: 'wrap',
            }}>
                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Landmark size={18} color="#2563eb" />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>Banks</div>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>Banking partners & balances</div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Total Balance', value: totalBalance, icon: <Wallet size={15} color="#2563eb" />, bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                        { label: 'Total Deposits', value: totalDepositsAll, icon: <ArrowDownCircle size={15} color="#16a34a" />, bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
                        { label: 'Total Withdrawals', value: totalWithdrawalsAll, icon: <ArrowUpCircle size={15} color="#dc2626" />, bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                    ].map(s => (
                        <div key={s.label} style={{
                            background: s.bg,
                            border: `1px solid ${s.border}`,
                            borderRadius: 10,
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            {s.icon}
                            <div>
                                <div style={{ fontSize: 10, color: s.color, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.75 }}>{s.label.toUpperCase()}</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{formatCurrency(s.value)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bank cards */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-400)', fontSize: 13 }}>Loading...</div>
            ) : (
                <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'nowrap', overflowX: 'auto' }}>
                    {banks.map(bank => {
                        const { totalDeposits, totalWithdrawals } = getStats(bank);
                        return (
                            <div key={bank.id} style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 12,
                                padding: '12px 14px',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                flex: '1 1 0',
                                minWidth: 0,
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Landmark size={14} color="var(--slate-500)" />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bank.bank_name}</div>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-400)', letterSpacing: '0.05em' }}>{bank.short_name}</div>
                                    </div>
                                </div>

                                {/* Balance */}
                                <div style={{ background: 'var(--slate-50)', borderRadius: 7, padding: '7px 10px' }}>
                                    <div style={{ fontSize: 9, color: 'var(--slate-400)', fontWeight: 700, marginBottom: 2, letterSpacing: '0.06em' }}>BALANCE</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(bank.balance ?? 0)}</div>
                                </div>

                                {/* Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    <div style={{ background: '#f0fdf4', borderRadius: 7, padding: '6px 8px' }}>
                                        <div style={{ fontSize: 9, color: '#15803d', fontWeight: 700, letterSpacing: '0.04em' }}>IN</div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d' }}>{formatCurrency(totalDeposits)}</div>
                                    </div>
                                    <div style={{ background: '#fef2f2', borderRadius: 7, padding: '6px 8px' }}>
                                        <div style={{ fontSize: 9, color: '#b91c1c', fontWeight: 700, letterSpacing: '0.04em' }}>OUT</div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c' }}>{formatCurrency(totalWithdrawals)}</div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    <button onClick={() => setModal({ bank, type: 'deposit' })} style={{ padding: '6px 0', borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        <ArrowDownCircle size={11} /> Deposit
                                    </button>
                                    <button onClick={() => setModal({ bank, type: 'withdrawal' })} style={{ padding: '6px 0', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        <ArrowUpCircle size={11} /> Withdraw
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
