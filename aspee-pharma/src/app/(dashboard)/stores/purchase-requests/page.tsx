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
    Plus,
    Eye,
    AlertCircle,
    XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PurchaseRequestModal from '@/components/PurchaseRequestModal';
import PurchaseRequestViewModal from '@/components/PurchaseRequestViewModal';

export default function StoresPurchaseRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
            label: 'Requester',
            render: (v: any) => v?.name || 'Unknown'
        },
        { 
            key: 'created_at', 
            label: 'Date Requested', 
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
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    {row.status === 'Pending' && (
                        <button 
                            onClick={() => { setSelectedRequest(row); setIsCreateModalOpen(true); }}
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                            title="Edit Request"
                        >
                            Edit
                        </button>
                    )}
                </div>
            )
        }
    ];

    const stats = {
        pending: requests.filter(r => r.status === 'Pending').length,
        approvedTotal: requests.filter(r => r.status === 'Approved').length,
        urgent: requests.filter(r => r.priority === 'Urgent' && r.status === 'Pending').length
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Purchase Requests"
                subtitle="Request materials and components from the Purchasing Unit"
                breadcrumbs={[{ label: 'Stores', href: '/stores/stock' }, { label: 'Purchase Requests' }]}
                actions={
                    <button 
                        onClick={() => { setSelectedRequest(null); setIsCreateModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary-600)', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New Purchase Request
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Pending" value={stats.pending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Urgent" value={stats.urgent} icon={<AlertCircle size={20} />} color="red" />
                <StatCard title="Approved" value={stats.approvedTotal} icon={<CheckCircle size={20} />} color="green" />
            </div>

            <DataTable 
                columns={columns} 
                data={requests} 
                loading={loading}
                searchPlaceholder="Search request number..." 
            />

            <PurchaseRequestModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchRequests}
                editingRequest={selectedRequest}
            />

            <PurchaseRequestViewModal 
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                request={selectedRequest}
            />
        </div>
    );
}
