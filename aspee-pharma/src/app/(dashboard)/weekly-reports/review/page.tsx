'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Eye, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

// Same department roster CreateUser/UserModal offers — kept in sync manually
// since it only appears in these two places.
const DEPARTMENTS = [
    'Administration', 'Sales', 'Stores', 'Purchasing', 'Accounts',
    'Production', 'Quality Assurance', 'Human Resources', 'Internal Audit',
];

function currentWorkWeek(date = new Date()) {
    const current = new Date(date);
    const day = current.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(current);
    monday.setDate(current.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    return { monday, friday };
}

function toInputDate(date: Date) {
    return date.toISOString().split('T')[0];
}

type ComplianceStatus = 'On Time' | 'Late' | 'Draft' | 'Missing';

const COMPLIANCE_STYLES: Record<ComplianceStatus, { bg: string; color: string; icon: React.ReactNode }> = {
    'On Time': { bg: '#dcfce7', color: '#15803d', icon: <CheckCircle size={13} /> },
    'Late': { bg: '#fef3c7', color: '#92400e', icon: <Clock size={13} /> },
    'Draft': { bg: '#e0f2fe', color: '#0369a1', icon: <Clock size={13} /> },
    'Missing': { bg: '#fee2e2', color: '#dc2626', icon: <AlertTriangle size={13} /> },
};

export default function WeeklyReportsReviewPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const { monday, friday } = useMemo(() => currentWorkWeek(), []);
    const currentWeekStart = toInputDate(monday);

    // One row per department for the current week — Submitted (on/before
    // Friday 23:59) is On Time, submitted after that is Late, a saved-but-
    // unsent report is Draft, and nothing at all is Missing. This is the
    // accountability view: who actually needs chasing right now, not just
    // the raw report list below it.
    const compliance = useMemo(() => {
        const thisWeekReports = reports.filter((r) => r.report_week_start === currentWeekStart);
        return DEPARTMENTS.map((department) => {
            const report = thisWeekReports.find((r) => r.department === department);
            let status: ComplianceStatus = 'Missing';
            if (report?.status === 'Submitted' || report?.status === 'Approved') {
                const submittedAt = report.submitted_at ? new Date(report.submitted_at) : null;
                status = submittedAt && submittedAt.getTime() <= friday.getTime() ? 'On Time' : 'Late';
            } else if (report?.status === 'Draft') {
                status = 'Draft';
            }
            return { department, status, report };
        });
    }, [reports, currentWeekStart, friday]);

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

            <div className="compliance-board">
                <div className="compliance-head">
                    <span>Submission Compliance</span>
                    <span className="compliance-week">
                        Week of {monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {friday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                </div>
                <div className="compliance-grid">
                    {compliance.map(({ department, status, report }) => {
                        const style = COMPLIANCE_STYLES[status];
                        return (
                            <div className="compliance-card" key={department}>
                                <span className="compliance-dept">{department}</span>
                                <span className="compliance-pill" style={{ background: style.bg, color: style.color }}>
                                    {style.icon} {status}
                                </span>
                                {report?.submitted_at && (
                                    <span className="compliance-time">
                                        {new Date(report.submitted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <DataTable
                columns={columns}
                data={reports}
                loading={loading}
                searchPlaceholder="Search department or report status..."
            />

            <style>{`
                .compliance-board {
                    background: var(--card-bg);
                    border: 1px solid var(--slate-200);
                    border-radius: 12px;
                    padding: 18px;
                    margin-bottom: 20px;
                }
                .compliance-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 14px;
                }
                .compliance-head > span:first-child {
                    font-size: 13px;
                    font-weight: 800;
                    color: var(--slate-800);
                }
                .compliance-week {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-500);
                }
                .compliance-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 10px;
                }
                .compliance-card {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 12px;
                    border-radius: 10px;
                    border: 1px solid var(--slate-200);
                    background: var(--slate-50);
                }
                .compliance-dept {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-700);
                }
                .compliance-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    width: fit-content;
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 10px;
                    font-weight: 700;
                }
                .compliance-time {
                    font-size: 10px;
                    color: var(--slate-400);
                }

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
