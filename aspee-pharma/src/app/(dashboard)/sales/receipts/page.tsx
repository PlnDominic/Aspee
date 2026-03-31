'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ReceiptModal from '@/components/ReceiptModal';
import EntityLink from '@/components/EntityLink';
import { Plus, CreditCard, Banknote, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

export default function ReceiptsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: receiptsList, isLoading: loading } = useFetch<any[]>(
        ['sales_receipts', '*, invoice:sales_invoices(invoice_number)'],
        async () => {
            const result = await supabase
                .from('sales_receipts')
                .select(`
                    *,
                    invoice:sales_invoices(invoice_number)
                `)
                .order('created_at', { ascending: false });
            return { data: result.data, error: result.error };
        },
    );

    const receipts = receiptsList ?? [];

    const handleReceiptSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['sales_receipts'] });
    };

    const columns = [
        {
            key: 'receipt_number',
            label: 'Receipt No.',
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span>
        },
        {
            key: 'invoice',
            label: 'Invoice Ref',
            render: (v: any) => v?.invoice_number ? <EntityLink href={`/sales/invoices?search=${encodeURIComponent(v.invoice_number)}`} mono subtle>{v.invoice_number}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>-</span>
        },
        { key: 'customer_name', label: 'Customer', render: (v: any) => v ? <EntityLink href={`/customers?search=${encodeURIComponent(v)}`}>{v}</EntityLink> : '-' },
        {
            key: 'date',
            label: 'Date',
            render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
        },
        {
            key: 'payment_method',
            label: 'Method',
            render: (v: string) => (
                <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    background: v === 'Cash' ? 'var(--success-light)' : v === 'Mobile Money' ? '#fef3c7' : 'var(--info-light)',
                    color: v === 'Cash' ? '#047857' : v === 'Mobile Money' ? '#92400e' : '#0e7490'
                }}>
                    {v}
                </span>
            )
        },
        {
            key: 'amount',
            label: 'Amount',
            render: (v: number) => <span style={{ fontWeight: 700 }}>{formatCurrency(v || 0)}</span>
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: string) => {
                const variant = v === 'Confirmed' || v === 'Cleared' ? 'success' : 'warning';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
    ];

    const stats = {
        total: receipts.length,
        totalAmount: receipts.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0),
        cash: receipts.filter((r: any) => r.payment_method === 'Cash').reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0),
        other: receipts.filter((r: any) => r.payment_method !== 'Cash').reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0),
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Receipts"
                subtitle="Payment receipts and collections"
                breadcrumbs={[{ label: 'Sales', href: '/sales/receipts' }, { label: 'Receipts' }]}
                actions={
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Record Receipt
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Receipts" value={stats.total} icon={<CreditCard size={20} />} color="blue" />
                <StatCard title="Total Collected" value={formatCurrency(stats.totalAmount)} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Cash Payments" value={formatCurrency(stats.cash)} icon={<CheckCircle size={20} />} color="teal" />
                <StatCard title="Other Methods" value={formatCurrency(stats.other)} icon={<Clock size={20} />} color="amber" />
            </div>

            <DataTable columns={columns} data={receipts} loading={loading} searchPlaceholder="Search receipts..." />

            <ReceiptModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleReceiptSuccess}
            />
        </div>
    );
}
