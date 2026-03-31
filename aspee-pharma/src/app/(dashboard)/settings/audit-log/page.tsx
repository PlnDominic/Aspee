'use client';

import React, { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { Shield, Activity, User, Database, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
};

export default function AuditLogPage() {
    const queryClient = useQueryClient();
    const { data, isLoading: loading } = useFetch<any[]>(
        ['audit_log'],
        async () => {
            const result = await supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            return { data: result.data, error: result.error };
        }
    );
    const logs = data ?? [];

    const totalLogs = logs.length;
    const todayLogs = logs.filter(
        (l) => new Date(l.created_at).toDateString() === new Date().toDateString()
    ).length;
    const uniqueUsers = new Set(logs.map((l) => l.user_email)).size;
    const deletes = logs.filter((l) => l.action === 'DELETE').length;

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
                <span style={{ fontSize: 11, color: 'var(--slate-600)' }}>{v as string}</span>
            ),
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
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Audit Trail"
                subtitle="View system activity and security logs"
                breadcrumbs={[
                    { label: 'Settings', href: '/settings/users' },
                    { label: 'Audit Trail' },
                ]}
                actions={
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['audit_log'] })}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: '1px solid var(--slate-200)',
                            background: 'white',
                            fontSize: 11, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                    >
                        <Activity size={16} /> Refresh logs
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Logs (Shown)" value={String(totalLogs)} icon={<ClipboardList size={20} />} color="blue" />
                <StatCard title="Today's Activity" value={String(todayLogs)} icon={<Activity size={20} />} color="green" />
                <StatCard title="Active Users" value={String(uniqueUsers)} icon={<User size={20} />} color="purple" />
                <StatCard title="Deletions" value={String(deletes)} icon={<Database size={20} />} color="red" />
            </div>

            <DataTable
                columns={columns}
                data={logs}
                searchPlaceholder="Search logs by user, action, module, or description..."
            />
        </div>
    );
}
