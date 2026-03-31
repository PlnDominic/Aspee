'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import GRNModal from '@/components/GRNModal';
import EntityLink from '@/components/EntityLink';
import { Plus, FileCheck, Eye, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useFetch, useAction, useDelete } from '@/lib/hooks';
import { notifyGRNQAResult, notifyGRNPendingQA } from '@/lib/notifications';
import { autoPostJournal } from '@/lib/autoPostJournal';

export default function GRNPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGRN, setSelectedGRN] = useState<any>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

    const { data: grnList, isLoading: loading, refetch: refetchGRNs } = useFetch<any[]>(
        ['grn', '*, purchase_orders:po_id(po_number, suppliers:supplier_id(name))'],
        async () => {
            const result = await supabase
                .from('grn')
                .select(`
                    *,
                    purchase_orders:po_id(po_number, suppliers:supplier_id(name))
                `)
                .order('created_at', { ascending: false });
            return { data: result.data, error: result.error };
        },
    );

    const grnData = grnList ?? [];

    const saveMutation = useAction<any>({
        mutationFn: async (saveData: any) => {
            const { items, id, ...grnBase } = saveData;

            // Look up the Main Store location UUID
            const { data: locationData } = await supabase
                .from('stock_locations')
                .select('id')
                .ilike('name', '%main%store%')
                .single();

            const mainStoreId = locationData?.id;
            if (!mainStoreId) throw new Error('Main Store location not found in stock_locations');

            let grn;
            if (id) {
                // UPDATE MODE
                const { data, error: grnError } = await supabase
                    .from('grn')
                    .update(grnBase)
                    .eq('id', id)
                    .select()
                    .single();

                if (grnError) throw grnError;
                grn = data;

                // Refresh items (Delete old, insert new)
                const { error: delError } = await supabase
                    .from('grn_items')
                    .delete()
                    .eq('grn_id', id);
                if (delError) throw delError;
            } else {
                // CREATE MODE
                const { data, error: grnError } = await supabase
                    .from('grn')
                    .upsert([grnBase], { onConflict: 'grn_number' })
                    .select()
                    .single();

                if (grnError) throw grnError;
                grn = data;
            }

            // 2. Create/Re-insert GRN items
            const grnItems = items.map((item: any) => ({
                grn_id: grn.id,
                product_id: item.product_id,
                quantity_received: item.quantity_received,
                batch_no: item.batch_no,
                expiry_date: item.expiry_date,
                po_item_id: item.po_item_id
            }));

            const { error: itemsError } = await supabase
                .from('grn_items')
                .insert(grnItems);

            if (itemsError) throw itemsError;

            // Notice: Stock levels are updated here ONLY if qa_status is 'Approved'.
            for (const item of items) {
                if (item.qa_status === 'Approved') {
                    // Get current stock level for this SPECIFIC BATCH
                    const batchNo = item.batch_no || 'N/A';
                    
                    const { data: stockData } = await supabase
                        .from('stock_levels')
                        .select('qty_on_hand')
                        .eq('product_id', item.product_id)
                        .eq('location_id', mainStoreId)
                        .eq('batch_number', batchNo)
                        .maybeSingle();

                    const currentQty = stockData?.qty_on_hand || 0;
                    const newQty = currentQty + item.quantity_received;

                    // Update or insert stock level (Batch aware)
                    const { error: stockError } = await supabase
                        .from('stock_levels')
                        .upsert({
                            product_id: item.product_id,
                            location_id: mainStoreId,
                            batch_number: batchNo,
                            expiry_date: item.expiry_date || null,
                            qty_on_hand: newQty,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'product_id,location_id,batch_number' });

                    if (stockError) throw stockError;

                    // Record stock movement
                    await supabase
                        .from('stock_movements')
                        .insert([{
                            product_id: item.product_id,
                            movement_type: 'IN',
                            quantity: item.quantity_received,
                            reference_type: 'GRN',
                            reference_id: grn.id,
                            batch_number: batchNo,
                            expiry_date: item.expiry_date || null,
                            notes: `GRN QA Approved: ${grn.grn_number}${id ? ' (Updated)' : ''}`
                        }]);
                }
            }

            // 5. Update PO status
            if (saveData.po_id) {
                const { data: poItems } = await supabase
                    .from('purchase_order_items')
                    .select('quantity')
                    .eq('po_id', saveData.po_id);

                const totalOrdered = poItems?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;

                // Fetch ALL received items for this PO across all GRNs
                const { data: allGrnItems } = await supabase
                    .from('grn_items')
                    .select('quantity_received')
                    .in('grn_id', (
                        await supabase
                            .from('grn')
                            .select('id')
                            .eq('po_id', saveData.po_id)
                    ).data?.map(g => g.id) || []);

                const totalReceived = allGrnItems?.reduce((sum: number, i: any) => sum + i.quantity_received, 0) || 0;

                let newStatus = 'Pending';
                if (totalReceived >= totalOrdered) {
                    newStatus = 'Received';
                } else if (totalReceived > 0) {
                    newStatus = 'Partial';
                }

                await supabase
                    .from('purchase_orders')
                    .update({ status: newStatus })
                    .eq('id', saveData.po_id);
            }

            // Auto-post GL entry when QA approves goods: DR Inventory / CR Accounts Payable
            if (grnBase.qa_status === 'Approved' && saveData.po_id) {
                const { data: poForGL } = await supabase
                    .from('purchase_orders')
                    .select('po_number, total_amount, suppliers:supplier_id(name)')
                    .eq('id', saveData.po_id)
                    .single();

                if (poForGL && Number(poForGL.total_amount) > 0) {
                    const supplierName = (poForGL as any).suppliers?.name || 'Supplier';
                    await autoPostJournal({
                        event: 'GRN_APPROVED',
                        amount: Number(poForGL.total_amount),
                        date: grnBase.received_date || new Date().toISOString().split('T')[0],
                        description: `Goods received from ${supplierName} — GRN ${grnBase.grn_number}`,
                        refNumber: grnBase.grn_number,
                    });
                }
            }

            // Notify on QA rejection/quarantine
            if (grnBase.qa_status === 'Rejected' || grnBase.qa_status === 'Quarantine') {
                notifyGRNQAResult(grnBase.grn_number, grnBase.qa_status, grnBase.qa_remarks);
            }

            // Notify QA when a new GRN is pending inspection
            if (!id && grnBase.qa_status === 'Pending') {
                const { data: poData } = await supabase
                    .from('purchase_orders')
                    .select('suppliers:supplier_id(name)')
                    .eq('id', saveData.po_id)
                    .single();
                const supplierName = (poData as any)?.suppliers?.name || 'Unknown Supplier';
                notifyGRNPendingQA(grnBase.grn_number, supplierName);
            }
        },
        invalidateKeys: ['grn', 'purchase_orders'],
        successMessage: 'GRN saved successfully!',
    });

    // Delete mutation for GRN
    const deleteMutation = useDelete('grn', {
        invalidateKeys: ['grn', 'purchase_orders'],
        onSuccess: () => {
            refetchGRNs();
        },
    });

    const handleDeleteGRN = async (id: string) => {
        if (confirm('Are you sure you want to delete this GRN? This action cannot be undone.')) {
            try {
                // First delete associated GRN items
                const { error: itemsError } = await supabase
                    .from('grn_items')
                    .delete()
                    .eq('grn_id', id);
                
                if (itemsError) throw itemsError;
                
                // Then delete the GRN itself
                await deleteMutation.mutateAsync(id);
            } catch (error: any) {
                toast.error('Failed to delete GRN: ' + error.message);
            }
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
            key: 'received_date',
            label: 'Received Date',
            render: (v: unknown) => v ? new Date(v as string).toLocaleDateString('en-GB') : '-'
        },
        {
            key: 'items_count',
            label: 'Items',
            render: (_: unknown, row: any) => {
                // Will be populated after fetching items count
                return <span className="text-muted">View Details</span>;
            }
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
            key: 'goods_condition',
            label: 'Condition',
            render: (v: unknown, row: any) => {
                const condition = row.goods_condition || 'Good';
                const variant = condition === 'Good' ? 'success' : 'danger';
                return <StatusBadge status={condition} variant={variant} />;
            }
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown, row: any) => (
                <StatusBadge status={row.status || 'Pending'} variant={row.status === 'Confirmed' ? 'success' : 'warning'} />
            )
        },
        {
            key: 'actions',
            label: '',
            render: (_: unknown, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => handleViewGRN(row)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--slate-100)',
                            color: 'var(--slate-600)',
                            cursor: 'pointer'
                        }}
                        title="View GRN"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleEditGRN(row)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--blue-50)',
                            color: 'var(--blue-600)',
                            cursor: 'pointer'
                        }}
                        title="Edit GRN"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => handleDeleteGRN(row.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--danger-light)',
                            color: 'var(--danger)',
                            cursor: 'pointer'
                        }}
                        title="Delete GRN"
                    >
                        <Trash2 size={16} />
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
                    <button
                        onClick={handleCreateGRN}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> Create GRN
                    </button>
                }
            />
            <DataTable columns={columns} data={grnData} searchPlaceholder="Search GRNs..." loading={loading} />

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
