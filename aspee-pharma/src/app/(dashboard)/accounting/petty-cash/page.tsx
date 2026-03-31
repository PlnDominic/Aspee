'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import PettyCashModal from '@/components/PettyCashModal';
import { Plus, Coins, Banknote, AlertTriangle, TrendingDown, Edit2 } from 'lucide-react';
import { useSupabaseQuery } from '@/lib/hooks';
import { formatCurrency } from '@/lib/currency';

export default function PettyCashPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const queryClient = useQueryClient();

    const THRESHOLD = 500;

    const { data, isLoading: loading } = useSupabaseQuery<any>('petty_cash', {
        orderBy: 'created_at',
        ascending: false,
    });
    const rows = data ?? [];

    // Calculate stats from the data
    const stats = useMemo(() => {
        let replenishments = 0;
        let disbursements = 0;
        let monthDisbursements = 0;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        rows.forEach((row: any) => {
            const amt = Number(row.amount) || 0;
            if (row.type === 'Replenishment') {
                replenishments += amt;
            } else {
                disbursements += amt;
                if (row.date >= monthStart) {
                    monthDisbursements += amt;
                }
            }
        });

        const balance = replenishments - disbursements;
        return {
            currentBalance: balance,
            floatAmount: replenishments,
            belowThreshold: balance < THRESHOLD,
            thisMonthDisbursements: monthDisbursements,
        };
    }, [rows]);

    const handleOpenCreate = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: any) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const columns = [
        {
            key: 'voucher_number',
            label: 'Voucher',
            render: (v: unknown) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {v as string}
                </span>
            ),
        },
        { key: 'date', label: 'Date' },
        {
            key: 'type',
            label: 'Type',
            render: (v: unknown) => {
                const isDisbursement = v === 'Disbursement';
                return (
                    <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 600,
                        background: isDisbursement ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                        color: isDisbursement ? '#dc2626' : '#16a34a',
                        border: `1px solid ${isDisbursement ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'}`,
                    }}>
                        {v as string}
                    </span>
                );
            },
        },
        {
            key: 'description',
            label: 'Purpose',
            wrap: true,
        },
        {
            key: 'amount',
            label: 'Amount',
            render: (v: unknown) => (
                <span style={{ fontWeight: 700 }}>{formatCurrency(Number(v) || 0)}</span>
            ),
        },
        { key: 'category', label: 'Category' },
        { key: 'custodian', label: 'Custodian' },
        { key: 'approved_by', label: 'Approved By' },
        {
            key: 'balance_after',
            label: 'Balance After',
            render: (v: unknown) => (
                <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                    {formatCurrency(Number(v) || 0)}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => (
                <StatusBadge
                    status={v as string}
                    variant={v === 'Approved' ? 'success' : v === 'Rejected' ? 'danger' : 'warning'}
                />
            ),
        },
        {
            key: 'actions',
            label: '',
            render: (_v: unknown, row: any) => (
                <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
                    style={{
                        border: 'none',
                        background: 'var(--primary-50)',
                        color: 'var(--primary-600)',
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    title="Edit voucher"
                >
                    <Edit2 size={14} />
                </button>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Petty Cash"
                subtitle="Petty cash fund management and vouchers"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/petty-cash' }, { label: 'Petty Cash' }]}
                actions={
                    <button
                        onClick={handleOpenCreate}
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
                        <Plus size={16} /> New Voucher
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard
                    title="Current Balance"
                    value={loading ? '---' : formatCurrency(stats.currentBalance)}
                    icon={<Coins size={20} />}
                    color="blue"
                />
                <StatCard
                    title="Float Amount"
                    value={loading ? '---' : formatCurrency(stats.floatAmount)}
                    icon={<Banknote size={20} />}
                    color="green"
                />
                <StatCard
                    title="Below Threshold"
                    value={loading ? '---' : (stats.belowThreshold ? 'Yes' : 'No')}
                    icon={<AlertTriangle size={20} />}
                    color={stats.belowThreshold ? 'red' : 'amber'}
                    subtitle={loading ? '' : (stats.belowThreshold ? `Balance below ${formatCurrency(THRESHOLD)}` : 'Status okay')}
                />
                <StatCard
                    title="This Month"
                    value={loading ? '---' : formatCurrency(stats.thisMonthDisbursements)}
                    icon={<TrendingDown size={20} />}
                    color="purple"
                    subtitle="Disbursements"
                />
            </div>

            <DataTable
                columns={columns}
                data={rows}
                loading={loading}
                searchPlaceholder="Search petty cash vouchers..."
            />

            <PettyCashModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['petty_cash'] })}
                record={editingRecord}
            />
        </div>
    );
}
