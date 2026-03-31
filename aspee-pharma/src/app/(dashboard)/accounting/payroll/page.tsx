'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import EmployeePayrollModal from '@/components/EmployeePayrollModal';
import { Users, Banknote, CheckCircle, CreditCard, Edit2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useSave, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

// Accounts can only advance status — cannot go back to Draft
const ACCOUNTS_STATUSES = ['Approved by HR', 'Processed', 'Paid'];

export default function PayrollPage() {
    const { data, isLoading: loading } = useSupabaseQuery<any>('payroll', {
        orderBy: 'created_at',
        ascending: false,
    });
    // Accounts only sees records that HR has approved
    const allData = data ?? [];
    const payrollData = allData.filter((r: any) => ['Approved by HR', 'Processed', 'Paid'].includes(r.status));

    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    const saveMutation = useSave('payroll', {
        successMessage: { create: 'Payroll entry added', update: 'Payroll record updated' },
    });

    const handleSave = async (formData: any) => {
        await saveMutation.mutateAsync(formData);
        setIsModalOpen(false);
    };

    const advanceStatus = async (row: any, newStatus: string) => {
        const { error } = await supabase.from('payroll').update({ status: newStatus }).eq('id', row.id);
        if (error) return toast.error(error.message);
        toast.success(`${row.employee_name} marked as ${newStatus}`);
        queryClient.invalidateQueries({ queryKey: ['payroll'] });
    };

    const approvedCount = payrollData.filter((r: any) => r.status === 'Approved by HR').length;
    const processedCount = payrollData.filter((r: any) => r.status === 'Processed').length;
    const paidCount = payrollData.filter((r: any) => r.status === 'Paid').length;
    const totalNet = payrollData.reduce((sum: number, r: any) => sum + (Number(r.net_pay) || 0), 0);
    const pendingNet = payrollData
        .filter((r: any) => r.status !== 'Paid')
        .reduce((sum: number, r: any) => sum + (Number(r.net_pay) || 0), 0);

    const columns = [
        {
            key: 'employee_name',
            label: 'Employee',
            render: (v: any, row: any) => (
                <div>
                    <p style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{v}</p>
                    <p style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>{row.employee_id_number}</p>
                </div>
            ),
        },
        { key: 'role', label: 'Role' },
        {
            key: 'department', label: 'Department',
            render: (v: any) => (
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
                    {v}
                </span>
            ),
        },
        { key: 'gross_pay', label: 'Gross Pay', render: (v: any) => <span style={{ fontWeight: 600 }}>{formatCurrency(Number(v) || 0)}</span> },
        { key: 'allowances', label: 'Allowances', render: (v: any) => formatCurrency(Number(v) || 0) },
        { key: 'deductions', label: 'Deductions', render: (v: any) => formatCurrency(Number(v) || 0) },
        { key: 'paye_tax', label: 'PAYE Tax', render: (v: any) => formatCurrency(Number(v) || 0) },
        {
            key: 'net_pay', label: 'Net Pay',
            render: (v: any) => <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(Number(v) || 0)}</span>,
        },
        { key: 'pay_period', label: 'Period' },
        {
            key: 'payment_method', label: 'Method',
            render: (v: string) => v || <span style={{ color: 'var(--slate-400)' }}>—</span>,
        },
        {
            key: 'status', label: 'Status',
            render: (v: any) => (
                <StatusBadge
                    status={v}
                    variant={v === 'Paid' ? 'success' : v === 'Processed' ? 'info' : 'warning'}
                />
            ),
        },
        {
            key: 'actions', label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {row.status === 'Approved by HR' && (
                        <button
                            onClick={() => advanceStatus(row, 'Processed')}
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            Mark Processed
                        </button>
                    )}
                    {row.status === 'Processed' && (
                        <button
                            onClick={() => advanceStatus(row, 'Paid')}
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--success-light)', color: '#065f46', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            Mark Paid
                        </button>
                    )}
                    {row.status !== 'Paid' && (
                        <button
                            onClick={() => { setSelectedRecord(row); setIsModalOpen(true); }}
                            style={actionButtonStyle}
                        >
                            <Edit2 size={14} />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Payroll"
                subtitle="Process and pay HR-approved employee salaries"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/payroll' }, { label: 'Payroll' }]}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--slate-500)', padding: '8px 14px', background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 8 }}>
                        <Info size={14} />
                        Payroll is prepared by HR · Accounts processes payment
                    </div>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Awaiting Processing" value={approvedCount} icon={<Users size={18} />} color="amber" />
                <StatCard title="Processed" value={processedCount} icon={<CreditCard size={18} />} color="blue" />
                <StatCard title="Paid" value={paidCount} icon={<CheckCircle size={18} />} color="green" />
                <StatCard title="Outstanding Net Pay" value={formatCurrency(pendingNet)} icon={<Banknote size={18} />} color="teal" />
            </div>

            <DataTable
                columns={columns}
                data={payrollData}
                loading={loading}
            />

            <EmployeePayrollModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSave}
                record={selectedRecord}
                availableStatuses={ACCOUNTS_STATUSES}
            />
        </div>
    );
}

const actionButtonStyle: React.CSSProperties = {
    padding: '6px', borderRadius: '6px', border: '1px solid var(--slate-200)',
    background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
};
