'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import CreditNoteModal from '@/components/CreditNoteModal';
import EntityLink from '@/components/EntityLink';
import { Plus, FileText, Banknote, Clock, CheckCircle, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

export default function CreditNotesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: creditNotesList, isLoading: loading } = useFetch<any[]>(
        ['credit_notes', '*, invoice:sales_invoices(invoice_number, total_amount, status)'],
        async () => {
            const result = await supabase
                .from('credit_notes')
                .select(`
                    *,
                    invoice:sales_invoices(invoice_number, total_amount, status)
                `)
                .order('created_at', { ascending: false });
            return { data: result.data, error: result.error };
        },
    );

    const creditNotes = creditNotesList ?? [];

    const handleEdit = (row: any) => {
        setEditingRecord(row);
        setIsModalOpen(true);
    };

    const handleNewCreditNote = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
    };

    const columns = [
        {
            key: 'cn_number',
            label: 'CN Number',
            render: (v: string) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span>
            )
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
            key: 'reason',
            label: 'Reason',
            render: (v: string) => (
                <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    background: v === 'Product Return' ? '#fef3c7' :
                        v === 'Damaged Goods' ? 'var(--danger-light)' :
                            v === 'Price Adjustment' ? 'var(--info-light)' :
                                'var(--slate-100)',
                    color: v === 'Product Return' ? '#92400e' :
                        v === 'Damaged Goods' ? 'var(--danger)' :
                            v === 'Price Adjustment' ? '#0e7490' :
                                'var(--slate-600)'
                }}>
                    {v}
                </span>
            )
        },
        {
            key: 'amount',
            label: 'Amount',
            render: (v: number) => (
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                    {formatCurrency(v || 0)}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: string) => {
                const variant = v === 'Applied' ? 'success' : v === 'Approved' ? 'info' : 'warning';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        {
            key: 'id',
            label: 'Actions',
            render: (_v: string, row: any) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(row);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--slate-200)',
                        background: 'var(--card-bg)',
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--slate-600)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-300)';
                        e.currentTarget.style.color = 'var(--primary-600)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--slate-200)';
                        e.currentTarget.style.color = 'var(--slate-600)';
                    }}
                >
                    <Edit2 size={13} /> Edit
                </button>
            )
        },
    ];

    const stats = {
        total: creditNotes.length,
        totalValue: creditNotes.reduce((sum: number, cn: any) => sum + Number(cn.amount || 0), 0),
        pending: creditNotes.filter((cn: any) => cn.status === 'Draft').length,
        applied: creditNotes.filter((cn: any) => cn.status === 'Applied').length,
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Credit Notes"
                subtitle="Returns, price corrections, and sales adjustments"
                breadcrumbs={[{ label: 'Sales', href: '/sales/credit-notes' }, { label: 'Credit Notes' }]}
                actions={
                    <button
                        onClick={handleNewCreditNote}
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
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={16} /> New Credit Note
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Credit Notes" value={stats.total} icon={<FileText size={20} />} color="blue" />
                <StatCard title="Total Value" value={formatCurrency(stats.totalValue)} icon={<Banknote size={20} />} color="red" />
                <StatCard title="Pending (Draft)" value={stats.pending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Applied" value={stats.applied} icon={<CheckCircle size={20} />} color="green" />
            </div>

            <DataTable
                columns={columns}
                data={creditNotes}
                loading={loading}
                searchPlaceholder="Search credit notes..."
                emptyMessage="No credit notes found. Click 'New Credit Note' to create one."
            />

            <CreditNoteModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSuccess={handleSuccess}
                record={editingRecord}
            />
        </div>
    );
}
