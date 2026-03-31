'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFetch, useAction } from '@/lib/hooks';
import { toast } from 'sonner';
import TransferModal from '@/components/TransferModal';
import { useQueryClient } from '@tanstack/react-query';

export default function TransfersPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: transfers = [], isLoading: loading } = useFetch<any[]>(
        ['stock_transfers', '*, from:stock_locations!from_location_id(name), to:stock_locations!to_location_id(name)'],
        async () => {
            const { data, error } = await supabase
                .from('stock_transfers')
                .select(`
                    *,
                    from:stock_locations!from_location_id(name),
                    to:stock_locations!to_location_id(name)
                `)
                .order('created_at', { ascending: false });
            return { data: data || [], error };
        }
    );

    const saveTransfer = useAction<any, void>({
        mutationFn: async (transferData: any) => {
            const { id, items, ...header } = transferData;
            if (!id) {
                // New Transfer
                const { data: headerData, error: headerError } = await supabase
                    .from('stock_transfers')
                    .insert([header])
                    .select()
                    .single();

                if (headerError) throw headerError;

                const itemsToSave = items.map((item: any) => ({
                    ...item,
                    transfer_id: headerData.id
                }));

                const { error: itemsError } = await supabase
                    .from('stock_transfer_items')
                    .insert(itemsToSave);

                if (itemsError) throw itemsError;
            } else {
                // Update header
                const { error: headerError } = await supabase
                    .from('stock_transfers')
                    .update(header)
                    .eq('id', id);

                if (headerError) throw headerError;

                // For simplified item update: delete all and re-insert
                await supabase.from('stock_transfer_items').delete().eq('transfer_id', id);

                const itemsToSave = items.map((item: any) => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    transfer_id: id
                }));

                const { error: itemsError } = await supabase
                    .from('stock_transfer_items')
                    .insert(itemsToSave);

                if (itemsError) throw itemsError;
            }
        },
        invalidateKeys: ['stock_transfers'],
        successMessage: 'Transfer saved successfully',
    });

    const handleSaveTransfer = async (transferData: any) => {
        await saveTransfer.mutateAsync(transferData);
    };

    const handleDeleteTransfer = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transfer record?')) return;
        try {
            const { error } = await supabase.from('stock_transfers').delete().eq('id', id);
            if (error) throw error;
            toast.success('Transfer deleted');
            queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
        } catch (error: any) {
            toast.error('Error deleting transfer: ' + error.message);
        }
    };

    const columns = [
        {
            key: 'transfer_number',
            label: 'Reference',
            render: (v: any) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span>
        },
        {
            key: 'created_at',
            label: 'Date',
            render: (v: any) => new Date(v as string).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        },
        { key: 'from', label: 'From Source', render: (v: any) => <span style={{ fontWeight: 500 }}>{(v as any)?.name || '-'}</span> },
        { key: 'to', label: 'Destination', render: (v: any) => <span style={{ fontWeight: 500 }}>{(v as any)?.name || '-'}</span> },
        {
            key: 'status', label: 'Status', render: (v: any) => {
                const variant = v === 'Completed' ? 'success' : v === 'Pending' ? 'warning' : 'info';
                return <StatusBadge status={v as string} variant={variant} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { setSelectedTransfer(row); setModalMode('view'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedTransfer(row); setModalMode('edit'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={() => handleDeleteTransfer(row.id)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
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
                title="Stock Transfers"
                subtitle="Inter-location stock movements and transfers"
                breadcrumbs={[
                    { label: 'Stores', href: '/stores/transfers' },
                    { label: 'Transfers' },
                ]}
                actions={
                    <button
                        onClick={() => { setModalMode('create'); setSelectedTransfer(null); setIsModalOpen(true); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> New Transfer
                    </button>
                }
            />
            <DataTable
                columns={columns}
                data={transfers}
                loading={loading}
                searchPlaceholder="Search transfers by ID or location..."
            />

            <TransferModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransfer}
                initialData={selectedTransfer}
                mode={modalMode}
            />
        </div>
    );
}

// Fixed color variable naming
const varReg = (name: string) => `var(--${name})`;
