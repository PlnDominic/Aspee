'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import JournalEntryModal from '@/components/JournalEntryModal';
import { Plus, BookOpen, TrendingUp, TrendingDown, Scale, Send } from 'lucide-react';
import { useSupabaseQuery } from '@/lib/hooks';
import { formatCurrency } from '@/lib/currency';
import SendToMDModal from '@/components/SendToMDModal';

const REF_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    Manual: { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
    Sales: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    Purchase: { bg: '#fefce8', color: '#a16207', border: '#fde68a' },
    Expense: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    Payroll: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
    Adjustment: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

const columns = [
    {
        key: 'entry_number',
        label: 'Entry No.',
        render: (v: unknown) => (
            <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>
                {v as string}
            </span>
        ),
    },
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description', wrap: true },
    {
        key: 'ref_type',
        label: 'Type',
        render: (v: unknown) => {
            const type = v as string;
            const style = REF_TYPE_COLORS[type] || REF_TYPE_COLORS.Manual;
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: style.bg,
                        color: style.color,
                        border: `1px solid ${style.border}`,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: style.color,
                        }}
                    />
                    {type}
                </span>
            );
        },
    },
    {
        key: 'debit_account',
        label: 'Debit Account',
        render: (v: unknown) => (
            <span style={{ fontSize: 11, color: 'var(--slate-700)' }}>{v as string}</span>
        ),
    },
    {
        key: 'debit_amount',
        label: 'Debit',
        render: (v: unknown) => (
            <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                {formatCurrency(Number(v) || 0)}
            </span>
        ),
    },
    {
        key: 'credit_account',
        label: 'Credit Account',
        render: (v: unknown) => (
            <span style={{ fontSize: 11, color: 'var(--slate-700)' }}>{v as string}</span>
        ),
    },
    {
        key: 'credit_amount',
        label: 'Credit',
        render: (v: unknown) => (
            <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                {formatCurrency(Number(v) || 0)}
            </span>
        ),
    },
    { key: 'created_by', label: 'Created By' },
];

export default function JournalPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data, isLoading: loading } = useSupabaseQuery<any>('journal_entries', {
        orderBy: 'created_at',
        ascending: false,
    });
    const entries = data ?? [];

    const totalEntries = entries.length;
    const totalDebits = entries.reduce((sum: number, e: any) => sum + (Number(e.debit_amount) || 0), 0);
    const totalCredits = entries.reduce((sum: number, e: any) => sum + (Number(e.credit_amount) || 0), 0);
    const balance = totalDebits - totalCredits;

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Journal Entries"
                subtitle="Double-entry bookkeeping ledger"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'Journal Entries' },
                ]}
                actions={
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 16px',
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                                color: 'white',
                                fontSize: 13,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <Send size={15} /> Send Weekly Report
                        </button>
                        <button
                            onClick={() => setModalOpen(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '9px 18px',
                                borderRadius: 8,
                                border: 'none',
                                background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={16} /> Manual Entry
                        </button>
                    </div>
                }
            />

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
                <StatCard
                    title="Total Entries"
                    value={totalEntries}
                    icon={<BookOpen size={20} />}
                    color="blue"
                    subtitle="All journal records"
                />
                <StatCard
                    title="Total Debits"
                    value={formatCurrency(totalDebits)}
                    icon={<TrendingUp size={20} />}
                    color="green"
                    subtitle="Sum of all debits"
                />
                <StatCard
                    title="Total Credits"
                    value={formatCurrency(totalCredits)}
                    icon={<TrendingDown size={20} />}
                    color="amber"
                    subtitle="Sum of all credits"
                />
                <StatCard
                    title="Balance"
                    value={formatCurrency(Math.abs(balance))}
                    icon={<Scale size={20} />}
                    color={Math.abs(balance) < 0.01 ? 'teal' : 'red'}
                    subtitle={Math.abs(balance) < 0.01 ? 'Books are balanced' : 'Imbalance detected'}
                />
            </div>

            <DataTable
                columns={columns}
                data={entries}
                loading={loading}
                searchPlaceholder="Search journal entries..."
                emptyMessage="No journal entries yet. Click 'Manual Entry' to create one."
            />

            <JournalEntryModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['journal_entries'] })}
            />

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Accounting" 
            />
        </div>
    );
}
