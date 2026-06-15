'use client';

import React, { useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { BankTransactionModal } from '@/components/BankTransactionModal';
import { Landmark, ArrowDownCircle, ArrowUpCircle, TrendingUp, Clock } from 'lucide-react';
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

    const getStats = (bank: BankAccount) => {
        const txs = transactions.filter(t => t.bank_account_id === bank.id);
        const totalDeposits = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
        const recent = txs.slice(0, 3);
        return { totalDeposits, totalWithdrawals, recent };
    };

    return (
        <div style={{ padding: 20 }}>
            <PageHeader
                title="Banks"
                subtitle="Banking partners & balances"
            />

            {/* Total balance summary */}
            <div style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--slate-200)',
                borderRadius: 12,
                padding: '20px 28px',
                marginBottom: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
            }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={22} color="#2563eb" />
                </div>
                <div>
                    <div style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 2 }}>TOTAL BANK BALANCE</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(totalBalance)}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--slate-400)' }}>{banks.length} banks</div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-400)', fontSize: 13 }}>Loading...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                    {banks.map(bank => {
                        const { totalDeposits, totalWithdrawals, recent } = getStats(bank);
                        return (
                            <div
                                key={bank.id}
                                style={{
                                    background: 'var(--card-bg)',
                                    border: '1px solid var(--slate-200)',
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                }}
                            >
                                <div style={{ height: 5, background: bank.color }} />

                                <div style={{ padding: '20px 22px' }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                                        <div style={{
                                            width: 46,
                                            height: 46,
                                            borderRadius: 11,
                                            background: bank.color + '18',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <Landmark size={22} color={bank.color} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>{bank.bank_name}</div>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: bank.color, marginTop: 2, letterSpacing: '0.06em' }}>{bank.short_name}</div>
                                        </div>
                                    </div>

                                    {/* Balance */}
                                    <div style={{
                                        background: bank.color + '0d',
                                        borderRadius: 10,
                                        padding: '14px 16px',
                                        marginBottom: 16,
                                    }}>
                                        <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 4 }}>CURRENT BALANCE</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: bank.color }}>{formatCurrency(bank.balance ?? 0)}</div>
                                    </div>

                                    {/* Stats row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px' }}>
                                            <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, marginBottom: 3 }}>TOTAL DEPOSITS</div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d' }}>{formatCurrency(totalDeposits)}</div>
                                        </div>
                                        <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px' }}>
                                            <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700, marginBottom: 3 }}>TOTAL WITHDRAWALS</div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>{formatCurrency(totalWithdrawals)}</div>
                                        </div>
                                    </div>

                                    {/* Recent transactions */}
                                    {recent.length > 0 && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Clock size={11} /> RECENT
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                {recent.map(tx => (
                                                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
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

                                    {/* Action buttons */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <button
                                            onClick={() => setModal({ bank, type: 'deposit' })}
                                            style={{
                                                padding: '9px 0',
                                                borderRadius: 8,
                                                border: '1.5px solid #16a34a',
                                                background: '#f0fdf4',
                                                color: '#16a34a',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 5,
                                            }}
                                        >
                                            <ArrowDownCircle size={14} /> Deposit
                                        </button>
                                        <button
                                            onClick={() => setModal({ bank, type: 'withdrawal' })}
                                            style={{
                                                padding: '9px 0',
                                                borderRadius: 8,
                                                border: '1.5px solid #dc2626',
                                                background: '#fef2f2',
                                                color: '#dc2626',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 5,
                                            }}
                                        >
                                            <ArrowUpCircle size={14} /> Withdrawal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
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
