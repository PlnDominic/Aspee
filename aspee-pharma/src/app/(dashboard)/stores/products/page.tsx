'use client';

import React from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import ProductModal from '@/components/ProductModal';
import MaterialRequestModal from '@/components/MaterialRequestModal';
import { Plus, Package, Clock, Boxes, Edit2, Trash2, ClipboardList, Beaker, Factory, PencilRuler, Layers3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLog';

type MaterialType =
    | 'Raw Material'
    | 'Packaging Material'
    | 'Finished Good'
    | 'Lab Consumables'
    | 'Factory Consumables'
    | 'Stationery & Printing Accessories'
    | 'General Consumables';

type SectionConfig = {
    key: MaterialType;
    title: string;
    icon: React.ReactNode;
    searchPlaceholder: string;
    accent: string;
    tint: string;
};

const sectionConfigs: SectionConfig[] = [
    {
        key: 'Raw Material',
        title: 'Raw Materials',
        icon: <Boxes size={18} />,
        searchPlaceholder: 'Search raw materials...',
        accent: 'var(--accent-600)',
        tint: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(6,182,212,0.04))',
    },
    {
        key: 'Packaging Material',
        title: 'Packaging Materials',
        icon: <Package size={18} />,
        searchPlaceholder: 'Search packaging materials...',
        accent: 'var(--warning)',
        tint: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.04))',
    },
    {
        key: 'Lab Consumables',
        title: 'Lab Consumables',
        icon: <Beaker size={18} />,
        searchPlaceholder: 'Search lab consumables...',
        accent: '#8b5cf6',
        tint: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(168,85,247,0.04))',
    },
    {
        key: 'Factory Consumables',
        title: 'Factory Consumables',
        icon: <Factory size={18} />,
        searchPlaceholder: 'Search factory consumables...',
        accent: '#ef4444',
        tint: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(248,113,113,0.04))',
    },
    {
        key: 'Stationery & Printing Accessories',
        title: 'Stationery & Printing Accessories',
        icon: <PencilRuler size={18} />,
        searchPlaceholder: 'Search stationery and printing items...',
        accent: '#22c55e',
        tint: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(74,222,128,0.04))',
    },
    {
        key: 'General Consumables',
        title: 'General Consumables',
        icon: <Layers3 size={18} />,
        searchPlaceholder: 'Search general consumables...',
        accent: 'var(--slate-500)',
        tint: 'linear-gradient(135deg, rgba(100,116,139,0.12), rgba(148,163,184,0.04))',
    },
    {
        key: 'Finished Good',
        title: 'Finished Goods',
        icon: <Clock size={18} />,
        searchPlaceholder: 'Search finished goods...',
        accent: 'var(--primary-600)',
        tint: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(34,211,238,0.04))',
    },
];

const sectionStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    borderRadius: 18,
    border: '1px solid var(--slate-200)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
};

export default function ProductsPage() {
    const queryClient = useQueryClient();
    const { data: products = [], isLoading: loading } = useFetch<any[]>(
        ['products-with-qa'],
        async () => {
            const [prodRes, qaRes] = await Promise.all([
                supabase.from('products').select('*').order('name'),
                supabase.from('grn_items').select('product_id, quantity_received').eq('qa_status', 'Approved'),
            ]);

            if (prodRes.error) throw prodRes.error;
            if (qaRes.error) throw qaRes.error;

            const qaItems = qaRes.data || [];
            const approvedMap: Record<string, number> = {};
            for (const item of qaItems) {
                approvedMap[item.product_id] = (approvedMap[item.product_id] || 0) + (item.quantity_received || 0);
            }

            return {
                data: (prodRes.data || []).map((p: any) => ({
                    ...p,
                    approved_qty: approvedMap[p.id] || 0
                })),
                error: null
            };
        }
    );

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);
    const [modalMode, setModalMode] = React.useState<'create' | 'edit'>('create');
    const [selectedProduct, setSelectedProduct] = React.useState<any>(null);

    const handleSaveProduct = async (productData: any) => {
        const { id, ...data } = productData;
        try {
            if (id) {
                const { error } = await supabase.from('products').update(data).eq('id', id);
                if (error) throw error;
                await logAudit({
                    action: 'UPDATE',
                    module: 'Products',
                    description: `Updated product: ${data.name || selectedProduct?.name}`,
                    record_id: id,
                    record_type: 'products',
                    old_values: selectedProduct,
                    new_values: data,
                });
                toast.success('Product updated successfully');
            } else {
                const { data: newRecord, error } = await supabase.from('products').insert([data]).select().single();
                if (error) throw error;
                await logAudit({
                    action: 'CREATE',
                    module: 'Products',
                    description: `Created new product: ${data.name}`,
                    record_id: newRecord?.id,
                    record_type: 'products',
                    new_values: data,
                });
                toast.success('Product added successfully');
            }
            queryClient.invalidateQueries({ queryKey: ['products-with-qa'] });
        } catch (error: any) {
            toast.error('Error saving product: ' + error.message);
            throw error;
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            const productToDelete = products.find((p) => p.id === id);
            const { data: deleted, error } = await supabase.from('products').delete().eq('id', id).select();
            if (error) throw error;
            if (!deleted || deleted.length === 0) {
                throw new Error('Delete was blocked by a database policy. Check Supabase RLS rules for the products table.');
            }
            await logAudit({
                action: 'DELETE',
                module: 'Products',
                description: `Deleted product: ${productToDelete?.name || id}`,
                record_id: id,
                record_type: 'products',
                old_values: productToDelete,
            });
            toast.success('Product deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['products'] });
        } catch (error: any) {
            toast.error('Error deleting product: ' + error.message);
        }
    };

    const columns = [
        {
            key: 'name',
            label: 'Product Name',
            wrap: true,
            width: '220px',
            render: (v: unknown) => <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{v as string}</span>,
        },
        {
            key: 'sku',
            label: 'SKU',
            render: (v: unknown) => (
                <span
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--slate-600)',
                        background: 'var(--slate-50)',
                        border: '1px solid var(--slate-200)',
                        padding: '4px 8px',
                        borderRadius: 999,
                    }}
                >
                    {v as string}
                </span>
            ),
        },
        {
            key: 'unit',
            label: 'Unit',
            render: (v: unknown) => (
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--slate-700)',
                        background: 'var(--slate-50)',
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--slate-200)',
                    }}
                >
                    {v as string}
                </span>
            ),
        },
        {
            key: 'approved_qty',
            label: 'Approved Qty',
            render: (v: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>
                        {(v as number).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--slate-400)', fontWeight: 500 }}>Quality Pass</span>
                </div>
            )
        },
        {
            key: 'reorder_level',
            label: 'Reorder Level',
            render: (v: unknown) => (
                <span style={{ fontWeight: 700, color: 'var(--slate-700)' }}>{v as number}</span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '140px',
            render: (_: unknown, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    {(row.material_type === 'Raw Material' || row.material_type === 'Packaging Material') && (
                        <button
                            onClick={() => {
                                setSelectedProduct(row);
                                setIsRequestModalOpen(true);
                            }}
                            style={actionButtonStyle('var(--warning-light)', '#b45309')}
                            title="Request materials"
                        >
                            <ClipboardList size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setModalMode('edit');
                            setSelectedProduct(row);
                            setIsModalOpen(true);
                        }}
                        style={actionButtonStyle('var(--primary-50)', 'var(--primary-600)')}
                        title="Edit product"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDeleteProduct(row.id)}
                        style={actionButtonStyle('var(--danger-light)', 'var(--danger)')}
                        title="Delete product"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ),
        },
    ];

    const stats = {
        total: products.length,
        raw: products.filter((p) => p.material_type === 'Raw Material').length,
        packaging: products.filter((p) => p.material_type === 'Packaging Material').length,
        lab: products.filter((p) => p.material_type === 'Lab Consumables').length,
        factory: products.filter((p) => p.material_type === 'Factory Consumables').length,
        stationery: products.filter((p) => p.material_type === 'Stationery & Printing Accessories').length,
        general: products.filter((p) => p.material_type === 'General Consumables').length,
        finished: products.filter((p) => p.material_type === 'Finished Good').length,
    };

    return (
        <div className="animate-fade-in products-page-root">
            <PageHeader
                title="Products"
                subtitle="Product master data and catalog management across all material categories"
                breadcrumbs={[
                    { label: 'Stores', href: '/stores/products' },
                    { label: 'Products' },
                ]}
                actions={
                    <button
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 18px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'white',
                            cursor: 'pointer',
                            boxShadow: '0 12px 24px rgba(6, 182, 212, 0.18)',
                        }}
                        onClick={() => {
                            setModalMode('create');
                            setSelectedProduct(null);
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={16} /> Add Product
                    </button>
                }
            />


            <div className="stats-grid animate-stagger" style={{ marginBottom: 24 }}>
                <StatCard title="Total Products" value={stats.total} icon={<Package size={20} />} color="blue" />
                <StatCard title="Raw Materials" value={stats.raw} icon={<Boxes size={20} />} color="teal" />
                <StatCard title="Packaging" value={stats.packaging} icon={<Package size={20} />} color="amber" />
                <StatCard title="Lab Consumables" value={stats.lab} icon={<Beaker size={20} />} color="purple" />
                <StatCard title="Factory Consumables" value={stats.factory} icon={<Factory size={20} />} color="red" />
                <StatCard title="Stationery/Printing" value={stats.stationery} icon={<PencilRuler size={20} />} color="green" />
                <StatCard title="General" value={stats.general} icon={<Layers3 size={20} />} color="blue" />
                <StatCard title="Finished Goods" value={stats.finished} icon={<Clock size={20} />} color="purple" />
            </div>

            <div className="products-grid">
                {sectionConfigs.slice(0, 6).map((section) => {
                    const sectionData = products.filter((p: any) => p.material_type === section.key);
                    return (
                        <section key={section.key} className="products-section" style={sectionStyle}>
                            <div className="section-header themed" style={{ background: section.tint }}>
                                <div className="section-title-wrap">
                                    <span className="section-icon" style={{ color: section.accent }}>{section.icon}</span>
                                    <div>
                                        <h3>{section.title}</h3>
                                        <p>{sectionData.length} item{sectionData.length === 1 ? '' : 's'} in this category</p>
                                    </div>
                                </div>
                                <span className="count" style={{ color: section.accent, borderColor: `${section.accent}33` }}>
                                    {sectionData.length}
                                </span>
                            </div>
                            <div className="section-table-wrap">
                                <DataTable
                                    columns={columns}
                                    data={sectionData}
                                    loading={loading}
                                    searchPlaceholder={section.searchPlaceholder}
                                />
                            </div>
                        </section>
                    );
                })}
            </div>

            <section className="products-section products-section-full" style={{ ...sectionStyle, marginTop: 24 }}>
                <div className="section-header themed" style={{ background: sectionConfigs[6].tint }}>
                    <div className="section-title-wrap">
                        <span className="section-icon" style={{ color: sectionConfigs[6].accent }}>{sectionConfigs[6].icon}</span>
                        <div>
                            <h3>{sectionConfigs[6].title}</h3>
                            <p>{stats.finished} item{stats.finished === 1 ? '' : 's'} ready for production and sales workflows</p>
                        </div>
                    </div>
                    <span className="count" style={{ color: sectionConfigs[6].accent, borderColor: `${sectionConfigs[6].accent}33` }}>
                        {stats.finished}
                    </span>
                </div>
                <div className="section-table-wrap">
                    <DataTable
                        columns={columns}
                        data={products.filter((p: any) => p.material_type === 'Finished Good')}
                        loading={loading}
                        searchPlaceholder={sectionConfigs[6].searchPlaceholder}
                    />
                </div>
            </section>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProduct}
                initialData={selectedProduct}
                mode={modalMode}
            />

            <MaterialRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                product={selectedProduct}
            />

            <style>{`
                .products-page-root {
                    color: var(--slate-900);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
                    gap: 16px;
                }


                .products-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 24px;
                }

                .products-section {
                    display: flex;
                    flex-direction: column;
                }

                .products-section-full {
                    grid-column: 1 / -1;
                }

                .section-header.themed {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 18px 20px;
                    border-bottom: 1px solid var(--slate-200);
                }

                .section-title-wrap {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }

                .section-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--card-bg);
                    border: 1px solid var(--slate-200);
                    box-shadow: var(--shadow-sm);
                    flex-shrink: 0;
                }

                .section-header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 800;
                    color: var(--slate-900);
                    letter-spacing: -0.01em;
                }

                .section-header p {
                    margin: 4px 0 0;
                    font-size: 11px;
                    color: var(--slate-500);
                }

                .section-header .count {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 36px;
                    height: 36px;
                    padding: 0 12px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 800;
                    background: var(--card-bg);
                    border: 1px solid var(--slate-200);
                    box-shadow: var(--shadow-sm);
                    flex-shrink: 0;
                }

                .section-table-wrap {
                    padding: 18px;
                    background: var(--card-bg);
                }

                .products-section :global(table) {
                    color: var(--slate-800);
                }

                @media (max-width: 1400px) {
                    .products-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 900px) {
                    .products-hero-card {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .products-hero-meta {
                        width: 100%;
                        text-align: left;
                    }
                }

                @media (max-width: 640px) {
                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .section-header.themed {
                        padding: 16px;
                    }

                    .section-table-wrap {
                        padding: 12px;
                    }
                }
            `}</style>
        </div>
    );
}

function actionButtonStyle(background: string, color: string): React.CSSProperties {
    return {
        border: 'none',
        background,
        color,
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
    };
}
