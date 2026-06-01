'use client';

import React, { ReactNode, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { Activity, User, Database, ClipboardList, GitCompareArrows, Download, Filter, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportToCsv } from '@/lib/csvExport';
import { useFetch } from '@/lib/hooks';

function formatDate(value: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function parseAuditValue(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function formatAuditValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function getChangedFields(row: Record<string, unknown>): { field: string; oldValue: unknown; newValue: unknown }[] {
    const oldValues = parseAuditValue(row.old_values);
    const newValues = parseAuditValue(row.new_values);

    if (!oldValues && !newValues) return [];

    if (row.action === 'UPDATE' && newValues) {
        return Object.entries(newValues)
            .slice(0, 5)
            .map(([field, value]) => {
                if (value && typeof value === 'object' && ('old' in value || 'new' in value)) {
                    const change = value as { old?: unknown; new?: unknown };
                    return { field, oldValue: change.old, newValue: change.new };
                }

                return { field, oldValue: oldValues?.[field], newValue: value };
            });
    }

    const snapshot = row.action === 'DELETE' ? oldValues : newValues;
    return Object.entries(snapshot || {})
        .filter(([field]) => ['name', 'title', 'request_number', 'invoice_number', 'po_number', 'grn_number', 'status', 'total_amount'].includes(field))
        .slice(0, 5)
        .map(([field, value]) => ({ field, oldValue: row.action === 'DELETE' ? value : null, newValue: row.action === 'DELETE' ? null : value }));
}

const actionColors: Record<string, { bg: string; color: string }> = {
    'CREATE': { bg: '#d1fae5', color: '#047857' },
    'UPDATE': { bg: '#cffafe', color: '#0e7490' },
    'DELETE': { bg: '#fee2e2', color: '#b91c1c' },
    'VIEW': { bg: '#f1f5f9', color: '#475569' },
    'EXPORT': { bg: '#ede9fe', color: '#6d28d9' },
    'LOGIN': { bg: '#dcfce7', color: '#15803d' },
    'LOGOUT': { bg: '#fef3c7', color: '#d97706' },
    'PRINT': { bg: '#e0e7ff', color: '#4338ca' },
    'STATUS_CHANGE': { bg: '#fce7f3', color: '#be185d' },
    'APPROVE': { bg: '#dcfce7', color: '#15803d' },
};

const ALL_FILTER = 'All';

export default function AuditLogPage() {
    const queryClient = useQueryClient();
    const [moduleFilter, setModuleFilter] = useState(ALL_FILTER);
    const [actionFilter, setActionFilter] = useState(ALL_FILTER);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const { data, isLoading: loading } = useFetch<any[]>(
        ['audit_log'],
        async () => {
            const result = await supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(2000);
            return { data: result.data, error: result.error };
        }
    );
    const logs = data ?? [];

    const modules = useMemo(
        () => Array.from(new Set(logs.map((log) => log.module).filter(Boolean))).sort(),
        [logs]
    );
    const actions = useMemo(
        () => Array.from(new Set(logs.map((log) => log.action).filter(Boolean))).sort(),
        [logs]
    );
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const createdAt = log.created_at ? new Date(log.created_at) : null;
            const afterStart = !fromDate || (createdAt && createdAt >= new Date(`${fromDate}T00:00:00`));
            const beforeEnd = !toDate || (createdAt && createdAt <= new Date(`${toDate}T23:59:59`));

            return (
                (moduleFilter === ALL_FILTER || log.module === moduleFilter) &&
                (actionFilter === ALL_FILTER || log.action === actionFilter) &&
                afterStart &&
                beforeEnd
            );
        });
    }, [logs, moduleFilter, actionFilter, fromDate, toDate]);

    const totalLogs = filteredLogs.length;
    const todayLogs = filteredLogs.filter(
        (l) => new Date(l.created_at).toDateString() === new Date().toDateString()
    ).length;
    const uniqueUsers = new Set(filteredLogs.map((l) => l.user_email).filter(Boolean)).size;
    const deletes = filteredLogs.filter((l) => l.action === 'DELETE').length;
    const updates = filteredLogs.filter((l) => l.action === 'UPDATE').length;
    const coveredModules = new Set(logs.map((l) => l.module).filter(Boolean)).size;
    const latestEvent = logs[0]?.created_at ? formatDate(logs[0].created_at) : '-';

    const handleExport = () => {
        exportToCsv(
            `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`,
            filteredLogs,
            [
                { header: 'Timestamp', accessor: (row) => row.created_at },
                { header: 'User', accessor: (row) => row.user_name },
                { header: 'Email', accessor: (row) => row.user_email },
                { header: 'Action', accessor: (row) => row.action },
                { header: 'Module', accessor: (row) => row.module },
                { header: 'Record Type', accessor: (row) => row.record_type },
                { header: 'Record ID', accessor: (row) => row.record_id },
                { header: 'Description', accessor: (row) => row.description },
            ]
        );
    };

    const columns = [
        {
            key: 'created_at',
            label: 'Timestamp',
            render: (v: unknown): ReactNode => (
                <span style={{ fontSize: 11, color: 'var(--slate-600)', whiteSpace: 'nowrap' }}>
                    {formatDate(v as string)}
                </span>
            ),
        },
        {
            key: 'user_name',
            label: 'User',
            render: (v: unknown, row: Record<string, unknown>): ReactNode => (
                <div>
                    <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: 11 }}>{v as string}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{row.user_email as string}</div>
                </div>
            ),
        },
        {
            key: 'action',
            label: 'Action',
            render: (v: unknown): ReactNode => {
                const style = actionColors[v as string] || { bg: 'var(--slate-100)', color: 'var(--slate-600)' };
                return (
                    <span style={{
                        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: style.bg, color: style.color, textTransform: 'uppercase'
                    }}>
                        {v as string}
                    </span>
                );
            },
        },
        {
            key: 'module',
            label: 'Module',
            render: (v: unknown): ReactNode => (
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--slate-700)' }}>{v as string}</span>
            ),
        },
        {
            key: 'description',
            label: 'Description',
            render: (v: unknown): ReactNode => (
                <span style={{ fontSize: 11, color: 'var(--slate-600)', whiteSpace: 'normal' }}>{v as string}</span>
            ),
            wrap: true,
            width: '280px',
        },
        {
            key: 'details',
            label: 'Record ID / Type',
            render: (_: unknown, row: Record<string, unknown>): ReactNode => (
                <div>
                    {row.record_type ? (
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-700)' }}>
                            {row.record_type as string}
                        </div>
                    ) : null}
                    {row.record_id ? (
                        <div style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'monospace' }}>
                            {row.record_id as string}
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            key: 'changes',
            label: 'Changes',
            render: (_: unknown, row: Record<string, unknown>): ReactNode => {
                const changes = getChangedFields(row);
                if (changes.length === 0) {
                    return <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>No field snapshot</span>;
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                        {changes.map((change) => (
                            <div
                                key={change.field}
                                style={{
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    background: 'var(--slate-50)',
                                    border: '1px solid var(--slate-100)',
                                }}
                            >
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-700)', textTransform: 'capitalize' }}>
                                    {change.field.replaceAll('_', ' ')}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                                    <span style={{ fontSize: 10, color: 'var(--danger)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {formatAuditValue(change.oldValue)}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--success)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {formatAuditValue(change.newValue)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            },
            wrap: true,
            width: '300px',
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Audit Trail"
                subtitle="Track create, update, delete, approval, and workflow activity across the system"
                breadcrumbs={[
                    { label: 'Internal Audit', href: '/internal-audit' },
                    { label: 'System Audit Trail' },
                ]}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={handleExport}
                            disabled={filteredLogs.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 14px', borderRadius: 8, border: '1px solid var(--slate-200)',
                                background: 'white',
                                fontSize: 11, fontWeight: 600, color: 'var(--slate-700)', cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
                                opacity: filteredLogs.length === 0 ? 0.55 : 1,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                        >
                            <Download size={16} /> Export evidence
                        </button>
                        <button
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['audit_log'] })}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 14px', borderRadius: 8, border: '1px solid var(--slate-200)',
                                background: 'white',
                                fontSize: 11, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                        >
                            <Activity size={16} /> Refresh logs
                        </button>
                    </div>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Filtered Logs" value={String(totalLogs)} icon={<ClipboardList size={20} />} color="blue" />
                <StatCard title="Today's Activity" value={String(todayLogs)} icon={<Activity size={20} />} color="green" />
                <StatCard title="Active Users" value={String(uniqueUsers)} icon={<User size={20} />} color="purple" />
                <StatCard title="Deletions" value={String(deletes)} icon={<Database size={20} />} color="red" />
                <StatCard title="Edits Tracked" value={String(updates)} icon={<GitCompareArrows size={20} />} color="amber" />
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 16,
                    marginBottom: 20,
                }}
            >
                <div
                    style={{
                        padding: 16,
                        borderRadius: 10,
                        border: '1px solid var(--slate-200)',
                        background: 'var(--card-bg)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <ShieldCheck size={18} color="var(--primary-600)" />
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-800)' }}>Audit coverage</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Modules captured</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-900)' }}>{coveredModules}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Latest event</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-700)' }}>{latestEvent}</div>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        padding: 16,
                        borderRadius: 10,
                        border: '1px solid var(--slate-200)',
                        background: 'var(--card-bg)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Filter size={18} color="var(--slate-500)" />
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-800)' }}>Compliance filters</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                        <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 11 }}>
                            <option>{ALL_FILTER}</option>
                            {modules.map((module) => <option key={module}>{module}</option>)}
                        </select>
                        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 11 }}>
                            <option>{ALL_FILTER}</option>
                            {actions.map((action) => <option key={action}>{action}</option>)}
                        </select>
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 11 }} />
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 11 }} />
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredLogs}
                loading={loading}
                searchPlaceholder="Search logs by user, action, module, or description..."
                pageSize={20}
            />
        </div>
    );
}
