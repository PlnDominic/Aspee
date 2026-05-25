'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function WeeklyReportsReviewPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('weekly_reports')
                .select('*')
                .order('report_week_start', { ascending: false })
                .order('department', { ascending: true });

            if (error) throw error;
            setReports(data || []);
        } catch (error: any) {
            toast.error('Failed to load weekly reports: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const reviewReport = async (id: string, action: 'mark-read' | 'approve') => {
        try {
            const response = await fetch('/api/weekly-report/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Failed to update report.');
            toast.success(action === 'approve' ? 'Report approved.' : 'Report marked as read.');
            fetchReports();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update report.');
        }
    };

    const columns = [
        { key: 'department', label: 'Department', render: (value: string) => <strong>{value}</strong> },
        {
            key: 'report_week_start',
            label: 'Week',
            render: (_: string, row: any) => (
                <span>
                    {new Date(row.report_week_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {new Date(row.report_week_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
            ),
        },
        { key: 'status', label: 'Status', render: (value: string) => <StatusBadge status={value} variant={value === 'Approved' ? 'success' : value === 'Submitted' ? 'info' : 'warning'} /> },
        { key: 'read_status', label: 'Read', render: (value: string) => <StatusBadge status={value || 'Unread'} variant={value === 'Read' ? 'success' : 'warning'} /> },
        {
            key: 'daily_entries',
            label: 'Days Updated',
            render: (value: any[]) => `${Array.isArray(value) ? value.filter((entry) => entry.work_done?.trim()).length : 0}/5`,
        },
        {
            key: 'submitted_at',
            label: 'Submitted',
            render: (value: string) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button title="Mark as read" aria-label="Mark report as read" onClick={() => reviewReport(row.id, 'mark-read')} className="review-action">
                        <Eye size={14} />
                    </button>
                    <button title="Approve" aria-label="Approve weekly report" onClick={() => reviewReport(row.id, 'approve')} className="review-action approve">
                        <CheckCircle size={14} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Weekly Report Review"
                subtitle="Review department submissions sent to the Managing Director"
                breadcrumbs={[{ label: 'Reports' }, { label: 'Weekly Report Review' }]}
                actions={
                    <button onClick={fetchReports} className="refresh-btn">
                        <RefreshCw size={15} /> Refresh
                    </button>
                }
            />

            <DataTable
                columns={columns}
                data={reports}
                loading={loading}
                searchPlaceholder="Search department or report status..."
            />

            <style>{`
                .refresh-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 14px;
                    border-radius: 8px;
                    border: 1px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-700);
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .review-action {
                    width: 32px;
                    height: 32px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    border: 1px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    cursor: pointer;
                }
                .review-action.approve {
                    border-color: var(--success-200, #bbf7d0);
                    background: var(--success-50, #f0fdf4);
                    color: var(--success, #16a34a);
                }
            `}</style>
        </div>
    );
}
