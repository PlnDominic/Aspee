'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import WaybillModal from '@/components/WaybillModal';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { FileText, Plus, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatCurrency';

export default function WaybillPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedWaybill, setSelectedWaybill] = useState<any>(null);
    const [waybills, setWaybills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWaybills();
    }, []);

    const fetchWaybills = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('waybills')
                .select('*, van:vans(van_id, driver_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: requestRows, error: requestError } = await supabase
                .from('requisitions')
                .select(`
                    id,
                    requisition_number,
                    salesperson_id,
                    route_id,
                    status,
                    notes,
                    created_at,
                    updated_at,
                    salesperson:system_users!requisitions_salesperson_id_fkey(id, name, email),
                    route:vans!route_id(id, van_id, route_area),
                    items:requisition_items(
                        id,
                        product_id,
                        quantity_requested,
                        quantity_approved,
                        quantity_issued,
                        notes,
                        product:products(id, name, sku, unit)
                    )
                `)
                .order('created_at', { ascending: false });

            if (requestError) throw requestError;

            const savedWaybills = data || [];
            const savedNumbers = new Set(savedWaybills.map((waybill: any) => waybill.waybill_number));
            const pendingWaybills = (requestRows || [])
                .filter((request: any) => {
                    const normalizedStatus = String(request.status || '').trim().toUpperCase();
                    const approvedQuantity = (request.items || []).reduce(
                        (sum: number, item: any) => sum + (Number(item.quantity_approved) || 0),
                        0
                    );

                    return normalizedStatus === 'APPROVED' || approvedQuantity > 0;
                })
                .map((request: any) => {
                    const waybillNumber = `WB-${request.requisition_number}`;
                    const salesperson = Array.isArray(request.salesperson) ? request.salesperson[0] : request.salesperson;
                    const route = Array.isArray(request.route) ? request.route[0] : request.route;
                    const items = request.items || [];

                    return {
                        id: `sales-request-${request.id}`,
                        source: 'sales_request',
                        sales_request_id: request.id,
                        waybill_number: waybillNumber,
                        sales_person_name: salesperson?.name || 'Unknown Rep',
                        van_id: request.route_id,
                        date: new Date(request.updated_at || request.created_at).toISOString().split('T')[0],
                        grand_total: 0,
                        created_at: request.updated_at || request.created_at,
                        van: route ? { van_id: route.van_id, driver_name: route.route_area || '' } : null,
                        route,
                        items,
                    };
                })
                .filter((waybill: any) => !savedNumbers.has(waybill.waybill_number));

            setWaybills([...pendingWaybills, ...savedWaybills]);
        } catch (err) {
            console.error('Error fetching waybills:', err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            key: 'waybill_number',
            label: 'Waybill #',
            render: (v: string) => <span style={{ fontWeight: 700, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v}</span>
        },
        {
            key: 'date',
            label: 'Date',
            render: (v: string) => new Date(v).toLocaleDateString()
        },
        {
            key: 'sales_person_name',
            label: 'Sales Person'
        },
        {
            key: 'van',
            label: 'Van / Driver',
            render: (v: any) => v ? `${v.van_id} — ${v.driver_name}` : '—'
        },
        {
            key: 'grand_total',
            label: 'Total Value',
            render: (v: number) => <span style={{ fontWeight: 700 }}>{formatCurrency(v)}</span>
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => {
                            setSelectedWaybill(row);
                            setIsModalOpen(true);
                        }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer' }}
                        title="View"
                    >
                        <Eye size={14} />
                    </button>
                </div>
            )
        }
    ];

    const stats = {
        total: waybills.length,
        totalValue: waybills.reduce((sum, w) => sum + Number(w.grand_total || 0), 0)
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Van Waybills"
                subtitle="Generate and track stock-loading waybills for van sales routes"
                breadcrumbs={[{ label: 'Sales', href: '/sales/invoices' }, { label: 'Waybills' }]}
                actions={
                    <button
                        onClick={() => {
                            setSelectedWaybill(null);
                            setIsModalOpen(true);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> Generate Waybill
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Waybills" value={stats.total} icon={<FileText size={20} />} color="blue" />
                <StatCard title="Total Van Value" value={formatCurrency(stats.totalValue)} icon={<Plus size={20} />} color="green" />
            </div>

            <DataTable
                columns={columns}
                data={waybills}
                loading={loading}
                searchPlaceholder="Search waybills..."
            />

            <WaybillModal 
                isOpen={isModalOpen} 
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedWaybill(null);
                }} 
                record={selectedWaybill}
            />
        </div>
    );
}
