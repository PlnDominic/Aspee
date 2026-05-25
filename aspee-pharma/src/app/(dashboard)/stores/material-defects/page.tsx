'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Eye, Trash2, AlertTriangle, Package, Hash, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFetch, useAction } from '@/lib/hooks';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import MaterialDefectModal from '@/components/MaterialDefectModal';

const DEFECT_COLORS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    'Breakage': 'warning',
    'Leakage': 'warning',
    'Spillage': 'danger',
    'Contamination': 'danger',
    'Damaged Packaging': 'warning',
    'Manufacturing Defect': 'danger',
    'Other': 'default',
};

export default function MaterialDefectsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'view'>('create');
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: records = [], isLoading: loading } = useFetch<any[]>(
        ['stock_material_defects'],
        async () => {
            const { data, error } = await supabase
                .from('stock_material_defects')
                .select(`
                    *,
                    product:products(id, name, sku, unit),
                    location:stock_locations(id, name)
                `)
                .order('created_at', { ascending: false });
            return { data: data || [], error };
        }
    );

    const deductStock = async (productId: string, locationId: string, quantity: number, referenceId: string, refNumber: string) => {
        const { data: rows, error } = await supabase
            .from('stock_levels')
            .select('id, qty_on_hand')
            .eq('product_id', productId)
            .eq('location_id', locationId)
            .order('qty_on_hand', { ascending: false });
        if (error) throw error;

        const totalAvailable = (rows || []).reduce((sum, r) => sum + Number(r.qty_on_hand || 0), 0);
        if (totalAvailable < quantity) throw new Error('Insufficient stock at the selected location.');

        const mainRow = rows?.[0];
        if (!mainRow) throw new Error('No stock record found for this product at the selected location.');

        const { error: updateError } = await supabase
            .from('stock_levels')
            .update({ qty_on_hand: Number(mainRow.qty_on_hand) - quantity, updated_at: new Date().toISOString() })
            .eq('id', mainRow.id);
        if (updateError) throw updateError;

        const { error: movementError } = await supabase
            .from('stock_movements')
            .insert([{
                product_id: productId,
                movement_type: 'OUT',
                quantity,
                reference_type: 'Material Defect',
                reference_id: referenceId,
                notes: `Material Defect ${refNumber}`,
            }]);
        if (movementError) throw movementError;
    };

    const saveRecord = useAction<any, void>({
        mutationFn: async (formData: any) => {
            const id = crypto.randomUUID();
            const { error } = await supabase
                .from('stock_material_defects')
                .insert([{ ...formData, id }]);
            if (error) throw error;
            await deductStock(formData.product_id, formData.location_id, formData.quantity, id, formData.reference_number);
        },
        invalidateKeys: ['stock_material_defects', 'stock_levels', 'stock-levels-matrix', 'stock_movements'],
        successMessage: 'Material defect logged and stock adjusted',
    });

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this defect record? Stock will NOT be restored automatically.')) return;
        const { error } = await supabase.from('stock_material_defects').delete().eq('id', id);
        if (error) { toast.error(error.message); return; }
        toast.success('Record deleted');
        queryClient.invalidateQueries({ queryKey: ['stock_material_defects'] });
    };

    const handleExport = () => {
        if (records.length === 0) return;
        const headers = ['Reference', 'Date', 'Product', 'SKU', 'Location', 'Qty', 'Unit', 'Defect Type', 'Batch #', 'Notes'];
        const csv = [
            headers.join(','),
            ...records.map(r => [
                `"${r.reference_number}"`, `"${r.date}"`,
                `"${r.product?.name || ''}"`, `"${r.product?.sku || ''}"`,
                `"${r.location?.name || ''}"`, r.quantity, `"${r.product?.unit || ''}"`,
                `"${r.defect_type}"`, `"${r.batch_number || ''}"`,
                `"${(r.notes || '').replace(/"/g, '""')}"`,
            ].join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `material_defects_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalUnits = records.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const uniqueProducts = new Set(records.map(r => r.product_id)).size;
    const criticalDefects = records.filter(r => r.defect_type === 'Contamination' || r.defect_type === 'Manufacturing Defect').length;

    const columns = [
        {
            key: 'reference_number',
            label: 'Reference',
            render: (v: any) => <span style={{ fontWeight: 600, color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>,
        },
        {
            key: 'date',
            label: 'Date',
            render: (v: any) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'product',
            label: 'Product',
            render: (v: any, row: any) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v?.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>{v?.sku}</div>
                </div>
            ),
        },
        {
            key: 'location',
            label: 'Location',
            render: (v: any) => <span style={{ fontSize: 12 }}>{v?.name || '-'}</span>,
        },
        {
            key: 'quantity',
            label: 'Qty',
            render: (v: any, row: any) => (
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                    -{Number(v).toLocaleString()} {row.product?.unit}
                </span>
            ),
        },
        {
            key: 'defect_type',
            label: 'Defect Type',
            render: (v: any) => <StatusBadge status={v} variant={DEFECT_COLORS[v] || 'default'} />,
        },
        {
            key: 'batch_number',
            label: 'Batch #',
            render: (v: any) => <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--slate-600)' }}>{v || '-'}</span>,
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={() => { setSelectedRecord(row); setModalMode('view'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Material Defects"
                subtitle="Record defective, broken, or damaged materials — adjusts stock levels automatically"
                breadcrumbs={[
                    { label: 'Stores', href: '/stores/products' },
                    { label: 'Material Defects' },
                ]}
                actions={
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={handleExport}
                            disabled={records.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 500, color: 'var(--slate-700)', cursor: 'pointer', opacity: records.length === 0 ? 0.5 : 1 }}
                        >
                            <Download size={15} /> Export
                        </button>
                        <button
                            onClick={() => { setModalMode('create'); setSelectedRecord(null); setIsModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #dc2626, #ef4444)', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                        >
                            <Plus size={15} /> Log Defect
                        </button>
                    </div>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Records" value={records.length.toString()} icon={<Hash size={20} />} color="red" />
                <StatCard title="Total Units Written Off" value={totalUnits.toLocaleString()} icon={<Package size={20} />} color="red" />
                <StatCard title="Critical Defects" value={criticalDefects.toString()} icon={<AlertTriangle size={20} />} color="red" />
            </div>

            <DataTable
                columns={columns}
                data={records}
                loading={loading}
                searchPlaceholder="Search by product, reference, or defect type..."
                emptyMessage="No material defect records found. Click 'Log Defect' to add one."
            />

            <MaterialDefectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => { await saveRecord.mutateAsync(data); }}
                initialData={selectedRecord}
                mode={modalMode}
            />
        </div>
    );
}
