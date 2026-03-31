'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import {
    Activity,
    Eye,
    AlertCircle,
    FileText,
    Clock,
    CheckCircle,
    ClipboardList
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import QAReportViewModal from '@/components/QAReportViewModal';

export default function QAInternalReportsPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('qa_internal_reports')
                .select('*, requester:system_users!requested_by(name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReports(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch reports: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const columns = [
        { 
            key: 'report_number', 
            label: 'Report #', 
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span> 
        },
        { 
            key: 'type', 
            label: 'Type',
            render: (v: string) => {
                const variant = v === 'Critical Report' ? 'danger' : 'info';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        { key: 'category', label: 'Category' },
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
            label: 'From', 
            render: (v: any) => v?.name || 'Unknown'
        },
        { 
            key: 'created_at', 
            label: 'Date', 
            render: (v: string) => new Date(v).toLocaleDateString()
        },
        {
            key: 'status', 
            label: 'Status', 
            render: (v: string) => {
                const variant = v === 'Action Taken' || v === 'Closed' ? 'success' : v === 'In-Review' ? 'warning' : 'default';
                return <StatusBadge status={v} variant={variant} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <button 
                    onClick={() => { setSelectedReport(row); setIsViewModalOpen(true); }}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                    <Eye size={14} /> Review
                </button>
            )
        }
    ];

    const stats = {
        pending: reports.filter(r => r.status === 'Pending').length,
        urgent: reports.filter(r => r.priority === 'Urgent' && r.status === 'Pending').length,
        inReview: reports.filter(r => r.status === 'In-Review').length
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Internal QA Review"
                subtitle="Review and process critical reports and requisitions from the Stores"
                breadcrumbs={[{ label: 'Quality Assurance', href: '/qa' }, { label: 'Internal Reports' }]}
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="New Pending" value={stats.pending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Urgent Needs" value={stats.urgent} icon={<AlertCircle size={20} />} color="red" />
                <StatCard title="In Review" value={stats.inReview} icon={<Activity size={20} />} color="blue" />
            </div>

            <DataTable 
                columns={columns} 
                data={reports} 
                loading={loading}
                searchPlaceholder="Search report number..." 
            />

            <QAReportViewModal 
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                report={selectedReport}
                onSuccess={fetchReports}
            />
        </div>
    );
}
