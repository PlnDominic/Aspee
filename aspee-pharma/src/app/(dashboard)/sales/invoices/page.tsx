'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import InvoiceModal from '@/components/InvoiceModal';
import InvoiceViewModal from '@/components/InvoiceViewModal';
import EntityLink from '@/components/EntityLink';
import { Plus, Download, FileText, Banknote, Clock, CheckCircle, Pencil, Trash2, Eye, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { exportToCsv } from '@/lib/csvExport';
import { formatCurrency } from '@/lib/formatCurrency';
import { useFetch, useAction, useTableData } from '@/lib/hooks';
import SendToMDModal from '@/components/SendToMDModal';

const normalizeInvoiceStatus = (status?: string | null) => {
    const normalized = (status || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (normalized === 'PARTIALLY PAID') return 'PARTIAL';
    return normalized || 'DRAFT';
};

const formatInvoiceStatus = (status?: string | null) => {
    switch (normalizeInvoiceStatus(status)) {
        case 'PAID': return 'Paid';
        case 'ISSUED': return 'Issued';
        case 'PARTIAL': return 'Partially Paid';
        case 'OVERDUE': return 'Overdue';
        case 'CANCELLED': return 'Cancelled';
        case 'DRAFT':
        default: return 'Draft';
    }
};

const statusVariant = (s: string) => {
    switch (normalizeInvoiceStatus(s)) {
        case 'PAID': return 'success';
        case 'ISSUED':
        case 'PARTIAL': return 'info';
        case 'OVERDUE': return 'danger';
        case 'DRAFT':
        default: return 'default';
    }
};

export default function InvoicesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<any>(null);

    // Server-side state
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const { data: pagedData, isLoading: loading } = useTableData<any>(
        'sales_invoices',
        {
            columns: `
                *,
                items:sales_invoice_items(
                    id, product_id, quantity, unit_price, discount_pct, discount_amount, total_price,
                    product:products(name, sku)
                )
            `,
            page,
            pageSize: 10,
            searchColumn: ['invoice_number', 'customer_name'],
            searchQuery: search,
            sortBy,
            sortOrder,
        }
    );

    const invoices = pagedData?.data ?? [];
    const total = pagedData?.total ?? 0;

    // Separate fetch for global stats (Scalability fix: don't calculate from paged rows)
    const { data: statsData } = useFetch<any>(
        ['sales_invoices_stats'],
        async () => {
            const { data, error } = await supabase
                .from('sales_invoices')
                .select('status, total_amount');
            
            if (error) return { data: null, error };

            const calc = (data || []).reduce((acc: any, curr: any) => {
                const status = normalizeInvoiceStatus(curr.status);
                const amt = Number(curr.total_amount) || 0;
                
                acc.total++;
                if (status !== 'DRAFT') acc.revenue += amt;
                if (['ISSUED', 'OVERDUE', 'PARTIAL'].includes(status)) acc.outstanding += amt;
                if (status === 'PAID') acc.paid += amt;
                
                return acc;
            }, { total: 0, revenue: 0, outstanding: 0, paid: 0 });

            return { data: calc, error: null };
        }
    );

    const stats = statsData ?? { total: 0, revenue: 0, outstanding: 0, paid: 0 };

    const saveMutation = useAction<any>({
        mutationFn: async (invoiceData: any) => {
            const { items, id, ...header } = invoiceData;
            const normalizedHeader = {
                ...header,
                status: normalizeInvoiceStatus(header.status ?? (id ? selectedInvoice?.status : 'ISSUED')),
            };
            const { error } = await supabase.rpc('post_sales_invoice', {
                invoice_payload: id ? { ...normalizedHeader, id } : normalizedHeader,
                item_payload: items || [],
            });
            if (error) throw error;
        },
        invalidateKeys: ['sales_invoices', 'stock_levels', 'stock_movements'],
        successMessage: 'Invoice saved successfully!',
    });

    const deleteMutation = useAction<{ id: string; status: string }>({
        mutationFn: async ({ id, status }) => {
            if (normalizeInvoiceStatus(status) !== 'DRAFT') {
                throw new Error('Cannot delete an invoice that has already been issued.');
            }

            const { error: deleteItemsError } = await supabase.from('sales_invoice_items').delete().eq('invoice_id', id);
            if (deleteItemsError) throw deleteItemsError;

            const { error } = await supabase.from('sales_invoices').delete().eq('id', id);
            if (error) throw error;
        },
        invalidateKeys: ['sales_invoices'],
        successMessage: 'Invoice deleted.',
    });

    const handleSaveInvoice = async (invoiceData: any) => {
        await saveMutation.mutateAsync(invoiceData);
        setIsModalOpen(false);
    };

    const handleDeleteInvoice = async (id: string, currentStatus: string) => {
        if (normalizeInvoiceStatus(currentStatus) !== 'DRAFT') {
            toast.error('Cannot delete an invoice that has already been issued.');
            return;
        }

        if (!confirm('Are you sure you want to delete this invoice?')) return;
        await deleteMutation.mutateAsync({ id, status: currentStatus });
    };

    const handleExport = () => {
        try {
            exportToCsv(
                `sales_invoices_${new Date().toISOString().split('T')[0]}.csv`,
                invoices,
                [
                    { header: 'Invoice No.', accessor: (r) => r.invoice_number },
                    { header: 'Customer', accessor: (r) => r.customer_name },
                    { header: 'Date', accessor: (r) => r.date ? new Date(r.date).toLocaleDateString() : '' },
                    { header: 'Type', accessor: (r) => r.type },
                    { header: 'Total', accessor: (r) => r.total_amount },
                    { header: 'Status', accessor: (r) => formatInvoiceStatus(r.status) },
                ]
            );
            toast.success('Exported to CSV successfully');
        } catch (e: any) {
            toast.error(e?.message || 'No data to export');
        }
    };

    const columns = [
        { key: 'invoice_number', label: 'Invoice No.', render: (v: unknown) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span> },
        { key: 'customer_name', label: 'Customer', render: (v: unknown) => v ? <EntityLink href={`/customers?search=${encodeURIComponent(v as string)}`}>{v as string}</EntityLink> : '-' },
        { key: 'date', label: 'Date', render: (v: unknown) => new Date(v as string).toLocaleDateString() },
        {
            key: 'type', label: 'Type', render: (v: unknown) => (
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: v === 'Cash Sale' ? 'var(--success-light)' : v === 'Credit Sale' ? 'var(--info-light)' : 'var(--slate-100)', color: v === 'Cash Sale' ? '#047857' : v === 'Credit Sale' ? '#0e7490' : 'var(--slate-600)' }}>{v as string}</span>
            )
        },
        { key: 'total_amount', label: 'Total', render: (v: unknown, row: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v as number, row.currency)}</span> },
        { key: 'status', label: 'Status', render: (v: unknown) => <StatusBadge status={formatInvoiceStatus(v as string)} variant={statusVariant(v as string)} /> },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => setViewInvoice(row)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedInvoice(row); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>
                    {normalizeInvoiceStatus(row.status) === 'DRAFT' && (
                        <button
                            onClick={() => handleDeleteInvoice(row.id, row.status)}
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Invoices"
                subtitle="Create and manage sales invoices"
                breadcrumbs={[{ label: 'Sales', href: '/sales/invoices' }, { label: 'Invoices' }]}
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
                            onClick={handleExport}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 500, color: 'var(--slate-700)', cursor: 'pointer' }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={() => { setSelectedInvoice(null); setIsModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                        >
                            <Plus size={16} /> New Invoice
                        </button>
                    </div>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Invoices" value={stats.total} icon={<FileText size={20} />} color="blue" />
                <StatCard title="Revenue" value={`GHs ${stats.revenue.toFixed(2)}`} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Outstanding" value={`GHs ${stats.outstanding.toFixed(2)}`} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Paid" value={`GHs ${stats.paid.toFixed(2)}`} icon={<CheckCircle size={20} />} color="teal" />
            </div>

            <DataTable
                columns={columns}
                data={invoices}
                loading={loading}
                searchPlaceholder="Search invoices..."
                serverSide
                total={total}
                page={page}
                onPageChange={setPage}
                onSearchChange={(q) => { setSearch(q); setPage(1); }}
                onSortChange={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                currentSearch={search}
                currentSortKey={sortBy}
                currentSortDir={sortOrder}
                onRowClick={(row) => setViewInvoice(row)}
            />

            <InvoiceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveInvoice}
                record={selectedInvoice}
            />

            <SendToMDModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                department="Sales"
            />

            <InvoiceViewModal
                isOpen={!!viewInvoice}
                onClose={() => setViewInvoice(null)}
                invoice={viewInvoice}
            />
        </div>
    );
}
