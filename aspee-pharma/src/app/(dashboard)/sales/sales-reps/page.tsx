'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import SalesRepModal from '@/components/SalesRepModal';
import { Plus, Users, UserCheck, UserX, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import { useSupabaseQuery, useAction, useDelete } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

export default function SalesRepsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data, isLoading: loading } = useSupabaseQuery<any>('sales_reps', {
        orderBy: 'name',
        ascending: true,
    });
    const rows = data ?? [];

    const stats = useMemo(() => {
        const active = rows.filter((r: any) => r.status === 'Active').length;
        const inactive = rows.length - active;
        return { total: rows.length, active, inactive };
    }, [rows]);

    const toggleStatusMutation = useAction<{ id: string; status: string }>({
        mutationFn: async ({ id, status }) => {
            const { error } = await supabase.from('sales_reps').update({ status }).eq('id', id);
            if (error) throw error;
        },
        invalidateKeys: ['sales_reps'],
        successMessage: 'Sales rep status updated',
    });

    const deleteMutation = useDelete('sales_reps');

    const handleOpenCreate = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: any) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const handleToggleStatus = (row: any) => {
        toggleStatusMutation.mutate({ id: row.id, status: row.status === 'Active' ? 'Inactive' : 'Active' });
    };

    const handleDelete = (row: any) => {
        if (!confirm(`Remove ${row.name} from the sales reps roster? This cannot be undone.`)) return;
        deleteMutation.mutate(row.id);
    };

    const columns = [
        {
            key: 'name',
            label: 'Name',
            render: (v: unknown) => (
                <span style={{ fontWeight: 700, color: 'var(--slate-800)', fontSize: 12 }}>{v as string}</span>
            ),
        },
        { key: 'phone', label: 'Phone', render: (v: unknown) => (v as string) || <span style={{ color: 'var(--slate-300)' }}>—</span> },
        { key: 'email', label: 'Email', render: (v: unknown) => (v as string) || <span style={{ color: 'var(--slate-300)' }}>—</span> },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => (
                <StatusBadge status={v as string} variant={v === 'Active' ? 'success' : 'default'} />
            ),
        },
        { key: 'notes', label: 'Notes', wrap: true },
        {
            key: 'actions',
            label: 'Actions',
            render: (_v: unknown, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
                        style={actionButtonStyle}
                        title="Edit sales rep"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(row); }}
                        style={{
                            ...actionButtonStyle,
                            background: row.status === 'Active' ? 'var(--amber-50, #fffbeb)' : 'var(--success-50, #f0fdf4)',
                            color: row.status === 'Active' ? '#b45309' : '#15803d',
                        }}
                        title={row.status === 'Active' ? 'Deactivate' : 'Activate'}
                    >
                        {row.status === 'Active' ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                        style={{ ...actionButtonStyle, color: 'var(--danger)' }}
                        title="Remove sales rep"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Reps"
                subtitle="Roster of van sales reps and sales managers — not tied to system login accounts"
                breadcrumbs={[{ label: 'Sales', href: '/sales/sales-reps' }, { label: 'Sales Reps' }]}
                actions={
                    <button
                        onClick={handleOpenCreate}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '9px 18px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'white',
                            cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> Add Sales Rep
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Reps" value={loading ? '---' : String(stats.total)} icon={<Users size={20} />} color="blue" />
                <StatCard title="Active" value={loading ? '---' : String(stats.active)} icon={<UserCheck size={20} />} color="green" />
                <StatCard title="Inactive" value={loading ? '---' : String(stats.inactive)} icon={<UserX size={20} />} color="amber" />
            </div>

            <DataTable
                columns={columns}
                data={rows}
                loading={loading}
                searchPlaceholder="Search sales reps..."
            />

            <SalesRepModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales_reps'] })}
                record={editingRecord}
            />
        </div>
    );
}

const actionButtonStyle: React.CSSProperties = {
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid var(--slate-200)',
    background: 'var(--card-bg)',
    color: 'var(--slate-600)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
};
