'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import CreditNoteModal from '@/components/CreditNoteModal';
import EntityLink from '@/components/EntityLink';
import { Plus, FileText, Banknote, Clock, CheckCircle, Edit2, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

export default function CreditNotesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [viewOnly, setViewOnly] = useState(false);
    const queryClient = useQueryClient();

    const { data: creditNotesList, isLoading: loading, error } = useFetch<any[]>(
        ['credit_notes'],
        async () => {
            // Try with invoice join first; fall back to plain select if FK not yet in schema cache
            let result = await supabase
                .from('credit_notes')
                .select(`
                    *,
                    invoice:sales_invoices(invoice_number, total_amount, status)
                `)
                .order('created_at', { ascending: false });

            if (result.error?.message?.includes('relationship')) {
                result = await supabase
                    .from('credit_notes')
                    .select('*')
                    .order('created_at', { ascending: false });
            }

            if (result.error) {
                console.error('Error fetching credit notes:', result.error);
            }
            return { data: result.data, error: result.error };
        },
    );

    const creditNotes = creditNotesList ?? [];

    const handleView = (row: any) => {
        setEditingRecord(row);
        setViewOnly(true);
        setIsModalOpen(true);
    };

    const handleEdit = (row: any) => {
        setEditingRecord(row);
        setViewOnly(false);
        setIsModalOpen(true);
    };

    const handleNewCreditNote = () => {
        setEditingRecord(null);
        setViewOnly(false);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
        setViewOnly(false);
    };

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
    };

    const handleDelete = async (row: any) => {
        if (row.status !== 'Draft') {
            toast.error('Only draft credit notes can be deleted.');
            return;
        }
        if (!confirm(`Delete credit note ${row.cn_number}? This cannot be undone.`)) return;
        try {
            const { error } = await supabase.from('credit_notes').delete().eq('id', row.id);
            if (error) throw error;
            toast.success('Credit note deleted');
            queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
        } catch (err: any) {
            toast.error('Failed to delete: ' + err.message);
        }
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
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleView(row); }}
                        title="View"
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                        title="Edit"
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Edit2 size={14} />
                    </button>
                    {row.status === 'Draft' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                            title="Delete"
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

            {/* Error Display */}
            {error && (
                <div style={{
                    padding: '12px 16px',
                    marginBottom: 16,
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: 13,
                }}>
                    <strong>Error loading credit notes:</strong> {error.message || 'Unknown error'}
                </div>
            )}

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
                readOnly={viewOnly}
            />
        </div>
    );
}
