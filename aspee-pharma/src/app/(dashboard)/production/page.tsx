'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ProductionOrderModal from '@/components/ProductionOrderModal';
import MaterialRequestModal from '@/components/MaterialRequestModal';
import EntityLink from '@/components/EntityLink';
import { Plus, Factory, Package, AlertTriangle, CheckCircle, Eye, Pencil, Trash2, ClipboardList, CheckSquare, FlaskConical, Microscope, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useFetch, useAction } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import ProductionCompletionModal from '@/components/ProductionCompletionModal';
import SendToMDModal from '@/components/SendToMDModal';
import { useRouter } from 'next/navigation';

export default function ProductionPage() {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [materialRequestType, setMaterialRequestType] = useState<'Raw Material' | 'Packaging Material'>('Raw Material');
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: productionOrders = [], isLoading: loading } = useFetch<any[]>(
        ['production_orders', '*, product:products(name, sku, unit)'],
        async () => {
            const { data, error } = await supabase
                .from('production_orders')
                .select(`
                    *,
                    product:products(name, sku, unit)
                `)
                .order('created_at', { ascending: false });
            return { data: data || [], error };
        }
    );

    const saveOrder = useAction<any, void>({
        mutationFn: async (orderData: any) => {
            const { id, items, ...header } = orderData;

            if (id) {
                // Update existing order
                const { error } = await supabase
                    .from('production_orders')
                    .update(header)
                    .eq('id', id);

                if (error) throw error;

                // Update items
                await supabase.from('production_order_items').delete().eq('order_id', id);

                if (items && items.length > 0) {
                    const itemsToSave = items.map((item: any) => ({
                        ...item,
                        order_id: id
                    }));

                    const { error: itemsError } = await supabase
                        .from('production_order_items')
                        .insert(itemsToSave);

                    if (itemsError) throw itemsError;
                }
            } else {
                // Create new order
                const { data: headerData, error: headerError } = await supabase
                    .from('production_orders')
                    .insert([header])
                    .select()
                    .single();

                if (headerError) throw headerError;

                if (items && items.length > 0) {
                    const itemsToSave = items.map((item: any) => ({
                        ...item,
                        order_id: headerData.id
                    }));

                    const { error: itemsError } = await supabase
                        .from('production_order_items')
                        .insert(itemsToSave);

                    if (itemsError) throw itemsError;
                }
            }
        },
        invalidateKeys: ['production_orders'],
        successMessage: 'Job order saved successfully',
    });

    const handleSaveOrder = async (orderData: any) => {
        await saveOrder.mutateAsync(orderData);
    };

    const handleDeleteOrder = async (id: string) => {
        if (!confirm('Are you sure you want to delete this job order?')) return;

        try {
            // Delete items first
            await supabase.from('production_order_items').delete().eq('order_id', id);

            // Delete order
            const { error } = await supabase.from('production_orders').delete().eq('id', id);
            if (error) throw error;

            toast.success('Job order deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['production_orders'] });
        } catch (error: any) {
            toast.error('Error deleting job order: ' + error.message);
        }
    };

    const columns = [
        {
            key: 'order_number',
            label: 'Order Ref',
            render: (v: unknown) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span>
        },
        {
            key: 'product',
            label: 'Product',
            render: (v: any) => (
                <div>
                    <div style={{ fontSize: 12 }}>{v?.name ? <EntityLink href={`/stores/products?search=${encodeURIComponent(v.name)}`}>{v.name}</EntityLink> : '-'}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{v?.sku || '-'}</div>
                </div>
            )
        },
        {
            key: 'quantity',
            label: 'Qty',
            render: (v: unknown) => <span style={{ fontWeight: 600 }}>{(v as number)?.toLocaleString()}</span>
        },
        {
            key: 'bom_version',
            label: 'BOM Ver',
            render: (v: unknown) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v as string}</span>
        },
        {
            key: 'start_date',
            label: 'Start Date',
            render: (v: unknown) => v ? new Date(v as string).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
        },
        {
            key: 'due_date',
            label: 'Due Date',
            render: (v: unknown) => v ? new Date(v as string).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => {
                const variant = v === 'Completed' ? 'success' : v === 'In Progress' ? 'info' : v === 'Released' ? 'warning' : 'default';
                return <StatusBadge status={v as string} variant={variant} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => router.push(`/qa/in-process?search=${encodeURIComponent(row.order_number)}`)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--violet-600, #7c3aed)', cursor: 'pointer' }}
                        title="View In Process Control Records"
                    >
                        <FlaskConical size={14} />
                    </button>
                    <button
                        onClick={() => router.push(`/qa/finished-products?search=${encodeURIComponent(row.order_number)}`)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--teal-600, #0d9488)', cursor: 'pointer' }}
                        title="View Finished Products Analysis"
                    >
                        <Microscope size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedOrder(row); setMaterialRequestType('Raw Material'); setIsRequestModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--amber-600)', cursor: 'pointer' }}
                        title="Request Raw Materials"
                    >
                        <ClipboardList size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedOrder(row); setModalMode('view'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedOrder(row); setModalMode('edit'); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>
                    {row.status === 'In Progress' && (
                        <button
                            onClick={() => { setSelectedOrder(row); setIsCompletionModalOpen(true); }}
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--green-600)', cursor: 'pointer' }}
                            title="Complete Job Order & Transfer"
                        >
                            <CheckSquare size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => handleDeleteOrder(row.id)}
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
        active: productionOrders.filter(o => o.status === 'In Progress' || o.status === 'Released').length,
        finished: productionOrders.filter(o => o.status === 'Completed').length,
        alerts: 0,
        completedThisMonth: productionOrders.filter(o => {
            if (o.status !== 'Completed') return false;
            const completedDate = new Date(o.completed_at || o.updated_at);
            const now = new Date();
            return completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear();
        }).length
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Job Orders"
                subtitle="Create job orders, request materials, and complete production"
                breadcrumbs={[{ label: 'Production' }, { label: 'Job Orders' }]}
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
                            onClick={() => { setModalMode('create'); setSelectedOrder(null); setIsModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                        >
                            <Plus size={16} /> New Job Order
                        </button>
                    </div>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Active Orders" value={stats.active} icon={<Factory size={20} />} color="blue" />
                <StatCard title="In Progress" value={productionOrders.filter(o => o.status === 'In Progress').length} icon={<Package size={20} />} color="amber" />
                <StatCard title="Completed This Month" value={stats.completedThisMonth} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Draft Orders" value={productionOrders.filter(o => o.status === 'Draft').length} icon={<AlertTriangle size={20} />} color="amber" />
            </div>

            <DataTable
                columns={columns}
                data={productionOrders}
                loading={loading}
                searchPlaceholder="Search job orders..."
            />

            <ProductionOrderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveOrder}
                initialData={selectedOrder}
                mode={modalMode}
                onRequestMaterials={(order, requestType) => {
                    setIsModalOpen(false);
                    setSelectedOrder(order);
                    setMaterialRequestType(requestType);
                    setIsRequestModalOpen(true);
                }}
            />

            <MaterialRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                productionOrder={selectedOrder}
                requestType={materialRequestType}
            />

            <ProductionCompletionModal
                isOpen={isCompletionModalOpen}
                onClose={() => setIsCompletionModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['production_orders'] })}
                productionOrder={selectedOrder}
            />

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Production" 
            />
        </div>
    );
}
