'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import TaxPeriodModal from '@/components/TaxPeriodModal';
import { Plus, Banknote, TrendingUp, TrendingDown, Calendar, Pencil } from 'lucide-react';
import { useSupabaseQuery } from '@/lib/hooks';
import { formatCurrency } from '@/lib/currency';

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (s) {
        case 'Filed': return 'success';
        case 'Open': return 'warning';
        case 'Overdue': return 'danger';
        default: return 'default';
    }
};

export default function TaxPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data, isLoading: loading } = useSupabaseQuery<any>('tax_periods', {
        orderBy: 'created_at',
        ascending: false,
    });
    const taxPeriods = data ?? [];

    // Live stat calculations
    const currentLiability = taxPeriods
        .filter((p: any) => p.status === 'Open')
        .reduce((sum: number, p: any) => sum + (Number(p.net_liability) || 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const mtdPeriods = taxPeriods.filter((p: any) => {
        const start = p.start_date;
        return start >= monthStart && start <= monthEnd;
    });

    const outputTaxMTD = mtdPeriods.reduce((sum: number, p: any) => sum + (Number(p.output_tax) || 0), 0);
    const inputTaxMTD = mtdPeriods.reduce((sum: number, p: any) => sum + (Number(p.input_tax) || 0), 0);

    const nextFiling = taxPeriods
        .filter((p: any) => p.status !== 'Filed' && p.due_date)
        .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))[0];

    const nextFilingDisplay = nextFiling
        ? new Date(nextFiling.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-';

    const columns = [
        {
            key: 'period',
            label: 'Period',
            render: (v: unknown) => (
                <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{v as string}</span>
            ),
        },
        {
            key: 'output_tax',
            label: 'Output Tax (Sales)',
            render: (v: unknown) => (
                <span style={{ fontWeight: 500 }}>{formatCurrency(Number(v) || 0)}</span>
            ),
        },
        {
            key: 'input_tax',
            label: 'Input Tax (Purchases)',
            render: (v: unknown) => (
                <span style={{ fontWeight: 500 }}>{formatCurrency(Number(v) || 0)}</span>
            ),
        },
        {
            key: 'net_liability',
            label: 'Net Liability',
            render: (v: unknown) => {
                const val = Number(v) || 0;
                return (
                    <span style={{ fontWeight: 700, color: val >= 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {formatCurrency(val)}
                    </span>
                );
            },
        },
        { key: 'sales_invoice_count', label: 'Sales Invoices' },
        { key: 'purchase_invoice_count', label: 'Purchase Invoices' },
        {
            key: 'due_date',
            label: 'Due Date',
            render: (v: unknown) =>
                v ? new Date(v as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => <StatusBadge status={v as string} variant={statusVariant(v as string)} />,
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => {
                            setSelectedRecord(row);
                            setIsModalOpen(true);
                        }}
                        style={{
                            padding: 6,
                            borderRadius: 6,
                            border: '1px solid var(--slate-200)',
                            background: 'var(--card-bg)',
                            color: 'var(--primary-600)',
                            cursor: 'pointer',
                        }}
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Tax Management"
                subtitle="VAT/GST tracking, calculations, and filing"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/tax' }, { label: 'Tax Management' }]}
                actions={
                    <button
                        onClick={() => {
                            setSelectedRecord(null);
                            setIsModalOpen(true);
                        }}
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
                        <Plus size={16} /> New Period
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Current Liability" value={formatCurrency(currentLiability)} icon={<Banknote size={20} />} color="red" />
                <StatCard title="Output Tax (MTD)" value={formatCurrency(outputTaxMTD)} icon={<TrendingUp size={20} />} color="blue" />
                <StatCard title="Input Tax (MTD)" value={formatCurrency(inputTaxMTD)} icon={<TrendingDown size={20} />} color="green" />
                <StatCard title="Next Filing" value={nextFilingDisplay} icon={<Calendar size={20} />} color="amber" />
            </div>

            <DataTable
                columns={columns}
                data={taxPeriods}
                loading={loading}
                searchPlaceholder="Search tax periods..."
                emptyMessage="No tax periods recorded yet. Click 'New Period' to get started."
            />

            <TaxPeriodModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tax_periods'] })}
                record={selectedRecord}
            />
        </div>
    );
}
