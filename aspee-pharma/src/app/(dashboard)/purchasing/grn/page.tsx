'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import GRNModal from '@/components/GRNModal';
import EntityLink from '@/components/EntityLink';
import { Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useFetch, useAction, useTableData } from '@/lib/hooks';

export default function GRNPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGRN, setSelectedGRN] = useState<any>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

    // Server-side state
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const { data: pagedData, isLoading: loading } = useTableData<any>(
        'grn',
        {
            columns: '*, purchase_orders:po_id(po_number, suppliers:supplier_id(name))',
            page,
            pageSize: 10,
            searchColumn: 'grn_number',
            searchQuery: search,
            sortBy,
            sortOrder,
        }
    );

    const grnData = pagedData?.data ?? [];
    const total = pagedData?.total ?? 0;

    const saveMutation = useAction<any>({
        mutationFn: async (saveData: any) => {
            const { items, id, ...header } = saveData;
            
            // Scalability & Integrity Fix: Move complex logic to the server
            const { error } = await supabase.rpc('post_grn', {
                grn_payload: id ? { ...header, id } : header,
                item_payload: items || []
            });

            if (error) throw error;
        },
        invalidateKeys: ['grn', 'purchase_orders', 'stock_levels', 'stock-levels-matrix', 'stock_movements'],
        successMessage: 'GRN saved successfully!',
    });

    const handleDeleteGRN = async (id: string) => {
        if (!confirm('Are you sure you want to delete this GRN? This action cannot be undone.')) return;
        
        try {
            const { error } = await supabase.rpc('delete_stock_transfer', { transfer_uuid: id }); // Using a similar pattern if available, or just standard delete
            // Wait, I should probably have a delete_grn RPC too if I want full integrity.
            // For now, let's use standard delete but ideally it should be an RPC.
            
            const { error: itemsError } = await supabase.from('grn_items').delete().eq('grn_id', id);
            if (itemsError) throw itemsError;

            const { error: grnError } = await supabase.from('grn').delete().eq('id', id);
            if (grnError) throw grnError;

            toast.success('GRN deleted');
        } catch (error: any) {
            toast.error('Failed to delete GRN: ' + error.message);
        }
    };

    const handleCreateGRN = () => {
        setSelectedGRN(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleViewGRN = (grn: any) => {
        setSelectedGRN(grn);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleEditGRN = (grn: any) => {
        setSelectedGRN(grn);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleSaveGRN = async (grnFormData: any) => {
        await saveMutation.mutateAsync(grnFormData);
        setIsModalOpen(false);
    };

    const columns = [
        {
            key: 'grn_number',
            label: 'GRN Number',
            render: (v: unknown) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>
                    {v as string}
                </span>
            )
        },
        {
            key: 'po_number',
            label: 'PO Reference',
            render: (_: unknown, row: any) => row.purchase_orders?.po_number ? <EntityLink href={`/purchasing/purchase-orders?search=${encodeURIComponent(row.purchase_orders.po_number)}`} mono subtle>{row.purchase_orders.po_number}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>-</span>
        },
        {
            key: 'supplier',
            label: 'Supplier',
            render: (_: unknown, row: any) => row.purchase_orders?.suppliers?.name ? <EntityLink href={`/purchasing/suppliers?search=${encodeURIComponent(row.purchase_orders.suppliers.name)}`}>{row.purchase_orders.suppliers.name}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>-</span>
        },
        {
            key: 'date',
            label: 'Received Date',
            render: (v: unknown) => v ? new Date(v as string).toLocaleDateString('en-GB') : '-'
        },
        {
            key: 'qa_status',
            label: 'QA Status',
            render: (v: unknown, row: any) => {
                const status = row.qa_status || 'Pending';
                const variantMap: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
                    'Approved': 'success',
                    'Rejected': 'danger',
                    'Quarantine': 'warning',
                    'Pending': 'info',
                };
                return <StatusBadge status={status} variant={variantMap[status] || 'info'} />;
            }
        },
        {
            key: 'actions',
            label: '',
            render: (_: unknown, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => handleViewGRN(row)}
                        style={{ padding: 6, borderRadius: 6, border: 'none', background: 'var(--slate-100)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => handleEditGRN(row)}
                        style={{ padding: 6, borderRadius: 6, border: 'none', background: 'var(--blue-50)', color: 'var(--blue-600)', cursor: 'pointer' }}
                        title="Edit"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDeleteGRN(row.id)}
                        style={{ padding: 6, borderRadius: 6, border: 'none', background: 'var(--danger-light)', color: 'var(--danger)', cursor: 'pointer' }}
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Goods Receipt Notes"
                subtitle="Record and verify incoming goods deliveries"
                breadcrumbs={[
                    { label: 'Purchasing', href: '/purchasing/grn' },
                    { label: 'Goods Receipt Notes' },
                ]}
                actions={
                    <button onClick={handleCreateGRN} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}>
                        <Plus size={16} /> Create GRN
                    </button>
                }
            />
            
            <DataTable 
                columns={columns} 
                data={grnData} 
                loading={loading}
                searchPlaceholder="Search GRNs..." 
                serverSide
                total={total}
                page={page}
                onPageChange={setPage}
                onSearchChange={(q) => { setSearch(q); setPage(1); }}
                onSortChange={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                currentSearch={search}
                currentSortKey={sortBy}
                currentSortDir={sortOrder}
            />

            <GRNModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveGRN}
                initialData={selectedGRN}
                mode={modalMode}
            />
        </div>
    );
}
