'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ExpenseModal from '@/components/ExpenseModal';
import { Plus, Banknote, TrendingUp, Receipt, Clock, Edit2, Trash2 } from 'lucide-react';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { formatCurrency } from '@/lib/currency';

export default function ExpensesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data, isLoading: loading } = useSupabaseQuery<any>('expenses', {
        orderBy: 'date',
        ascending: false,
    });
    const expenses = data ?? [];

    const deleteMutation = useDelete('expenses');

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;
        deleteMutation.mutate(id);
    };

    const openCreate = () => {
        setSelectedExpense(null);
        setIsModalOpen(true);
    };

    const openEdit = (row: any) => {
        setSelectedExpense(row);
        setIsModalOpen(true);
    };

    // --- Stat calculations ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthExpenses = expenses.filter((e: any) => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalThisMonth = thisMonthExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    const pendingCount = expenses.filter((e: any) => e.status === 'Pending').length;

    const totalExpensesCount = expenses.length;

    // Average monthly: total amount / number of distinct months
    const avgMonthly = (() => {
        if (expenses.length === 0) return 0;
        const totalAmount = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
        const months = new Set(expenses.map((e: any) => {
            const d = new Date(e.date);
            return `${d.getFullYear()}-${d.getMonth()}`;
        }));
        return months.size > 0 ? totalAmount / months.size : 0;
    })();

    const columns = [
        {
            key: 'expense_number',
            label: 'Expense #',
            render: (v: unknown) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span>
            )
        },
        { key: 'date', label: 'Date' },
        {
            key: 'category',
            label: 'Category',
            render: (v: unknown) => (
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>{v as string}</span>
            )
        },
        {
            key: 'description',
            label: 'Description',
            wrap: true,
            width: '200px'
        },
        { key: 'payee', label: 'Payee' },
        {
            key: 'amount',
            label: 'Amount',
            render: (v: unknown) => (
                <span style={{ fontWeight: 700 }}>{formatCurrency(Number(v) || 0)}</span>
            )
        },
        { key: 'payment_method', label: 'Payment Method' },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => {
                const s = v as string;
                const variant = s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : 'warning';
                return <StatusBadge status={s} variant={variant} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '100px',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                        style={{ border: 'none', background: 'var(--primary-50)', color: 'var(--primary-600)', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Edit Expense"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                        style={{ border: 'none', background: 'var(--danger-50)', color: 'var(--danger)', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Delete Expense"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Expenses"
                subtitle="Track and categorise business expenses"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/expenses' }, { label: 'Expenses' }]}
                actions={
                    <button
                        onClick={openCreate}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Record Expense
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard
                    title="Total This Month"
                    value={formatCurrency(totalThisMonth)}
                    icon={<Banknote size={20} />}
                    color="blue"
                />
                <StatCard
                    title="Pending Approval"
                    value={pendingCount.toString()}
                    icon={<Clock size={20} />}
                    color="amber"
                />
                <StatCard
                    title="Total Expenses"
                    value={totalExpensesCount.toString()}
                    icon={<Receipt size={20} />}
                    color="teal"
                />
                <StatCard
                    title="Avg Monthly"
                    value={formatCurrency(avgMonthly)}
                    icon={<TrendingUp size={20} />}
                    color="purple"
                />
            </div>

            <DataTable
                columns={columns}
                data={expenses}
                loading={loading}
                searchPlaceholder="Search expenses..."
            />

            <ExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
                record={selectedExpense}
            />
        </div>
    );
}
