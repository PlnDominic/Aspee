'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, ClipboardCheck, AlertTriangle, CheckCircle, Clock, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import SendToMDModal from '@/components/SendToMDModal';

export default function AuditPlansPage() {
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const { data, isLoading } = useSupabaseQuery<any>('audit_plans', { orderBy: 'created_at', ascending: false });
    const plans = data ?? [];
    const queryClient = useQueryClient();
    const deleteMutation = useDelete('audit_plans');

    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState({ title: '', area: '', scheduled_date: '', auditor: '', status: 'Planned' });
    const [saving, setSaving] = useState(false);

    const open = (row?: any) => {
        setSelected(row ?? null);
        setForm(row ? { title: row.title, area: row.area, scheduled_date: row.scheduled_date, auditor: row.auditor, status: row.status } : { title: '', area: '', scheduled_date: '', auditor: '', status: 'Planned' });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.title || !form.scheduled_date) return toast.error('Title and date are required');
        setSaving(true);
        const { error } = selected
            ? await supabase.from('audit_plans').update(form).eq('id', selected.id)
            : await supabase.from('audit_plans').insert(form);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(selected ? 'Audit plan updated' : 'Audit plan created');
        queryClient.invalidateQueries({ queryKey: ['audit_plans'] });
        setModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this audit plan?')) return;
        deleteMutation.mutate(id);
    };

    const total = plans.length;
    const planned = plans.filter((p: any) => p.status === 'Planned').length;
    const inProgress = plans.filter((p: any) => p.status === 'In Progress').length;
    const completed = plans.filter((p: any) => p.status === 'Completed').length;

    const columns = [
        { key: 'title', label: 'Audit Title', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
        { key: 'area', label: 'Area / Department' },
        { key: 'auditor', label: 'Lead Auditor' },
        { key: 'scheduled_date', label: 'Scheduled Date' },
        { key: 'status', label: 'Status', render: (v: string) => (
            <StatusBadge
                status={v}
                variant={v === 'Completed' ? 'success' : v === 'In Progress' ? 'info' : v === 'Overdue' ? 'danger' : 'warning'}
            />
        )},
        { key: 'actions', label: '', render: (_: any, row: any) => (
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => open(row)} style={{ fontSize: 11, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                <button onClick={() => handleDelete(row.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
        )},
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader 
                title="Internal Audit" 
                subtitle="Manage audit plans, reports, and non-conformances"
                breadcrumbs={[{ label: 'Internal Audit' }, { label: 'Audit Plans' }]}
                actions={
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                            color: 'white',
                            fontSize: 13,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <Send size={15} /> Send Weekly Report
                    </button>
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard title="Total Plans" value={total} icon={<ClipboardCheck size={18} />} color="blue" />
                <StatCard title="Planned" value={planned} icon={<Clock size={18} />} color="amber" />
                <StatCard title="In Progress" value={inProgress} icon={<AlertTriangle size={18} />} color="purple" />
                <StatCard title="Completed" value={completed} icon={<CheckCircle size={18} />} color="green" />
            </div>

            <DataTable
                columns={columns}
                data={plans}
                loading={isLoading}
                actions={
                    <button
                        onClick={() => open()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New Audit Plan
                    </button>
                }
            />

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Audit Plan' : 'New Audit Plan'} size="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                        { label: 'Audit Title', key: 'title', type: 'text' },
                        { label: 'Area / Department', key: 'area', type: 'text' },
                        { label: 'Lead Auditor', key: 'auditor', type: 'text' },
                        { label: 'Scheduled Date', key: 'scheduled_date', type: 'date' },
                    ].map(f => (
                        <div key={f.key}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                            <input
                                type={f.type}
                                value={(form as any)[f.key]}
                                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}
                            />
                        </div>
                    ))}
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Status</label>
                        <select
                            value={form.status}
                            onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}
                        >
                            {['Planned', 'In Progress', 'Completed', 'Overdue', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={() => setModalOpen(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--primary-600)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </Modal>

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Internal Audit" 
            />
        </div>
    );
}
