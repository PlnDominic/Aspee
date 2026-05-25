'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import PurchaseOrderModal from '@/components/PurchaseOrderModal';
import EntityLink from '@/components/EntityLink';
import { Plus, ClipboardList, Clock, CheckCircle, AlertTriangle, FileText, Download, Eye, Edit2, Trash2, MoreHorizontal, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import { logAudit } from '@/lib/auditLog';
import { useSupabaseQuery, useAction } from '@/lib/hooks';
import SendToMDModal from '@/components/SendToMDModal';
import { Send } from 'lucide-react';

export default function PurchaseOrdersPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedPO, setSelectedPO] = useState<any>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const { data: purchaseOrders, isLoading: loading } = useSupabaseQuery<any>('purchase_orders', {
        columns: '*, suppliers(name)',
    });

    const saveMutation = useAction<any>({
        mutationFn: async (poData: any) => {
            const { items, id, ...poBase } = poData;

            if (id) {
                // UPDATE MODE
                // 1. Update PO header
                const { error: poError } = await supabase
                    .from('purchase_orders')
                    .update(poBase)
                    .eq('id', id);
                if (poError) throw poError;

                // 2. Refresh items (Delete old, insert new for simplicity, or sync)
                // Delete old items
                const { error: delError } = await supabase
                    .from('purchase_order_items')
                    .delete()
                    .eq('po_id', id);
                if (delError) throw delError;

                // Insert new items
                const poItems = items.map((item: any) => ({
                    po_id: id,
                    product_id: item.product_id,
                    quantity: Math.round(item.quantity),
                    unit_price: item.unit_price,
                    unit: item.unit || 'Pieces'
                }));
                const { error: itemsError } = await supabase
                    .from('purchase_order_items')
                    .insert(poItems);
                if (itemsError) throw itemsError;

                await logAudit({
                    action: 'UPDATE',
                    module: 'Purchase Orders',
                    description: `Updated Purchase Order: ${poBase.po_number || id}`,
                    record_id: id,
                    record_type: 'purchase_orders',
                    old_values: selectedPO,
                    new_values: { ...poBase, items: poItems },
                });
            } else {
                // CREATE MODE
                // 1. Create the Purchase Order
                const { data: po, error: poError } = await supabase
                    .from('purchase_orders')
                    .insert([poBase])
                    .select()
                    .single();

                if (poError) throw poError;

                // 2. Create the associated items
                const poItems = items.map((item: any) => ({
                    po_id: po.id,
                    product_id: item.product_id,
                    quantity: Math.round(item.quantity),
                    unit_price: item.unit_price,
                    unit: item.unit || 'Pieces'
                }));

                const { error: itemsError } = await supabase
                    .from('purchase_order_items')
                    .insert(poItems);

                if (itemsError) throw itemsError;

                await logAudit({
                    action: 'CREATE',
                    module: 'Purchase Orders',
                    description: `Created new Purchase Order: ${poBase.po_number || po.po_number}`,
                    record_id: po.id,
                    record_type: 'purchase_orders',
                    new_values: { ...poBase, items: poItems },
                });
            }
        },
        invalidateKeys: ['purchase_orders'],
        successMessage: 'Purchase Order saved successfully!',
    });

    const deleteMutation = useAction<string>({
        mutationFn: async (id: string) => {
            const poToDelete = (purchaseOrders ?? []).find((p: any) => p.id === id);
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'DELETE',
                module: 'Purchase Orders',
                description: `Deleted Purchase Order: ${poToDelete?.po_number || id}`,
                record_id: id,
                record_type: 'purchase_orders',
                old_values: poToDelete,
            });
        },
        invalidateKeys: ['purchase_orders'],
        successMessage: 'Purchase Order deleted successfully',
    });

    const approveMutation = useAction<{ poId: string; approvalLevel: string; notes?: string }>({
        mutationFn: async ({ poId, approvalLevel, notes }) => {
            // Get current user (simplified - in production would come from auth)
            const { data: { user } } = await supabase.auth.getUser();
            
            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status: 'Approved',
                    approved_by: user?.id || null,
                    approved_at: new Date().toISOString(),
                    approval_level: approvalLevel,
                    approval_notes: notes || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', poId);

            if (error) throw error;

            await logAudit({
                action: 'APPROVE',
                module: 'Purchase Orders',
                description: `Approved Purchase Order (${approvalLevel} level)`,
                record_id: poId,
                record_type: 'purchase_orders',
            });
        },
        invalidateKeys: ['purchase_orders'],
        successMessage: 'Purchase Order approved successfully!',
    });

    const statusVariant = (s: string) => {
        switch (s) {
            case 'Pending': return 'warning';
            case 'Approved': return 'info';
            case 'Shipped': return 'info';
            case 'Received': return 'success';
            case 'Cancelled': return 'danger';
            default: return 'default';
        }
    };

    const handleSavePO = async (poData: any) => {
        await saveMutation.mutateAsync(poData);
    };

    const handleDeletePO = async (id: string) => {
        if (!confirm('Are you sure you want to delete this purchase order?')) return;
        await deleteMutation.mutateAsync(id);
    };

    const openCreateFromRequest = useCallback(async (requestId: string) => {
        try {
            const { data, error } = await supabase
                .from('purchase_requests')
                .select(`
                    id,
                    request_number,
                    status,
                    items:purchase_request_items(
                        product_id,
                        quantity,
                        unit,
                        last_purchase_price,
                        product:products(
                            id,
                            name,
                            sku,
                            unit,
                            purchase_unit,
                            bulk_unit,
                            bulk_to_base_ratio,
                            material_type
                        )
                    )
                `)
                .eq('id', requestId)
                .single();

            if (error) throw error;

            const items = (data?.items || [])
                .filter((item: any) => item.product_id)
                .map((item: any) => ({
                    product_id: item.product_id,
                    quantity: Number(item.quantity) || 1,
                    unit_price: Number(item.last_purchase_price) || 0,
                    unit: item.unit || item.product?.purchase_unit || item.product?.unit || 'Pieces',
                    product: item.product,
                }));

            if (items.length === 0) {
                toast.warning('This purchase requisition has no items to copy into a PO.');
                return;
            }

            setModalMode('create');
            setSelectedPO({
                source_request_id: data.id,
                source_request_number: data.request_number,
                status: 'Pending',
                items,
            });
            setIsModalOpen(true);
        } catch (error: any) {
            toast.error('Failed to load requisition items: ' + error.message);
        }
    }, []);

    useEffect(() => {
        const requestId = new URLSearchParams(window.location.search).get('request');
        if (requestId) {
            openCreateFromRequest(requestId);
        }
    }, [openCreateFromRequest]);

    const openCreateModal = () => {
        setModalMode('create');
        setSelectedPO(null);
        setIsModalOpen(true);
    };

    const openViewModal = (po: any) => {
        setModalMode('view');
        setSelectedPO(po);
        setIsModalOpen(true);
    };

    const openEditModal = (po: any) => {
        setModalMode('edit');
        setSelectedPO(po);
        setIsModalOpen(true);
    };

    const handleExport = () => {
        const pos = purchaseOrders ?? [];
        if (pos.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = ['PO Number', 'Supplier', 'Date', 'Amount', 'Status'];
        const csvContent = [
            headers.join(','),
            ...pos.map((po: any) => [
                po.po_number,
                `"${po.suppliers?.name || 'N/A'}"`,
                new Date(po.created_at).toLocaleDateString(),
                `"${formatCurrency(po.total_amount || 0, po.currency)}"`,
                po.status
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Exported to CSV successfully');
    };

    const pos = purchaseOrders ?? [];
    const stats = {
        total: pos.length,
        pending: pos.filter((po: any) => po.status === 'Pending').length,
        received: pos.filter((po: any) => po.status === 'Received').length,
        totalValue: pos.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0)
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Purchase Orders"
                subtitle="Track and manage all purchase orders"
                breadcrumbs={[
                    { label: 'Purchasing', href: '/purchasing/suppliers' },
                    { label: 'Purchase Orders' },
                ]}
                actions={
                    <div style={{ display: 'flex', gap: 12 }}>
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
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 18px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', cursor: 'pointer',
                            }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={openCreateModal}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 18px', borderRadius: 8,
                                border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                            }}
                        >
                            <Plus size={16} /> Create PO
                        </button>
                    </div>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total POs" value={stats.total.toString()} icon={<ClipboardList size={20} />} color="blue" />
                <StatCard title="Pending Review" value={stats.pending.toString()} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Completed" value={stats.received.toString()} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Total Value" value={`GH₵ ${stats.totalValue.toLocaleString()}`} icon={<FileText size={20} />} color="purple" />
            </div>

            <DataTable
                columns={[
                    { key: 'po_number', label: 'PO Number', render: (v: unknown) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span> },
                    { key: 'suppliers', label: 'Supplier', render: (v: any) => v?.name ? <EntityLink href={`/purchasing/suppliers?search=${encodeURIComponent(v.name)}`}>{v.name}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>N/A</span> },
                    { key: 'created_at', label: 'Date', render: (v: unknown) => <span>{new Date(v as string).toLocaleDateString()}</span> },
                    { key: 'total_amount', label: 'Total Amount', render: (v: unknown, row: any) => <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{formatCurrency((v as number) || 0, row.currency)}</span> },
                    { key: 'status', label: 'Status', render: (v: unknown) => <StatusBadge status={v as string} variant={statusVariant(v as string)} /> },
                    { key: 'approval_level', label: 'Approved By', render: (v: unknown, row: any) => {
                        if (!row.approved_by) return <span style={{ color: 'var(--slate-400)' }}>—</span>;
                        return (
                            <div style={{ fontSize: '11px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--success)' }}>{row.approval_level || 'Approved'}</div>
                                {row.approved_at && <div style={{ color: 'var(--slate-500)' }}>{new Date(row.approved_at).toLocaleDateString()}</div>}
                            </div>
                        );
                    }},
                    {
                        key: 'actions',
                        label: 'Actions',
                        width: '160px',
                        render: (_, row) => (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {row.status === 'Pending' && (
                                    <button
                                        onClick={() => {
                                            const amount = row.total_amount || 0;
                                            const isHighValue = amount > 10000;
                                            const level = isHighValue ? 'Finance' : 'Manager';
                                            if (confirm(`Approve this PO for ${level} review?\n\nAmount: ${formatCurrency(amount, row.currency)}${isHighValue ? `\n\nNote: POs over ${formatCurrency(10000, row.currency)} require Finance approval` : ''}`)) {
                                                approveMutation.mutate({ poId: row.id, approvalLevel: level });
                                            }
                                        }}
                                        title="Approve PO"
                                        style={{
                                            border: 'none', background: 'var(--success-50)', color: 'var(--success)',
                                            width: '32px', height: '32px', borderRadius: '6px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                        }}
                                    >
                                        <Check size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => openViewModal(row)}
                                    title="View Details"
                                    style={{
                                        border: 'none', background: 'var(--slate-100)', color: 'var(--slate-600)',
                                        width: '32px', height: '32px', borderRadius: '6px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={() => openEditModal(row)}
                                    title="Edit PO"
                                    style={{
                                        border: 'none', background: 'var(--primary-50)', color: 'var(--primary-600)',
                                        width: '32px', height: '32px', borderRadius: '6px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeletePO(row.id as string)}
                                    title="Delete PO"
                                    style={{
                                        border: 'none', background: 'var(--danger-50)', color: 'var(--danger)',
                                        width: '32px', height: '32px', borderRadius: '6px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )
                    }
                ]}
                data={pos}
                loading={loading}
                searchPlaceholder="Search purchase orders..."
            />

            <PurchaseOrderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePO}
                mode={modalMode}
                initialData={selectedPO}
            />

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Purchasing" 
            />
        </div>
    );
}
