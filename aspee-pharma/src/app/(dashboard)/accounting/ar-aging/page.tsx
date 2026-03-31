'use client';

import React, { useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import { Download, BarChart3, AlertCircle, Clock } from 'lucide-react';
import { exportToCsv } from '@/lib/csvExport';
import { useFetch } from '@/lib/hooks';

type AgingBucket = '0-30 Days' | '31-60 Days' | '61-90 Days' | '90+ Days';

interface OutstandingInvoice {
    id: string;
    invoice_number: string;
    customer_name: string;
    date: string;
    total_amount: number;
    status: string;
    currency: string;
    daysOutstanding: number;
    bucket: AgingBucket;
}

export default function ARAgingPage() {
    const { data: rawInvoices, isLoading: loading } = useFetch<any[]>(
        ['ar_aging'],
        async () => {
            const result = await supabase
                .from('sales_invoices')
                .select('id, invoice_number, customer_name, date, total_amount, status, currency')
                .in('status', ['Issued', 'Partially Paid', 'Overdue'])
                .order('date', { ascending: true });
            return { data: result.data, error: result.error };
        }
    );

    const invoices: OutstandingInvoice[] = useMemo(() => {
        if (!rawInvoices) return [];
        const today = new Date();
        return rawInvoices.map(inv => {
            const invDate = new Date(inv.date);
            const diffTime = Math.abs(today.getTime() - invDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let bucket: AgingBucket = '0-30 Days';
            if (diffDays > 90) bucket = '90+ Days';
            else if (diffDays > 60) bucket = '61-90 Days';
            else if (diffDays > 30) bucket = '31-60 Days';

            return {
                ...inv,
                daysOutstanding: diffDays,
                bucket
            };
        });
    }, [rawInvoices]);

    const stats = {
        totalOutstanding: invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
        bucket0_30: invoices.filter(i => i.bucket === '0-30 Days').reduce((sum, inv) => sum + Number(inv.total_amount), 0),
        bucket31_60: invoices.filter(i => i.bucket === '31-60 Days').reduce((sum, inv) => sum + Number(inv.total_amount), 0),
        bucket61_90: invoices.filter(i => i.bucket === '61-90 Days').reduce((sum, inv) => sum + Number(inv.total_amount), 0),
        bucket90Plus: invoices.filter(i => i.bucket === '90+ Days').reduce((sum, inv) => sum + Number(inv.total_amount), 0),
    };

    const handleExport = () => {
        if (invoices.length === 0) {
            toast.error('No data to export');
            return;
        }

        exportToCsv(
            `Accounts_Receivable_Aging_${new Date().toISOString().split('T')[0]}.csv`,
            invoices,
            [
                { header: 'Invoice No.', accessor: (r) => r.invoice_number },
                { header: 'Customer', accessor: (r) => r.customer_name },
                { header: 'Date', accessor: (r) => new Date(r.date).toLocaleDateString() },
                { header: 'Days Outstanding', accessor: (r) => r.daysOutstanding },
                { header: 'Aging Bucket', accessor: (r) => r.bucket },
                { header: 'Amount', accessor: (r) => r.total_amount },
                { header: 'Status', accessor: (r) => r.status },
            ]
        );
        toast.success('Exported to CSV successfully');
    };

    const columns = [
        { key: 'invoice_number', label: 'Invoice No.', render: (v: unknown) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span> },
        { key: 'customer_name', label: 'Customer' },
        { key: 'date', label: 'Date', render: (v: unknown) => new Date(v as string).toLocaleDateString() },
        { key: 'daysOutstanding', label: 'Days Outstanding', render: (v: unknown) => <span style={{ fontWeight: 500 }}>{v as number} days</span> },
        { 
            key: 'bucket', 
            label: 'Aging Bucket',
            render: (v: unknown) => {
                const bucket = v as AgingBucket;
                let bg = 'var(--slate-100)';
                let color = 'var(--slate-700)';
                if (bucket === '0-30 Days') { bg = 'var(--info-light)'; color = '#0284c7'; }
                else if (bucket === '31-60 Days') { bg = 'var(--warning-light)'; color = '#b45309'; }
                else if (bucket === '61-90 Days') { bg = 'var(--danger-light)'; color = '#be123c'; }
                else if (bucket === '90+ Days') { bg = '#fef2f2'; color = '#9f1239'; }

                return (
                    <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: bg, color, border: bucket === '90+ Days' ? '1px solid #fecdd3' : 'none' }}>
                        {bucket}
                    </span>
                );
            }
        },
        { key: 'total_amount', label: 'Amount', render: (v: unknown, row: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v as number, row.currency)}</span> },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Accounts Receivable Aging"
                subtitle="Track outstanding invoices by age"
                breadcrumbs={[
                    { label: 'Accounting', href: '/accounting/journal' },
                    { label: 'A/R Aging' },
                ]}
                actions={
                    <button
                        onClick={handleExport}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 500, color: 'var(--slate-700)', cursor: 'pointer' }}
                    >
                        <Download size={16} /> Export
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Outstanding" value={`GH₵ ${stats.totalOutstanding.toFixed(2)}`} icon={<BarChart3 size={20} />} color="blue" />
                <StatCard title="0-30 Days" value={`GH₵ ${stats.bucket0_30.toFixed(2)}`} icon={<Clock size={20} />} color="teal" />
                <StatCard title="31-60 Days" value={`GH₵ ${stats.bucket31_60.toFixed(2)}`} icon={<Clock size={20} />} color="amber" />
                <StatCard title="61-90 Days" value={`GH₵ ${stats.bucket61_90.toFixed(2)}`} icon={<AlertCircle size={20} />} color="red" />
                <StatCard title="90+ Days" value={`GH₵ ${stats.bucket90Plus.toFixed(2)}`} icon={<AlertCircle size={20} />} color="red" />
            </div>

            <DataTable 
                columns={columns} 
                data={invoices as unknown as Record<string, unknown>[]} 
                loading={loading} 
                searchPlaceholder="Search invoices or customers..." 
            />
        </div>
    );
}
