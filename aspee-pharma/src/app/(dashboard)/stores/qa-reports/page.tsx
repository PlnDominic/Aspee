'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import {
    Activity,
    Plus,
    Eye,
    AlertCircle,
    FileText,
    Clock,
    CheckCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import QAReportModal from '@/components/QAReportModal';
import QAReportViewModal from '@/components/QAReportViewModal';

export default function StoresQAReportsPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
            render: (v: string) => <span style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'var(--font-mono)' }}>{v}</span> 
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
                <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                        onClick={() => { setSelectedReport(row); setIsViewModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    {row.status === 'Pending' && (
                        <button 
                            onClick={() => { setSelectedReport(row); setIsCreateModalOpen(true); }}
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: '#0f766e', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                        >
                            Edit
                        </button>
                    )}
                </div>
            )
        }
    ];

    const stats = {
        pending: reports.filter(r => r.status === 'Pending').length,
        critical: reports.filter(r => r.type === 'Critical Report').length,
        actionTaken: reports.filter(r => r.status === 'Action Taken' || r.status === 'Closed').length
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="QA Internal Reports"
                subtitle="Submit critical issue reports and material requisitions to QA"
                breadcrumbs={[{ label: 'Stores', href: '/stores/stock' }, { label: 'QA Reports' }]}
                actions={
                    <button 
                        onClick={() => { setSelectedReport(null); setIsCreateModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #0f766e, #14b8a6)', color: white, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New Report/Requisition
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Pending Review" value={stats.pending} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Critical Reports" value={stats.critical} icon={<AlertCircle size={20} />} color="red" />
                <StatCard title="Resolved" value={stats.actionTaken} icon={<CheckCircle size={20} />} color="green" />
            </div>

            <DataTable 
                columns={columns} 
                data={reports} 
                loading={loading}
                searchPlaceholder="Search report number..." 
            />

            <QAReportModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchReports}
                editingReport={selectedReport}
            />

            <QAReportViewModal 
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                report={selectedReport}
                showActions={false}
            />
        </div>
    );
}

const white = 'white';
