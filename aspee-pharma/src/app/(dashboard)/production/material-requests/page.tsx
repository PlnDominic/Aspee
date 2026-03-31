'use client';

import React, { useState, useCallback, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import MaterialRequestModal from '@/components/MaterialRequestModal';
import MaterialRequestViewModal from '@/components/MaterialRequestViewModal';
import EntityLink from '@/components/EntityLink';
import {
    ClipboardList,
    CheckCircle,
    Clock,
    AlertTriangle,
    Eye,
    Plus,
    ShieldCheck,
    XCircle,
    Trash2,
    Pencil
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ProductionMaterialRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [editingRequest, setEditingRequest] = useState<any>(null);
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

    const handleDeleteRequest = async (row: any) => {
        if (!confirm(`Are you sure you want to permanently DELETE request ${row.request_number}? This action cannot be undone.`)) return;
        try {
            // Delete items first (if no cascade)
            const { error: itemsError } = await supabase
                .from('material_request_items')
                .delete()
                .eq('request_id', row.id);
            
            if (itemsError) throw itemsError;

            const { error } = await supabase
                .from('material_requests')
                .delete()
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Request ${row.request_number} deleted`);
            fetchRequests();
        } catch (error: any) {
            toast.error('Failed to delete request: ' + error.message);
        }
    };

    // Send a request to QA for material inspection
    const handleSendToQA = async (row: any) => {
        try {
            const { error } = await supabase
                .from('material_requests')
                .update({ qa_status: 'Pending QA' })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Request ${row.request_number} sent to QA for inspection`);
            fetchRequests();
        } catch (error: any) {
            toast.error('Failed to send to QA: ' + error.message);
        }
    };

    const qaStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' | 'info' => {
        switch (status) {
            case 'QA Approved': return 'success';
            case 'QA Rejected': return 'danger';
            case 'Pending QA': return 'warning';
            default: return 'default';
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
            key: 'status',
            label: 'Store Status',
            render: (v: string) => {
                const variant = v === 'Issued' ? 'success' : v === 'Pending' ? 'warning' : 'default';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        {
            key: 'qa_status',
            label: 'QA Status',
            render: (v: string) => {
                if (!v || v === 'Not Required') return <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>—</span>;
                return <StatusBadge status={v} variant={qaStatusVariant(v)} />;
            }
        },
        {
            key: 'created_at',
            label: 'Date',
            render: (v: string) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={() => { setSelectedRequest(row); setIsViewModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>

                    {row.status !== 'Issued' && (
                        <>
                            <button
                                onClick={() => { setEditingRequest(row); setIsModalOpen(true); }}
                                style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                                title="Edit Request"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                onClick={() => handleDeleteRequest(row)}
                                style={{ padding: 6, borderRadius: 6, border: '1px solid var(--danger)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                                title="Delete Request"
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}

                    {/* Send to QA — only available when Issued and not yet in QA pipeline */}
                    {row.status === 'Issued' && (!row.qa_status || row.qa_status === 'Not Required') && (
                        <button
                            onClick={() => handleSendToQA(row)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--primary-200)', background: 'var(--primary-50)', color: 'var(--primary-700)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            title="Send to QA for inspection"
                        >
                            <ShieldCheck size={12} /> Send to QA
                        </button>
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
        issued: requests.filter(r => r.status === 'Issued').length,
        pendingQA: requests.filter(r => r.qa_status === 'Pending QA').length,
        qaApproved: requests.filter(r => r.qa_status === 'QA Approved').length,
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Material Requests"
                subtitle="Track material requisitions and QA inspection status"
                breadcrumbs={[{ label: 'Production', href: '/production' }, { label: 'Material Requests' }]}
                actions={
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 16px', borderRadius: 8,
                            border: 'none', background: 'var(--primary-600)',
                            color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} />
                        New Request
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Awaiting Stores" value={stats.pending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Issued by Stores" value={stats.issued} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Pending QA Check" value={stats.pendingQA} icon={<ShieldCheck size={20} />} color="blue" />
                <StatCard title="QA Approved" value={stats.qaApproved} icon={<AlertTriangle size={20} />} color="green" />
            </div>

            <DataTable
                columns={columns}
                data={requests}
                loading={loading}
                searchPlaceholder="Search material requests..."
            />

            <MaterialRequestModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRequest(null); }}
                onSuccess={fetchRequests}
                editingRequest={editingRequest}
            />

            <MaterialRequestViewModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                request={selectedRequest}
            />
        </div>
    );
}
