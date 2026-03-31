'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import EmployeePayrollModal from '@/components/EmployeePayrollModal';
import { Users, Banknote, CheckCircle, Send, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useSave, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

// Statuses HR can set — cannot mark as Processed/Paid (that's accounts)
const HR_STATUSES = ['Draft', 'Approved by HR'];

export default function HRPayrollPage() {
    const { data, isLoading } = useSupabaseQuery<any>('payroll', { orderBy: 'created_at', ascending: false });
    const payrollData = data ?? [];
    const queryClient = useQueryClient();

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    const saveMutation = useSave('payroll', {
        successMessage: { create: 'Payroll entry added', update: 'Payroll entry updated' },
    });
    const deleteMutation = useDelete('payroll');

    const handleSave = async (formData: any) => {
        await saveMutation.mutateAsync(formData);
        setModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Delete this payroll record?')) return;
        deleteMutation.mutate(id);
    };

    // Submit one record to accounts (set status → Approved by HR)
    const submitToAccounts = async (row: any) => {
        if (!confirm(`Submit ${row.employee_name}'s payroll to Accounts for payment?`)) return;
        const { error } = await supabase
            .from('payroll')
            .update({ status: 'Approved by HR' })
            .eq('id', row.id);
        if (error) return toast.error(error.message);
        toast.success(`${row.employee_name} submitted to Accounts`);
        queryClient.invalidateQueries({ queryKey: ['payroll'] });
    };

    // Bulk submit all Draft records
    const submitAllDrafts = async () => {
        const drafts = payrollData.filter((r: any) => r.status === 'Draft');
        if (drafts.length === 0) return toast.info('No draft records to submit');
        if (!confirm(`Submit all ${drafts.length} draft records to Accounts?`)) return;
        const ids = drafts.map((r: any) => r.id);
        const { error } = await supabase
            .from('payroll')
            .update({ status: 'Approved by HR' })
            .in('id', ids);
        if (error) return toast.error(error.message);
        toast.success(`${drafts.length} records submitted to Accounts`);
        queryClient.invalidateQueries({ queryKey: ['payroll'] });
    };

    const drafts = payrollData.filter((r: any) => r.status === 'Draft').length;
    const approved = payrollData.filter((r: any) => r.status === 'Approved by HR').length;
    const processed = payrollData.filter((r: any) => ['Processed', 'Paid'].includes(r.status)).length;
    const totalNet = payrollData
        .filter((r: any) => r.status !== 'Draft')
        .reduce((s: number, r: any) => s + (Number(r.net_pay) || 0), 0);

    const columns = [
        {
            key: 'employee_name',
            label: 'Employee',
            render: (v: string, row: any) => (
                <div>
                    <p style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{v}</p>
                    <p style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>{row.employee_id_number}</p>
                </div>
            ),
        },
        { key: 'role', label: 'Role' },
        { key: 'department', label: 'Department' },
        { key: 'gross_pay', label: 'Gross Pay', render: (v: any) => formatCurrency(Number(v) || 0) },
        { key: 'allowances', label: 'Allowances', render: (v: any) => formatCurrency(Number(v) || 0) },
        { key: 'deductions', label: 'Deductions', render: (v: any) => formatCurrency(Number(v) || 0) },
        { key: 'paye_tax', label: 'PAYE', render: (v: any) => formatCurrency(Number(v) || 0) },
        {
            key: 'net_pay', label: 'Net Pay',
            render: (v: any) => <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(Number(v) || 0)}</span>,
        },
        { key: 'pay_period', label: 'Period' },
        {
            key: 'status', label: 'Status',
            render: (v: string) => (
                <StatusBadge
                    status={v}
                    variant={v === 'Paid' ? 'success' : v === 'Processed' ? 'info' : v === 'Approved by HR' ? 'warning' : 'default'}
                />
            ),
        },
        {
            key: 'actions', label: '',
            render: (_: any, row: any) => {
                const editable = ['Draft'].includes(row.status);
                const submittable = row.status === 'Draft';
                return (
                    <div style={{ display: 'flex', gap: 6 }}>
                        {submittable && (
                            <button
                                onClick={() => submitToAccounts(row)}
                                title="Submit to Accounts"
                                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--primary-50)', color: 'var(--primary-600)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                <Send size={12} /> Submit
                            </button>
                        )}
                        {editable && (
                            <button onClick={() => { setSelectedRecord(row); setModalOpen(true); }} style={btnStyle}>
                                <Edit2 size={14} />
                            </button>
                        )}
                        {editable && (
                            <button onClick={() => handleDelete(row.id)} style={{ ...btnStyle, color: 'var(--danger)' }}>
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div>
            {/* Info banner */}
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                background: 'var(--primary-50)', border: '1px solid var(--primary-200)',
                borderRadius: 10, marginBottom: 20, fontSize: 12, color: 'var(--primary-700)',
            }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                    HR prepares and validates payroll here. <strong>Draft</strong> records are editable.
                    Use <strong>Submit to Accounts</strong> (or bulk submit) to send approved records to the Accounting team for salary payment.
                    Once submitted, only Accounts can process and mark as Paid.
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard title="Draft" value={drafts} icon={<Users size={18} />} color="amber" />
                <StatCard title="Submitted to Accounts" value={approved} icon={<Send size={18} />} color="blue" />
                <StatCard title="Processed / Paid" value={processed} icon={<CheckCircle size={18} />} color="green" />
                <StatCard title="Total Net Payroll" value={formatCurrency(totalNet)} icon={<Banknote size={18} />} color="teal" />
            </div>

            <DataTable
                columns={columns}
                data={payrollData}
                loading={isLoading}
                actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                        {drafts > 0 && (
                            <button
                                onClick={submitAllDrafts}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                                <Send size={15} /> Submit All Drafts ({drafts})
                            </button>
                        )}
                        <button
                            onClick={() => { setSelectedRecord(null); setModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                            + Add Entry
                        </button>
                    </div>
                }
            />

            <EmployeePayrollModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={handleSave}
                record={selectedRecord}
                availableStatuses={HR_STATUSES}
            />
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)',
    background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
