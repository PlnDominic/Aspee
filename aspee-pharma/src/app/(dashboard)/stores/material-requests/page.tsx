'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import EntityLink from '@/components/EntityLink';
import {
    ClipboardList,
    CheckCircle,
    Clock,
    AlertTriangle,
    Eye,
    Truck,
    ArrowRight,
    Search,
    XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import MaterialRequestViewModal from '@/components/MaterialRequestViewModal';

export default function MaterialRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('material_requests')
                .select(`
                    *,
                    production_order:production_orders(
                        order_number,
                        product:products(name)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch material requests: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleIssueMaterials = async (request: any) => {
        if (!confirm(`Are you sure you want to issue materials for request ${request.request_number}? This will apply FEFO (First Expired, First Out) logic.`)) return;

        try {
            // 1. Fetch Request Items
            const { data: requestItems, error: itemsError } = await supabase
                .from('material_request_items')
                .select('*, product:products(name)')
                .eq('request_id', request.id);

            if (itemsError) throw itemsError;
            if (!requestItems || requestItems.length === 0) {
                toast.error('No items found in this request.');
                return;
            }

            // Assume Main Store location ID is 1 for now
            const mainStoreId = '1';

            // 2. Pre-flight Check: Validate Total Stock Availability
            for (const item of requestItems) {
                const { data: stockBatches } = await supabase
                    .from('stock_levels')
                    .select('qty_on_hand')
                    .eq('product_id', item.product_id)
                    .eq('location_id', mainStoreId);
                
                const totalAvailable = stockBatches?.reduce((sum, batch) => sum + batch.qty_on_hand, 0) || 0;
                
                if (totalAvailable < item.quantity_requested) {
                    toast.error(`Insufficient stock for ${item.product?.name || 'Product'}. Available: ${totalAvailable}, Requested: ${item.quantity_requested}`);
                    return; 
                }
            }

            // 3. Process Issuance (FEFO)
            for (const item of requestItems) {
                let qtyRemainingToIssue = item.quantity_requested;

                // Fetch batches sorted by expiry (FEFO) - Earliest expiry first
                const { data: batches } = await supabase
                    .from('stock_levels')
                    .select('*')
                    .eq('product_id', item.product_id)
                    .eq('location_id', mainStoreId)
                    .gt('qty_on_hand', 0)
                    .order('expiry_date', { ascending: true, nullsFirst: false }) 
                    .order('created_at', { ascending: true });

                if (!batches) continue;

                for (const batch of batches) {
                    if (qtyRemainingToIssue <= 0) break;

                    const qtyToTake = Math.min(batch.qty_on_hand, qtyRemainingToIssue);
                    
                    // Update batch quantity
                    const { error: batchError } = await supabase
                        .from('stock_levels')
                        .update({ 
                            qty_on_hand: batch.qty_on_hand - qtyToTake,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', batch.id);

                    if (batchError) throw batchError;

                    // Record movement
                    await supabase
                        .from('stock_movements')
                        .insert([{
                            product_id: item.product_id,
                            movement_type: 'OUT',
                            quantity: qtyToTake,
                            reference_type: 'Material Request',
                            reference_id: request.id,
                            batch_number: batch.batch_number,
                            expiry_date: batch.expiry_date,
                            notes: `Issued to Production (Req: ${request.request_number})`
                        }]);

                    qtyRemainingToIssue -= qtyToTake;
                }
                
                // Update item issued quantity
                await supabase
                    .from('material_request_items')
                    .update({ quantity_issued: item.quantity_requested })
                    .eq('id', item.id);
            }

            // 4. Update Request Status
            const { error: updateError } = await supabase
                .from('material_requests')
                .update({ status: 'Issued' })
                .eq('id', request.id);
            
            if (updateError) throw updateError;

            toast.success('Materials issued successfully. Stock updated via FEFO.');
            fetchRequests();
        } catch (error: any) {
            toast.error('Error issuing materials: ' + error.message);
        }
    };

    const handleRejectRequest = async (row: any) => {
        if (!confirm(`Are you sure you want to reject request ${row.request_number}?`)) return;
        try {
            const { error } = await supabase
                .from('material_requests')
                .update({ status: 'Rejected' })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Request ${row.request_number} rejected`);
            fetchRequests();
        } catch (error: any) {
            toast.error('Failed to reject request: ' + error.message);
        }
    };

    const columns = [
        { 
            key: 'request_number', 
            label: 'Request #', 
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span> 
        },
        {
            key: 'production_order',
            label: 'Production Order',
            render: (v: any) => (
                <div>
                    <div>{v?.order_number ? <EntityLink href={`/production?search=${encodeURIComponent(v.order_number)}`}>{v.order_number}</EntityLink> : '-'}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-500)' }}>{v?.product?.name ? <EntityLink href={`/stores/products?search=${encodeURIComponent(v.product.name)}`} subtle>{v.product.name}</EntityLink> : '-'}</div>
                </div>
            )
        },
        { 
            key: 'priority', 
            label: 'Priority', 
            render: (v: string) => {
                const variant = v === 'Urgent' ? 'danger' : v === 'High' ? 'warning' : 'default';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        { 
            key: 'created_at', 
            label: 'Requested On', 
            render: (v: string) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        },
        {
            key: 'status', 
            label: 'Status', 
            render: (v: string) => {
                const variant = v === 'Issued' ? 'success' : v === 'Pending' ? 'warning' : 'default';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                        onClick={() => { setSelectedRequest(row); setIsViewModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    {row.status === 'Pending' && (
                        <>
                            <button 
                                onClick={() => handleIssueMaterials(row)}
                                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--primary-600)', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                <Truck size={12} /> Issue
                            </button>
                            <button 
                                onClick={() => handleRejectRequest(row)}
                                style={{ padding: 6, borderRadius: 6, border: '1px solid var(--danger)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                                title="Reject Request"
                            >
                                <XCircle size={14} />
                            </button>
                        </>
                    )}
                    {row.status === 'Issued' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 10, fontWeight: 600 }}>
                            <CheckCircle size={12} /> Issued
                        </div>
                    )}
                </div>
            )
        }
    ];

    const stats = {
        pending: requests.filter(r => r.status === 'Pending').length,
        issuedToday: requests.filter(r => r.status === 'Issued' && new Date(r.updated_at).toDateString() === new Date().toDateString()).length,
        urgent: requests.filter(r => r.priority === 'Urgent' && r.status === 'Pending').length
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Material Requests"
                subtitle="Manage raw material requisitions from Production"
                breadcrumbs={[{ label: 'Stores', href: '/stores/products' }, { label: 'Material Requests' }]}
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Pending Requests" value={stats.pending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Urgent Requests" value={stats.urgent} icon={<AlertTriangle size={20} />} color="red" />
                <StatCard title="Issued Today" value={stats.issuedToday} icon={<CheckCircle size={20} />} color="green" />
            </div>

            <DataTable 
                columns={columns} 
                data={requests} 
                loading={loading}
                searchPlaceholder="Search material requests..." 
            />

            <MaterialRequestViewModal 
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                request={selectedRequest}
                onIssue={handleIssueMaterials}
                onReject={handleRejectRequest}
            />
        </div>
    );
}
