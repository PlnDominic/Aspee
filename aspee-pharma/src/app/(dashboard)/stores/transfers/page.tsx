'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import EntityLink from '@/components/EntityLink';
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
            const { error } = await supabase.rpc('post_stock_transfer', {
                transfer_payload: id ? { ...header, id } : header,
                item_payload: items || [],
            });

            if (error) throw error;
        },
        invalidateKeys: ['stock_transfers', 'stock_levels', 'stock-levels-matrix', 'stock_movements'],
        successMessage: 'Transfer saved successfully',
    });

    const handleSaveTransfer = async (transferData: any) => {
        await saveTransfer.mutateAsync(transferData);
    };

    const handleDeleteTransfer = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transfer record?')) return;
        try {
            const { error } = await supabase.rpc('delete_stock_transfer', { transfer_uuid: id });
            if (error) throw error;

            toast.success('Transfer deleted');
            queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
            queryClient.invalidateQueries({ queryKey: ['stock_levels'] });
            queryClient.invalidateQueries({ queryKey: ['stock-levels-matrix'] });
            queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
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
        {
            key: 'from',
            label: 'From Source',
            render: (v: any) => v?.name
                ? <EntityLink href={`/stores/stock?search=${encodeURIComponent(v.name)}`} subtle title="View stock at this location">{v.name}</EntityLink>
                : <span>-</span>,
        },
        {
            key: 'to',
            label: 'Destination',
            render: (v: any) => v?.name
                ? <EntityLink href={`/stores/stock?search=${encodeURIComponent(v.name)}`} subtle title="View stock at this location">{v.name}</EntityLink>
                : <span>-</span>,
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
                subtitle="Inter-location stock movements with Sales flow routed through Sales Department"
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
