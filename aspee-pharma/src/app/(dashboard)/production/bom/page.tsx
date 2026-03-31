'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import BOMModal from '@/components/BOMModal';
import { Plus, Package, FileText, CheckCircle, AlertTriangle, Eye, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useFetch, useAction } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

interface BOM {
    id: string;
    name: string;
    finished_product_id: string;
    finished_product?: {
        name: string;
        sku: string;
    };
    version: string;
    is_active: boolean;
    notes: string;
    created_at: string;
    item_count?: number;
}

export default function BOMPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedBOM, setSelectedBOM] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: boms = [], isLoading: loading } = useFetch<any[]>(
        ['bill_of_materials', 'with-counts'],
        async () => {
            const { data, error } = await supabase
                .from('bill_of_materials')
                .select(`
                    *,
                    finished_product:products(name, sku)
                `)
                .order('created_at', { ascending: false });

            if (error) return { data: null, error };

            const bomsWithCounts = await Promise.all((data || []).map(async (bom: any) => {
                try {
                    const { count } = await supabase
                        .from('bom_items')
                        .select('*', { count: 'exact', head: true })
                        .eq('bom_id', bom.id);

                    return { ...bom, item_count: count || 0 };
                } catch {
                    return { ...bom, item_count: 0 };
                }
            }));

            return { data: bomsWithCounts, error: null };
        }
    );

    const saveBOM = useAction<any, void>({
        mutationFn: async (bomData: any) => {
            const { id, items, finished_product, item_count, created_at, ...header } = bomData;

            if (id) {
                const { error } = await supabase
                    .from('bill_of_materials')
                    .update(header)
                    .eq('id', id);

                if (error) throw error;

                await supabase.from('bom_items').delete().eq('bom_id', id);

                if (items && items.length > 0) {
                    const itemsToSave = items.map((item: any, index: number) => ({
                        bom_id: id,
                        component_id: item.component_id,
                        quantity_required: item.quantity_required,
                        unit: item.unit || 'Pieces',
                        unit_ratio: item.unit_ratio || 1,
                        notes: item.notes || '',
                        position: index
                    }));

                    const { error: itemsError } = await supabase
                        .from('bom_items')
                        .insert(itemsToSave);

                    if (itemsError) throw itemsError;
                }
            } else {
                const { data: headerData, error: headerError } = await supabase
                    .from('bill_of_materials')
                    .insert([header])
                    .select()
                    .single();

                if (headerError) throw headerError;

                if (items && items.length > 0) {
                    const itemsToSave = items.map((item: any, index: number) => ({
                        bom_id: headerData.id,
                        component_id: item.component_id,
                        quantity_required: item.quantity_required,
                        unit: item.unit || 'Pieces',
                        unit_ratio: item.unit_ratio || 1,
                        notes: item.notes || '',
                        position: index
                    }));

                    const { error: itemsError } = await supabase
                        .from('bom_items')
                        .insert(itemsToSave);

                    if (itemsError) throw itemsError;
                }
            }
        },
        invalidateKeys: ['bill_of_materials'],
        successMessage: 'BOM saved successfully',
    });

    const handleSaveBOM = async (bomData: any) => {
        await saveBOM.mutateAsync(bomData);
    };

    const handleDeleteBOM = async (id: string) => {
        if (!confirm('Are you sure you want to delete this BOM? This action cannot be undone.')) return;

        try {
            await supabase.from('bom_items').delete().eq('bom_id', id);

            const { error } = await supabase.from('bill_of_materials').delete().eq('id', id);
            if (error) throw error;

            toast.success('BOM deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['bill_of_materials'] });
        } catch (error: any) {
            toast.error('Error deleting BOM: ' + error.message);
        }
    };

    const handleDuplicateBOM = async (bom: BOM) => {
        try {
            const { data: items } = await supabase
                .from('bom_items')
                .select('*')
                .eq('bom_id', bom.id);

            const newBOM = {
                name: `${bom.name} (Copy)`,
                finished_product_id: bom.finished_product_id,
                version: '1.0',
                is_active: true,
                notes: bom.notes,
                items: items?.map((item: any) => ({
                    component_id: item.component_id,
                    quantity_required: item.quantity_required,
                    unit: item.unit,
                    unit_ratio: item.unit_ratio,
                    notes: item.notes
                })) || []
            };

            await handleSaveBOM(newBOM);
            toast.success('BOM duplicated successfully');
        } catch (error: any) {
            toast.error('Error duplicating BOM: ' + error.message);
        }
    };

    const columns = [
        {
            key: 'name',
            label: 'BOM Name',
            render: (v: unknown, row: any) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--slate-800)' }}>{v as string}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-500)' }}>Version {row.version}</div>
                </div>
            )
        },
        {
            key: 'finished_product',
            label: 'Finished Product',
            render: (v: any) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{v?.name || '-'}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{v?.sku || '-'}</div>
                </div>
            )
        },
        {
            key: 'item_count',
            label: 'Components',
            render: (v: unknown) => (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'var(--slate-100)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--slate-700)'
                }}>
                    <Package size={12} />
                    {v as number} items
                </span>
            )
        },
        {
            key: 'is_active',
            label: 'Status',
            render: (v: boolean) => (
                <StatusBadge
                    status={v ? 'Active' : 'Inactive'}
                    variant={v ? 'success' : 'default'}
                />
            )
        },
        {
            key: 'created_at',
            label: 'Created',
            render: (v: unknown) => v ? new Date(v as string).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }) : '-'
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={() => { setSelectedBOM(row); setModalMode('view'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedBOM(row); setModalMode('edit'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={() => handleDuplicateBOM(row)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--amber-600)', cursor: 'pointer' }}
                        title="Duplicate"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        onClick={() => handleDeleteBOM(row.id)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    const stats = {
        total: boms.length,
        active: boms.filter(b => b.is_active).length,
        inactive: boms.filter(b => !b.is_active).length,
        totalComponents: boms.reduce((sum, b) => sum + (b.item_count || 0), 0)
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Bill of Materials"
                subtitle="Define and manage raw material compositions for finished products"
                breadcrumbs={[{ label: 'Production' }, { label: 'Bill of Materials' }]}
                actions={
                    <button
                        onClick={() => { setModalMode('create'); setSelectedBOM(null); setIsModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New BOM
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total BOMs" value={stats.total} icon={<FileText size={20} />} color="blue" />
                <StatCard title="Active BOMs" value={stats.active} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Inactive BOMs" value={stats.inactive} icon={<AlertTriangle size={20} />} color="amber" />
                <StatCard title="Total Components" value={stats.totalComponents} icon={<Package size={20} />} color="purple" />
            </div>

            <DataTable
                columns={columns}
                data={boms}
                loading={loading}
                searchPlaceholder="Search BOMs by name, product, or version..."
                emptyMessage="No BOMs found. Create your first Bill of Materials to get started."
            />

            <BOMModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveBOM}
                initialData={selectedBOM}
                mode={modalMode}
            />
        </div>
    );
}
