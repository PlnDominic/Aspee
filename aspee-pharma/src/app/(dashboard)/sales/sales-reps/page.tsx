'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import SalesRepModal from '@/components/SalesRepModal';
import { Plus, Users, UserCheck, UserX, Edit2 } from 'lucide-react';
import { useSupabaseQuery } from '@/lib/hooks';

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

    const handleOpenCreate = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: any) => {
        setEditingRecord(record);
        setIsModalOpen(true);
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
            label: '',
            render: (_v: unknown, row: any) => (
                <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
                    style={{
                        border: 'none',
                        background: 'var(--primary-50)',
                        color: 'var(--primary-600)',
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    title="Edit sales rep"
                >
                    <Edit2 size={14} />
                </button>
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
