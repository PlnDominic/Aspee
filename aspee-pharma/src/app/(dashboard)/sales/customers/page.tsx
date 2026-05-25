'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import CustomerModal from '@/components/CustomerModal';
import ExcelImportModal from '@/components/ExcelImportModal';
import PrintableSOA from '@/components/PrintableSOA';
import { generatePDF } from '@/lib/pdfGenerator';
import { Plus, Download, Upload, Users, Banknote, AlertTriangle, CreditCard, Edit2, Trash2, Phone, FileText, IdCard, Tag, MapPin, UserCheck, Eye } from 'lucide-react';
import EntityDocumentsModal from '@/components/compliance/EntityDocumentsModal';
import { supabase } from '@/lib/supabase';
import { useFetch, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function CustomersPage() {
    const { data, isLoading: loading } = useFetch<any[]>(
        ['customers'],
        async () => {
            const { data: customersData, error: customersError } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });

            if (customersError) {
                return { data: null, error: customersError };
            }

            const { data: invoices, error: invoicesError } = await supabase
                .from('sales_invoices')
                .select('customer_name, total_amount, status');

            if (invoicesError) {
                return { data: null, error: invoicesError };
            }

            const { data: receipts, error: receiptsError } = await supabase
                .from('sales_receipts')
                .select('customer_name, amount, status');

            if (receiptsError) {
                return { data: null, error: receiptsError };
            }

            const normalizeCustomerName = (name: string | null | undefined) => (name || '').trim().toLowerCase();
            const invoiceTotals = new Map<string, number>();
            const receiptTotals = new Map<string, number>();

            (invoices || []).forEach((invoice: any) => {
                const status = (invoice.status || '').trim().toUpperCase();
                if (status === 'DRAFT' || status === 'CANCELLED') return;

                const key = normalizeCustomerName(invoice.customer_name);
                if (!key) return;
                invoiceTotals.set(key, (invoiceTotals.get(key) || 0) + Number(invoice.total_amount || 0));
            });

            (receipts || []).forEach((receipt: any) => {
                const status = (receipt.status || '').trim().toUpperCase();
                if (status === 'VOID' || status === 'CANCELLED') return;

                const key = normalizeCustomerName(receipt.customer_name);
                if (!key) return;
                receiptTotals.set(key, (receiptTotals.get(key) || 0) + Number(receipt.amount || 0));
            });

            const enrichedCustomers = (customersData || []).map((customer: any) => {
                const key = normalizeCustomerName(customer.name);
                const invoiceTotal = invoiceTotals.get(key) || 0;
                const receiptTotal = receiptTotals.get(key) || 0;
                return {
                    ...customer,
                    balance: invoiceTotal - receiptTotal,
                };
            });

            return { data: enrichedCustomers, error: null };
        },
    );
    const customers = data ?? [];
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [viewOnly, setViewOnly] = useState(false);
    const [exportingSOA, setExportingSOA] = useState<string | null>(null);

    const [docsOpen, setDocsOpen] = useState(false);
    const [docsCustomer, setDocsCustomer] = useState<any | null>(null);

    const openDocs = (customer: any) => {
        setDocsCustomer(customer);
        setDocsOpen(true);
    };

    const closeDocs = () => {
        setDocsOpen(false);
        setDocsCustomer(null);
    };

    const [soaData, setSoaData] = useState<{
        customer: any;
        transactions: any[];
        summary: { totalInvoices: number; totalPayments: number; balance: number };
    } | null>(null);

    const deleteMutation = useDelete('customers');

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this customer?')) return;
        deleteMutation.mutate(id);
    };

    const handleExportSOA = async (customer: any) => {
        setExportingSOA(customer.id);
        try {
            // Fetch invoices for this customer
            const { data: invoices } = await supabase
                .from('sales_invoices')
                .select('id, invoice_number, date, total_amount, status')
                .ilike('customer_name', customer.name)
                .order('date', { ascending: true });

            // Fetch receipts/payments for this customer
            const { data: receipts } = await supabase
                .from('sales_receipts')
                .select('id, receipt_number, date, amount')
                .ilike('customer_name', customer.name)
                .order('date', { ascending: true });

            // Combine and sort transactions
            const invoiceTxns = (invoices || []).map((inv: any) => ({
                date: inv.date,
                reference: inv.invoice_number,
                type: 'Invoice' as const,
                amount: Number(inv.total_amount) || 0
            }));

            const receiptTxns = (receipts || []).map((rec: any) => ({
                date: rec.date,
                reference: rec.receipt_number,
                type: 'Payment' as const,
                amount: Number(rec.amount) || 0
            }));

            // Sort all transactions by date
            const allTxns = [...invoiceTxns, ...receiptTxns].sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateA - dateB;
            });

            // Calculate running balance
            let runningBalance = 0;
            const transactions = allTxns.map(txn => {
                if (txn.type === 'Invoice') {
                    runningBalance += txn.amount;
                } else {
                    runningBalance -= txn.amount;
                }
                return {
                    ...txn,
                    date: new Date(txn.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                    balance: runningBalance
                };
            });

            const totalInvoices = invoiceTxns.reduce((sum, t) => sum + t.amount, 0);
            const totalPayments = receiptTxns.reduce((sum, t) => sum + t.amount, 0);

            // Determine date range
            const dates = allTxns.map(t => new Date(t.date));
            const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
            const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();

            const dateRange = {
                from: minDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                to: maxDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            };

            // If no transactions, use current month range
            if (allTxns.length === 0) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateRange.from = startOfMonth.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                dateRange.to = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }

            setSoaData({
                customer,
                transactions,
                summary: {
                    totalInvoices,
                    totalPayments,
                    balance: runningBalance
                }
            });

            // Wait for state to update, then generate PDF
            setTimeout(async () => {
                await generatePDF('printable-soa', `SOA_${customer.name.replace(/\s+/g, '_')}`);
                setSoaData(null);
                setExportingSOA(null);
            }, 500);

        } catch (error: any) {
            toast.error('Failed to generate SOA: ' + error.message);
            setExportingSOA(null);
        }
    };

    // Stats
    const totalCustomers = customers.length;
    const totalReceivables = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
    const overdueAccounts = customers.filter(c => (c.balance || 0) > (c.credit_limit || 0) && (c.balance || 0) > 0).length;
    const creditHolds = customers.filter(c => c.status === 'Inactive').length;

    // Category counts
    const categoryBreakdown: Record<string, number> = {};
    customers.forEach(c => {
        const cat = c.customer_category || 'Uncategorised';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });
    const CATEGORY_COLORS: Record<string, string> = {
        'OTC': '#0ea5e9',
        'WHOLESALE PHARMACY': '#8b5cf6',
        'RETAIL PHARMACY': '#10b981',
        'CLINIC': '#f59e0b',
        'HOSPITAL': '#ef4444',
        'MEDICAL STORES': '#06b6d4',
        'Uncategorised': '#94a3b8',
    };

    const columns = [
        {
            key: 'name',
            label: 'Customer Name',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{v}</span>
                    {row.contact_person && (
                        <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{row.contact_person}</span>
                    )}
                </div>
            )
        },
        {
            key: 'customer_category',
            label: 'Category',
            render: (v: any) => v ? (
                <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    background: (CATEGORY_COLORS[v] || '#94a3b8') + '20',
                    color: CATEGORY_COLORS[v] || '#94a3b8',
                    whiteSpace: 'nowrap',
                }}>
                    {v}
                </span>
            ) : <span style={{ color: 'var(--slate-400)', fontSize: 11 }}>--</span>
        },
        {
            key: 'route',
            label: 'Route',
            render: (v: any) => v ? (
                <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    background: 'var(--primary-50)',
                    color: 'var(--primary-600)',
                }}>
                    {v}
                </span>
            ) : <span style={{ color: 'var(--slate-400)' }}>--</span>
        },
        {
            key: 'sales_person',
            label: 'Sales Person',
            render: (v: any) => v ? (
                <span style={{ fontSize: 11, color: 'var(--slate-700)', fontWeight: 500 }}>{v}</span>
            ) : <span style={{ color: 'var(--slate-400)', fontSize: 11 }}>--</span>
        },
        {
            key: 'credit_limit',
            label: 'Credit Limit',
            render: (v: any) => (
                <span style={{ fontWeight: 500 }}>{formatCurrency(v || 0)}</span>
            )
        },
        {
            key: 'balance',
            label: 'Balance',
            render: (v: any, row: any) => {
                const balance = v || 0;
                const isOverLimit = balance > (row.credit_limit || 0) && balance > 0;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: isOverLimit ? 'var(--danger)' : balance > 0 ? 'var(--slate-800)' : 'var(--success)' }}>
                            {formatCurrency(balance)}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)' }}>
                            Outstanding balance
                        </span>
                    </div>
                );
            }
        },
        { key: 'payment_terms', label: 'Terms' },
        {
            key: 'phone',
            label: 'Contact Number',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={12} style={{ color: 'var(--slate-400)' }} />
                    <span style={{ fontSize: 11, color: v ? 'var(--slate-700)' : 'var(--slate-400)' }}>
                        {v || '--'}
                    </span>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: any) => (
                <StatusBadge status={v} variant={v === 'Active' ? 'success' : 'danger'} />
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(row);
                            setViewOnly(true);
                            setIsModalOpen(true);
                        }}
                        style={actionButtonStyle}
                        title="View Customer"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleExportSOA(row);
                        }}
                        disabled={exportingSOA === row.id}
                        style={{
                            ...actionButtonStyle,
                            color: exportingSOA === row.id ? 'var(--slate-400)' : 'var(--primary-600)',
                            cursor: exportingSOA === row.id ? 'not-allowed' : 'pointer',
                        }}
                        title="Export Statement of Account"
                    >
                        {exportingSOA === row.id ? (
                            <span style={{ fontSize: 10 }}>...</span>
                        ) : (
                            <FileText size={14} />
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openDocs(row);
                        }}
                        style={{ ...actionButtonStyle, color: 'var(--slate-700)' }}
                        title="Customer Documents (Ghana Card)"
                    >
                        <IdCard size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(row);
                            setViewOnly(false);
                            setIsModalOpen(true);
                        }}
                        style={actionButtonStyle}
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row.id);
                        }}
                        style={{ ...actionButtonStyle, color: 'var(--danger)' }}
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
                title="Customers"
                subtitle="Customer accounts, credit management, and statements"
                breadcrumbs={[{ label: 'Customers' }]}
                actions={
                    <>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 16px', borderRadius: 8,
                            border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                            fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                            cursor: 'pointer',
                        }}>
                            <Download size={16} /> Export SOA
                        </button>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                                cursor: 'pointer',
                            }}
                        >
                            <Upload size={16} /> Import Excel
                        </button>
                        <button
                            onClick={() => {
                                setSelectedCustomer(null);
                                setViewOnly(false);
                                setIsModalOpen(true);
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 18px', borderRadius: 8,
                                border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                fontSize: 11, fontWeight: 600, color: 'white',
                                cursor: 'pointer', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                            }}
                        >
                            <Plus size={16} /> Add Customer
                        </button>
                    </>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                <StatCard title="Total Customers" value={String(totalCustomers)} icon={<Users size={20} />} color="blue" />
                <StatCard title="Total Receivables" value={formatCurrency(totalReceivables)} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Overdue Accounts" value={String(overdueAccounts)} icon={<AlertTriangle size={20} />} color="red" />
                <StatCard title="Credit Holds" value={String(creditHolds)} icon={<CreditCard size={20} />} color="amber" />
            </div>

            {/* ── Category Breakdown ── */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24,
                padding: '14px 18px', borderRadius: 12,
                background: 'var(--card-bg)', border: '1px solid var(--slate-100)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
                    <Tag size={12} style={{ color: 'var(--slate-400)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        By Category
                    </span>
                </div>
                {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <div key={cat} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 20,
                        background: (CATEGORY_COLORS[cat] || '#94a3b8') + '15',
                        border: `1px solid ${(CATEGORY_COLORS[cat] || '#94a3b8')}30`,
                    }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: CATEGORY_COLORS[cat] || '#94a3b8', flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[cat] || '#94a3b8' }}>
                            {cat}
                        </span>
                        <span style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--slate-700)',
                            background: 'var(--slate-100)', borderRadius: 10, padding: '0 6px',
                        }}>
                            {count}
                        </span>
                    </div>
                ))}
                {Object.keys(categoryBreakdown).length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>No customers yet</span>
                )}
            </div>

            <EntityDocumentsModal
                isOpen={docsOpen}
                onClose={closeDocs}
                title={`Customer Documents — ${docsCustomer?.name || ''}`}
                entityType="customer"
                entityId={docsCustomer?.id || ''}
                allowedDocumentTypes={[{ label: 'Ghana Card', value: 'GHANA_CARD', allowMultiple: false }]}
            />

            <DataTable
                columns={columns}
                data={customers}
                loading={loading}
                searchPlaceholder="Search by name, category, route, sales person..."
            />

            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                entityType="customers"
            />

            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                record={selectedCustomer}
                readOnly={viewOnly}
            />

            {/* Hidden Printable SOA - rendered for PDF generation */}
            {soaData && (
                <PrintableSOA
                    customer={soaData.customer}
                    transactions={soaData.transactions}
                    summary={soaData.summary}
                    dateRange={{
                        from: soaData.transactions.length > 0 ? soaData.transactions[0].date : new Date().toLocaleDateString('en-GB'),
                        to: soaData.transactions.length > 0 ? soaData.transactions[soaData.transactions.length - 1].date : new Date().toLocaleDateString('en-GB')
                    }}
                />
            )}
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
