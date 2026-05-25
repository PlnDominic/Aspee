'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import {
    ClipboardList,
    CheckCircle,
    Clock,
    Eye,
    AlertCircle,
    ShoppingBag,
    FileText,
    Edit2,
    Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PurchaseRequestViewModal from '@/components/PurchaseRequestViewModal';
import PrintablePurchaseRequisition from '@/components/PrintablePurchaseRequisition';
import PurchaseRequestModal from '@/components/PurchaseRequestModal';

export default function PurchasingRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('purchase_requests')
                .select('*, requester:system_users!requested_by(name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch requests: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleApprove = (id: string) => {
        toast.success(`Request ${id} approved`);
        fetchRequests();
    };

    const handleReject = (id: string) => {
        toast.warning(`Request ${id} rejected`);
        fetchRequests();
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete request ${row.request_number}?`)) return;

        try {
            const { error } = await supabase
                .from('purchase_requests')
                .delete()
                .eq('id', row.id);

            if (error) throw error;

            toast.success(`Request ${row.request_number} deleted`);
            fetchRequests();
        } catch (error: any) {
            toast.error('Failed to delete request: ' + error.message);
        }
    };

    const columns = [
        { 
            key: 'request_number', 
            label: 'Request #', 
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span> 
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
            key: 'requester',
            label: 'Requested By',
            render: (v: any) => v?.name || 'Unknown'
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
                const variant = v === 'Approved' ? 'success' : v === 'Pending' ? 'warning' : v === 'Rejected' ? 'danger' : 'default';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { setSelectedRequest(row); setIsPdfModalOpen(true); }}
                        title="View"
                        aria-label="View purchase requisition PDF"
                        style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedRequest(row); setIsViewModalOpen(true); }}
                        title="Review"
                        aria-label="Review purchase requisition"
                        style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: '1px solid var(--primary-200)', background: 'var(--primary-50)', color: 'var(--primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FileText size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedRequest(row); setIsEditModalOpen(true); }}
                        title="Edit"
                        aria-label="Edit purchase request"
                        style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: '1px solid var(--amber-200, #fde68a)', background: 'var(--amber-50, #fffbeb)', color: 'var(--amber-700, #b45309)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(row)}
                        title="Delete"
                        aria-label="Delete purchase request"
                        style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: '1px solid var(--danger-200, #fecaca)', background: 'var(--danger-50, #fef2f2)', color: 'var(--danger, #dc2626)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Trash2 size={14} />
                    </button>
                    {row.status === 'Approved' && (
                        <button
                            title="Create PO"
                            aria-label="Create purchase order"
                            style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: 'none', background: 'var(--primary-600)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => window.location.href = `/purchasing/purchase-orders?request=${row.id}`}
                        >
                            <ShoppingBag size={14} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    const stats = {
        totalPending: requests.filter(r => r.status === 'Pending').length,
        totalUrgent: requests.filter(r => r.priority === 'Urgent' && r.status === 'Pending').length,
        approvedRecent: requests.filter(r => r.status === 'Approved' && new Date(r.updated_at).toDateString() === new Date().toDateString()).length
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Purchase Requisitions"
                subtitle="Review and approve material requests from Stores"
                breadcrumbs={[{ label: 'Purchasing', href: '/purchasing/suppliers' }, { label: 'Requisitions' }]}
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Pending Review" value={stats.totalPending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Urgent Action" value={stats.totalUrgent} icon={<AlertCircle size={20} />} color="red" />
                <StatCard title="Approved Today" value={stats.approvedRecent} icon={<CheckCircle size={20} />} color="green" />
            </div>

            <DataTable 
                columns={columns} 
                data={requests} 
                loading={loading}
                searchPlaceholder="Search requisition number..." 
            />

            <PurchaseRequestViewModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                request={selectedRequest}
                isPurchasingView={true}
                onApprove={handleApprove}
                onReject={handleReject}
            />

            <PrintablePurchaseRequisition
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                request={selectedRequest}
            />

            <PurchaseRequestModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={fetchRequests}
                editingRequest={selectedRequest}
            />
        </div>
    );
}
