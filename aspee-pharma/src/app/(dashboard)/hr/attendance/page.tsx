'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, UserCheck, UserX, Clock, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';

export default function AttendancePage() {
    const today = new Date().toISOString().split('T')[0];
    const { data, isLoading } = useSupabaseQuery<any>('attendance', { orderBy: 'date', ascending: false });
    const records = data ?? [];
    const queryClient = useQueryClient();
    const deleteMutation = useDelete('attendance');

    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState({ employee_id: '', employee_name: '', date: today, time_in: '', time_out: '', status: 'Present', remarks: '' });
    const [saving, setSaving] = useState(false);

    const open = (row?: any) => {
        setSelected(row ?? null);
        setForm(row ? { employee_id: row.employee_id, employee_name: row.employee_name, date: row.date, time_in: row.time_in, time_out: row.time_out, status: row.status, remarks: row.remarks }
            : { employee_id: '', employee_name: '', date: today, time_in: '', time_out: '', status: 'Present', remarks: '' });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.employee_name || !form.date) return toast.error('Employee name and date are required');
        setSaving(true);
        const { error } = selected
            ? await supabase.from('attendance').update(form).eq('id', selected.id)
            : await supabase.from('attendance').insert(form);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(selected ? 'Record updated' : 'Attendance recorded');
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        setModalOpen(false);
    };

    const todayRecords = records.filter((r: any) => r.date === today);
    const present = todayRecords.filter((r: any) => r.status === 'Present').length;
    const absent = todayRecords.filter((r: any) => r.status === 'Absent').length;
    const late = todayRecords.filter((r: any) => r.status === 'Late').length;

    const statusVariant = (s: string) => s === 'Present' ? 'success' : s === 'Absent' ? 'danger' : s === 'Late' ? 'warning' : 'info';

    const columns = [
        { key: 'date', label: 'Date' },
        { key: 'employee_id', label: 'Employee ID', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)' }}>{v}</span> },
        { key: 'employee_name', label: 'Employee', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
        { key: 'time_in', label: 'Time In' },
        { key: 'time_out', label: 'Time Out' },
        { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} variant={statusVariant(v)} /> },
        { key: 'remarks', label: 'Remarks' },
        { key: 'actions', label: '', render: (_: any, row: any) => (
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => open(row)} style={{ fontSize: 11, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                <button onClick={() => deleteMutation.mutate(row.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
        )},
    ];

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard title="Total Records" value={records.length} icon={<CalendarDays size={18} />} color="blue" />
                <StatCard title="Present Today" value={present} icon={<UserCheck size={18} />} color="green" />
                <StatCard title="Absent Today" value={absent} icon={<UserX size={18} />} color="red" />
                <StatCard title="Late Today" value={late} icon={<Clock size={18} />} color="amber" />
            </div>

            <DataTable
                columns={columns}
                data={records}
                loading={isLoading}
                actions={
                    <button
                        onClick={() => open()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Record Attendance
                    </button>
                }
            />

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Attendance' : 'Record Attendance'} size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'Employee ID', key: 'employee_id', type: 'text' },
                            { label: 'Employee Name', key: 'employee_name', type: 'text' },
                            { label: 'Date', key: 'date', type: 'date' },
                            { label: 'Time In', key: 'time_in', type: 'time' },
                            { label: 'Time Out', key: 'time_out', type: 'time' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }} />
                            </div>
                        ))}
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Status</label>
                            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Present', 'Absent', 'Late', 'Half Day', 'On Leave'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Remarks</label>
                        <input type="text" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button onClick={() => setModalOpen(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--primary-600)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
