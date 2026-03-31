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
    ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PurchaseRequestViewModal from '@/components/PurchaseRequestViewModal';

export default function PurchasingRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

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
                        onClick={() => { setSelectedRequest(row); setIsViewModalOpen(true); }}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        <Eye size={14} /> Review
                    </button>
                    {row.status === 'Approved' && (
                        <button 
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--primary-600)', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => window.location.href = `/purchasing/purchase-orders?request=${row.id}`}
                        >
                            <ShoppingBag size={12} /> Create PO
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
        </div>
    );
}
