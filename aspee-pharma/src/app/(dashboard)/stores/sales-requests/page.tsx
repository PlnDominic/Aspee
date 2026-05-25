'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import SalesRequestModal from '@/components/SalesRequestModal';
import { Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/hooks';

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
};

export default function SalesRequestsPage() {
    const { data: currentUser } = useCurrentUser();

    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [readOnly, setReadOnly] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('requisitions')
                .select(`
                    id,
                    requisition_number,
                    salesperson_id,
                    route_id,
                    status,
                    notes,
                    created_at,
                    updated_at,
                    salesperson:system_users!requisitions_salesperson_id_fkey(id, name, email),
                    route:vans!route_id(id, van_id, route_area),
                    items:requisition_items(
                        id,
                        product_id,
                        quantity_requested,
                        quantity_approved,
                        quantity_issued,
                        notes,
                        product:products(id, name, sku, unit)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const normalized = (data || []).map((request: any) => {
                const salesperson = getSingleRelation<any>(request.salesperson);
                const route = getSingleRelation<any>(request.route);
                const items = (request.items || []).map((item: any) => ({
                    ...item,
                    product: getSingleRelation<any>(item.product) || item.product || null,
                }));

                return {
                    ...request,
                    salesperson,
                    route,
                    items,
                    salesperson_name: salesperson?.name || 'Unassigned',
                    route_name: route?.van_id || route?.route_area || '-',
                    item_count: items.length,
                    total_requested: items.reduce((sum: number, item: any) => sum + (Number(item.quantity_requested) || 0), 0),
                    total_approved: items.reduce((sum: number, item: any) => sum + (Number(item.quantity_approved) || 0), 0),
                    total_issued: items.reduce((sum: number, item: any) => sum + (Number(item.quantity_issued) || 0), 0),
                };
            });

            setRequests(normalized);
        } catch (error: any) {
            toast.error('Failed to fetch sales request: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchRequests();
    }, [fetchRequests]);

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete request ${row.requisition_number}?`)) return;

        try {
            const { error } = await supabase.from('requisitions').delete().eq('id', row.id);
            if (error) throw error;

            toast.success(`Request ${row.requisition_number} deleted`);
            void fetchRequests();
        } catch (error: any) {
            toast.error('Failed to delete request: ' + error.message);
        }
    };

    const columns = [
        {
            key: 'requisition_number',
            label: 'Request #',
            render: (value: string) => (
                <span style={{ fontWeight: 700, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>
                    {value}
                </span>
            ),
        },
        {
            key: 'salesperson_name',
            label: 'Salesperson',
            render: (value: string, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{value}</span>
                    <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{row.route?.route_area || 'No route assigned'}</span>
                </div>
            ),
        },
        {
            key: 'route_name',
            label: 'Route / Van',
        },
        {
            key: 'total_requested',
            label: 'Request Summary',
            render: (value: number, row: any) => {
                const summary = (row.items || []).map((item: any) => {
                    const qty = Number(item.quantity_requested || 0).toLocaleString();
                    const unit = item.product?.unit || 'units';
                    return `${qty} ${unit}`;
                }).join(', ');

                return (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>{summary || '0 units'}</span>
                        <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{row.item_count} item{row.item_count === 1 ? '' : 's'}</span>
                    </div>
                );
            },
        },
        {
            key: 'created_at',
            label: 'Requested On',
            render: (value: string) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '160px',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { setSelectedRequest(row); setReadOnly(true); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Request"
                    >
                        <Eye size={14} />
                    </button>
                    {(row.status === 'PENDING' || row.status === 'APPROVED') && (
                        <>
                            <button
                                onClick={() => { setSelectedRequest(row); setReadOnly(false); setIsModalOpen(true); }}
                                style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                                title="Edit Request"
                            >
                                <Edit2 size={14} />
                            </button>
                            {row.status === 'PENDING' && (
                                <button
                                    onClick={() => handleDelete(row)}
                                    style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                                    title="Delete Request"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Request"
                subtitle="Review and process finished-goods requests from the Sales department"
                breadcrumbs={[{ label: 'Stores', href: '/stores/stock' }, { label: 'Sales Request' }]}
                actions={
                    <button
                        onClick={() => { setSelectedRequest(null); setReadOnly(false); setIsModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: 'none', background: 'var(--primary-600)', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New Sales Request
                    </button>
                }
            />

            <DataTable
                columns={columns}
                data={requests}
                loading={loading}
                searchPlaceholder="Search requests, routes, or salespeople..."
                emptyMessage="No sales request submitted yet."
            />

            <SalesRequestModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedRequest(null); setReadOnly(false); }}
                onSuccess={fetchRequests}
                editingRequest={selectedRequest}
                readOnly={readOnly}
                currentUser={currentUser}
                isStoreSection={true}
            />
        </div>
    );
}
