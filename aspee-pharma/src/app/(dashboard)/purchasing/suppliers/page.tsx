'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import SupplierModal from '@/components/SupplierModal';
import { Plus, Download, Edit2, Trash2, Mail, Phone } from 'lucide-react';
import { useSupabaseQuery, useSave, useDelete } from '@/lib/hooks';

export default function SuppliersPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

    const { data, isLoading: loading } = useSupabaseQuery<any>('suppliers', {
        orderBy: 'name',
        ascending: true,
    });
    const suppliers = data ?? [];

    const saveMutation = useSave('suppliers', {
        successMessage: {
            create: 'Supplier added successfully',
            update: 'Supplier updated successfully',
        },
    });

    const deleteMutation = useDelete('suppliers');

    const handleSave = async (formData: any) => {
        await saveMutation.mutateAsync(formData);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this supplier?')) return;
        deleteMutation.mutate(id);
    };

    const exportToCSV = () => {
        if (suppliers.length === 0) return;
        const headers = ['Name', 'Contact Person', 'Email', 'Phone', 'Category', 'Payment Terms', 'Status'];
        const csvContent = [
            headers.join(','),
            ...suppliers.map((s: any) => [
                `"${s.name}"`,
                `"${s.contact_person || ''}"`,
                `"${s.email || ''}"`,
                `"${s.phone || ''}"`,
                `"${s.category}"`,
                `"${s.payment_terms || ''}"`,
                `"${s.status}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `suppliers_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            key: 'name',
            label: 'Supplier Name',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{v}</span>
                    <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{row.id.split('-')[0]}</span>
                </div>
            )
        },
        {
            key: 'contact_person',
            label: 'Contact',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {v && <span style={{ fontWeight: 500 }}>{v}</span>}
                    <div style={{ display: 'flex', gap: 8, color: 'var(--slate-400)' }}>
                        {row.email && <span title={row.email} style={{ display: 'flex', cursor: 'help' }}><Mail size={12} /></span>}
                        {row.phone && <span title={row.phone} style={{ display: 'flex', cursor: 'help' }}><Phone size={12} /></span>}
                    </div>
                </div>
            )
        },
        {
            key: 'category',
            label: 'Category',
            render: (v: any) => (
                <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    background: v === 'Local' ? 'var(--primary-50)' : v === 'Imported' ? 'var(--accent-50)' : '#f5f3ff',
                    color: v === 'Local' ? 'var(--primary-600)' : v === 'Imported' ? 'var(--accent-600)' : '#7c3aed',
                }}>
                    {v}
                </span>
            )
        },
        { key: 'payment_terms', label: 'Payment Terms' },
        {
            key: 'status',
            label: 'Status',
            render: (v: any) => (
                <StatusBadge status={v} variant={v === 'Active' ? 'success' : 'default'} />
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => {
                            setSelectedSupplier(row);
                            setIsModalOpen(true);
                        }}
                        style={actionButtonStyle}
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
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
                title="Suppliers"
                subtitle="Manage your supplier network and relationships"
                breadcrumbs={[
                    { label: 'Purchasing', href: '/purchasing/suppliers' },
                    { label: 'Suppliers' },
                ]}
                actions={
                    <>
                        <button
                            onClick={exportToCSV}
                            disabled={suppliers.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                                cursor: 'pointer', opacity: suppliers.length === 0 ? 0.5 : 1
                            }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={() => {
                                setSelectedSupplier(null);
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
                            <Plus size={16} /> Add Supplier
                        </button>
                    </>
                }
            />

            <DataTable
                columns={columns}
                data={suppliers}
                searchPlaceholder="Search suppliers by name, email, or category..."
            />

            <SupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                supplier={selectedSupplier}
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
