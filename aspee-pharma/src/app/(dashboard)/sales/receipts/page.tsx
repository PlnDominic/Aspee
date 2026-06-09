'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ReceiptModal from '@/components/ReceiptModal';
import EntityLink from '@/components/EntityLink';
import { CreditCard, Banknote, CheckCircle, Clock, Eye, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import ReceiptViewModal from '@/components/ReceiptViewModal';

export default function ReceiptsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewReceipt, setViewReceipt] = useState<any>(null);
    const [editReceipt, setEditReceipt] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: receiptsList, isLoading: loading } = useFetch<any[]>(
        ['sales_receipts'],
        async () => {
            const { data: receipts, error: receiptsError } = await supabase
                .from('sales_receipts')
                .select('*')
                .order('created_at', { ascending: false });

            if (receiptsError) {
                return { data: null, error: receiptsError };
            }

            const invoiceIds = Array.from(
                new Set((receipts || []).map((row: any) => row.invoice_id).filter(Boolean)),
            );

            const invoiceSalespersonMap = new Map<string, string | null>();
            if (invoiceIds.length > 0) {
                const { data: invoices, error: invoicesError } = await supabase
                    .from('sales_invoices')
                    .select('id, salesperson_id, route_id')
                    .in('id', invoiceIds);

                if (invoicesError) {
                    return { data: null, error: invoicesError };
                }

                const salespersonIds = Array.from(
                    new Set((invoices || []).map((invoice: any) => invoice.salesperson_id).filter(Boolean)),
                );
                const salespersonNameMap = new Map<string, string>();
                if (salespersonIds.length > 0) {
                    const { data: salespeople, error: salespeopleError } = await supabase
                        .from('system_users')
                        .select('id, name')
                        .in('id', salespersonIds);

                    if (salespeopleError) {
                        return { data: null, error: salespeopleError };
                    }

                    (salespeople || []).forEach((person: any) => {
                        if (person.name) salespersonNameMap.set(person.id, person.name);
                    });
                }

                const routeIds = Array.from(
                    new Set((invoices || []).map((invoice: any) => invoice.route_id).filter(Boolean)),
                );
                const vanNameMap = new Map<string, string>();
                if (routeIds.length > 0) {
                    const { data: vans, error: vansError } = await supabase
                        .from('vans')
                        .select('id, driver_name')
                        .in('id', routeIds);

                    if (vansError) {
                        return { data: null, error: vansError };
                    }

                    (vans || []).forEach((van: any) => {
                        if (van.driver_name) vanNameMap.set(van.id, van.driver_name);
                    });
                }

                (invoices || []).forEach((invoice: any) => {
                    invoiceSalespersonMap.set(
                        invoice.id,
                        (invoice.salesperson_id ? salespersonNameMap.get(invoice.salesperson_id) : null)
                            ?? (invoice.route_id ? vanNameMap.get(invoice.route_id) : null)
                            ?? null,
                    );
                });
            }

            const mapped = (receipts || []).map((r: any) => ({
                ...r,
                salesperson_name: r.invoice_id ? invoiceSalespersonMap.get(r.invoice_id) ?? null : null,
            }));
            return { data: mapped, error: null };
        },
    );

    const receipts = receiptsList ?? [];

    const handleReceiptSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['sales_receipts'] });
    };

    const handleEditReceipt = (row: any) => {
        setEditReceipt(row);
        setIsModalOpen(true);
    };

    const handleDeleteReceipt = async (receipt: any) => {
        if (receipt.status === 'Confirmed' || receipt.status === 'Cleared') {
            toast.error('Cannot delete a confirmed receipt. Void it instead.');
            return;
        }
        if (!confirm(`Delete receipt ${receipt.receipt_number}? This cannot be undone.`)) return;
        try {
            const { error } = await supabase.from('sales_receipts').delete().eq('id', receipt.id);
            if (error) throw error;
            toast.success('Receipt deleted');
            queryClient.invalidateQueries({ queryKey: ['sales_receipts'] });
        } catch (err: any) {
            toast.error('Failed to delete receipt: ' + err.message);
        }
    };

    const columns = [
        {
            key: 'receipt_number',
            label: 'Receipt No.',
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span>
        },
        {
            key: 'invoice_number',
            label: 'Invoice Ref',
            render: (v: any) => v ? <EntityLink href={`/sales/invoices?search=${encodeURIComponent(v)}`} mono subtle>{v}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>-</span>
        },
        { key: 'customer_name', label: 'Customer', render: (v: any) => v ? <EntityLink href={`/customers?search=${encodeURIComponent(v)}`}>{v}</EntityLink> : '-' },
        { key: 'salesperson_name', label: 'Sales Person', render: (v: any) => v || <span style={{ color: 'var(--slate-400)' }}>-</span> },
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
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={() => setViewReceipt(row)}
                        title="View Receipt"
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => handleEditReceipt(row)}
                        title="Edit Receipt"
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Pencil size={14} />
                    </button>
                    {row.status !== 'Confirmed' && row.status !== 'Cleared' && (
                        <button
                            onClick={() => handleDeleteReceipt(row)}
                            title="Delete Receipt"
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )
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
                onClose={() => { setIsModalOpen(false); setEditReceipt(null); }}
                onSuccess={handleReceiptSuccess}
                record={editReceipt}
            />

            <ReceiptViewModal
                isOpen={!!viewReceipt}
                onClose={() => setViewReceipt(null)}
                receipt={viewReceipt}
            />
        </div>
    );
}
