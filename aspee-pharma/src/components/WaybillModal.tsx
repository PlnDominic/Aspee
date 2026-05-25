'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Modal from './Modal';
import PrintableWaybill, { WaybillItem, WaybillData } from './PrintableWaybill';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    Printer, Download, ArrowLeft, Truck, User, Calendar,
    Hash, MapPin, Package, Eye, ChevronRight,
} from 'lucide-react';
import { reconcileVanStockFromWaybills } from '@/lib/vanStock';

interface WaybillModalProps {
    isOpen: boolean;
    onClose: () => void;
    record?: any;
}

interface LineItem {
    product_id: string;
    product_name: string;
    unit_price: number;
    current_stock: number;
    qty_returned: string;
    qty_received_from_stores: string;
    units_per_carton: number;
    unit_label: string;
}

export default function WaybillModal({ isOpen, onClose, record }: WaybillModalProps) {
    const [vans, setVans] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const [waybillNumber, setWaybillNumber] = useState('');
    const [salesPersonName, setSalesPersonName] = useState('');
    const [vanId, setVanId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    const printRef = useRef<HTMLDivElement>(null);
    const isSalesRequestRecord = record?.source === 'sales_request';
    const isSavedWaybillRecord = !!record && !isSalesRequestRecord;

    useEffect(() => {
        if (isOpen) {
            if (record) {
                setWaybillNumber(record.waybill_number || '');
                setSalesPersonName(record.sales_person_name || '');
                setVanId(record.van_id || '');
                setDate(record.date || new Date().toISOString().split('T')[0]);
                setShowPreview(false);
                if (isSalesRequestRecord) {
                    fetchSalesRequestRecordData(record);
                } else {
                    fetchRecordData(record);
                }
            } else {
                const ts = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                setWaybillNumber(`WB-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${Math.floor(Math.random()*900+100)}`);
                setSalesPersonName('');
                setVanId('');
                setDate(new Date().toISOString().split('T')[0]);
                setShowPreview(false);
                fetchInitialData();
            }
        }
    }, [isOpen, record, isSalesRequestRecord]);

    const fetchSalesRequestRecordData = async (rec: any) => {
        setLoading(true);
        try {
            const { data: vansData, error: vansError } = await supabase
                .from('vans')
                .select('id, van_id, driver_name, plate_number, route_area')
                .neq('status', 'Maintenance')
                .order('van_id');

            if (vansError) throw vansError;

            setVans(vansData || []);

            const requestItems = rec.items || [];
            const productIds = requestItems.map((item: any) => item.product_id).filter(Boolean);
            const { data: productRows, error: productsError } = productIds.length
                ? await supabase.from('products').select('*').in('id', productIds)
                : { data: [], error: null };

            if (productsError) throw productsError;

            const productDetailsMap = new Map((productRows || []).map((product: any) => [product.id, product]));

            setLineItems(requestItems.map((item: any) => {
                const relation = Array.isArray(item.product) ? item.product[0] : item.product;
                const product = productDetailsMap.get(item.product_id) || relation;
                const approvedQty = Number(item.quantity_approved) || Number(item.quantity_requested) || 0;
                const price = Number(product?.cash_price ?? product?.unit_price ?? 0);

                return {
                    product_id: item.product_id,
                    product_name: product?.name || 'Unknown product',
                    unit_price: price,
                    current_stock: 0,
                    qty_returned: '',
                    qty_received_from_stores: approvedQty > 0 ? String(approvedQty) : '',
                    units_per_carton: product?.units_per_carton ?? 1,
                    unit_label: product?.unit_label ?? 'Units',
                };
            }));
        } catch (err: any) {
            console.error('Error fetching approved sales request waybill data:', err);
            toast.error('Failed to load approved request products: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecordData = async (rec: any) => {
        setLoading(true);
        try {
            const [vansRes, prodsRes, itemsRes] = await Promise.all([
                supabase.from('vans').select('id, van_id, driver_name, plate_number, route_area').neq('status', 'Maintenance').order('van_id'),
                supabase.from('products').select('*').eq('material_type', 'Finished Good').order('name'),
                supabase.from('waybill_items').select('*, product:products(*)').eq('waybill_id', rec.id).order('created_at', { ascending: true })
            ]);

            setVans(vansRes.data || []);
            const productsMap = new Map((prodsRes.data || []).map(p => [p.id, p]));
            const savedItems = itemsRes.data || [];
            const sourceRows = savedItems.length > 0 ? savedItems : (prodsRes.data || []).map(product => ({ product_id: product.id, product }));

            setLineItems(sourceRows.map(saved => {
                const relation = Array.isArray(saved.product) ? saved.product[0] : saved.product;
                const p = relation || productsMap.get(saved.product_id);
                const price = Number(p.cash_price ?? p.unit_price ?? 0);
                return {
                    product_id: saved.product_id,
                    product_name: p.name,
                    unit_price: price,
                    current_stock: saved?.current_stock || 0,
                    qty_returned: saved?.qty_returned != null ? String(saved.qty_returned) : '',
                    qty_received_from_stores: saved?.qty_received_from_stores != null ? String(saved.qty_received_from_stores) : '',
                    units_per_carton: p.units_per_carton ?? 1,
                    unit_label: p.unit_label ?? 'Units',
                };
            }));
        } catch (err) {
            console.error('Error fetching waybill record data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [vansRes, prodsRes] = await Promise.all([
                supabase.from('vans').select('id, van_id, driver_name, plate_number, route_area').neq('status', 'Maintenance').order('van_id'),
                // Waybills should only list finished goods for van loading.
                supabase.from('products').select('*').eq('material_type', 'Finished Good').order('name'),
            ]);

            if (vansRes.error) throw vansRes.error;
            if (prodsRes.error) throw prodsRes.error;

            setVans(vansRes.data || []);
            setLineItems((prodsRes.data || []).map(p => {
                const price = Number(p.cash_price ?? p.unit_price ?? 0);
                return {
                    product_id: p.id,
                    product_name: p.name,
                    unit_price: price,
                    current_stock: 0,
                    qty_returned: '',
                    qty_received_from_stores: '',
                    units_per_carton: p.units_per_carton ?? 1,
                    unit_label: p.unit_label ?? 'Units',
                };
            }));
        } catch (err: any) {
            console.error('Error fetching initial waybill data:', err);
            toast.error('Failed to load products or vans: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch stock levels when van changes
    useEffect(() => {
        if (vanId && !record) {
            fetchVanStock(vanId);
        } else if (!vanId) {
            // Reset current stock if no van selected
            setLineItems(prev => prev.map(item => ({
                ...item,
                current_stock: 0,
                qty_returned: '',
            })));
        }
    }, [vanId, record]);

    const fetchVanStock = async (vId: string) => {
        const { data: van } = await supabase.from('vans').select('van_id').eq('id', vId).single();
        if (!van) return;

        const locationName = `Sales Van - ${van.van_id}`;
        const { data: location } = await supabase.from('stock_locations').select('id').eq('name', locationName).maybeSingle();
        
        if (!location) {
            setLineItems(prev => prev.map(item => ({ ...item, current_stock: 0, qty_returned: '' })));
            return;
        }

        const { data: stock } = await supabase.from('stock_levels').select('product_id, qty_on_hand').eq('location_id', location.id);
        const stockMap = new Map((stock || []).map(s => [s.product_id, s.qty_on_hand]));

        setLineItems(prev => prev.map(item => {
            const qty = stockMap.get(item.product_id) || 0;
            return {
                ...item,
                current_stock: qty,
                qty_returned: qty > 0 ? qty.toString() : '',
            };
        }));
    };

    const selectedVan = vans.find(v => v.id === vanId);

    const updateQty = (idx: number, field: 'qty_returned' | 'qty_received_from_stores', value: string) => {
        setLineItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const waybillItems: WaybillItem[] = useMemo(() =>
        lineItems.map(li => {
            const ret = li.qty_returned !== '' ? (parseInt(li.qty_returned) || 0) : null;
            const rec = li.qty_received_from_stores !== '' ? (parseInt(li.qty_received_from_stores) || 0) : null;
            const effectiveReturnedQty = ret != null ? ret : li.current_stock;

            // If returned/existing is left blank, fall back to the van's current stock.
            const total = effectiveReturnedQty + (rec || 0);
            const value = total > 0 && li.unit_price > 0 ? total * li.unit_price : null;

            return {
                product_name: li.product_name,
                current_stock: li.current_stock,
                qty_returned: effectiveReturnedQty > 0 ? effectiveReturnedQty : null,
                qty_received_from_stores: rec && rec > 0 ? rec : null,
                total_qty: total && total > 0 ? total : null,
                total_value: value,
                units_per_carton: li.units_per_carton,
                unit_label: li.unit_label,
            };
        }),
    [lineItems]);

    const grandTotal = useMemo(() =>
        waybillItems.reduce((sum, i) => sum + (i.total_value || 0), 0),
    [waybillItems]);

    const waybillData: WaybillData = {
        waybill_number: waybillNumber,
        sales_person_name: salesPersonName,
        driver_name: selectedVan?.driver_name || '',
        vehicle_no: selectedVan?.plate_number || '',
        route: selectedVan
            ? `${selectedVan.van_id}${selectedVan.route_area ? ` (${selectedVan.route_area})` : ''}`
            : '',
        date,
        items: waybillItems,
        grand_total: grandTotal,
    };

    const handleSave = async () => {
        if (!salesPersonName.trim()) return toast.error('Please enter the sales person name');
        if (!vanId) return toast.error('Please select a van / driver');
        
        const activeItems = lineItems.filter(l => l.qty_returned !== '' || l.qty_received_from_stores !== '' || l.current_stock > 0);
        if (activeItems.length === 0) return toast.error('Please enter quantities for at least one product');

        setLoading(true);
        try {
            let waybillId = isSavedWaybillRecord ? record?.id : null;

            if (isSavedWaybillRecord) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('waybills')
                    .update({
                        sales_person_name: salesPersonName,
                        van_id: vanId,
                        date: date,
                        grand_total: grandTotal
                    })
                    .eq('id', record.id);
                
                if (updateError) throw updateError;

                // Delete old items
                const { error: deleteError } = await supabase
                    .from('waybill_items')
                    .delete()
                    .eq('waybill_id', record.id);
                
                if (deleteError) throw deleteError;
            } else {
                // Insert New Waybill Header
                const { data: waybill, error: waybillError } = await supabase
                    .from('waybills')
                    .insert([{
                        waybill_number: waybillNumber,
                        sales_person_name: salesPersonName,
                        van_id: vanId,
                        date: date,
                        grand_total: grandTotal
                    }])
                    .select()
                    .single();

                if (waybillError) throw waybillError;
                waybillId = waybill.id;
            }

            // 2. Insert Waybill Items
            const itemsToInsert = activeItems.map(item => {
                const wi = waybillItems.find(w => w.product_name === item.product_name);
                return {
                    waybill_id: waybillId,
                    product_id: item.product_id,
                    current_stock: item.current_stock,
                    qty_returned: wi?.qty_returned || 0,
                    qty_received_from_stores: parseInt(item.qty_received_from_stores) || 0,
                    total_qty: wi?.total_qty || 0,
                    total_value: wi?.total_value || 0
                };
            });

            const { error: itemsError } = await supabase
                .from('waybill_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
            await reconcileVanStockFromWaybills(vanId, activeItems.map(item => item.product_id));

            toast.success(isSavedWaybillRecord ? 'Waybill updated successfully!' : 'Waybill saved successfully!');
            onClose();
            // Refresh parent
            window.location.reload(); 
        } catch (err: any) {
            console.error('Error saving waybill:', err);
            toast.error('Failed to save waybill: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = () => {
        if (!salesPersonName.trim()) return toast.error('Please enter the sales person name');
        if (!vanId) return toast.error('Please select a van / driver');
        setShowPreview(true);
    };

    const openPrintWindow = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open('', '_blank', 'width=900,height=750');
        if (!printWindow) return toast.error('Allow pop-ups to print');
        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Waybill – ${waybillNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:white}
@media print{@page{size:A4;margin:0}body{padding:0}}
</style>
</head>
<body>${content.innerHTML}</body>
</html>`);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    };

    const handleDownloadPDF = async () => {
        const content = printRef.current;
        if (!content) return;
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `${waybillNumber}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(content)
                .save();
            toast.success('PDF downloaded');
        } catch {
            toast.error('PDF generation failed — use Print instead');
        }
    };

    const activeCount = lineItems.filter(l => l.qty_returned !== '' || l.qty_received_from_stores !== '' || l.current_stock > 0).length;

    // ── PREVIEW MODE ────────────────────────────────────────────────────────────
    if (showPreview) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Waybill Preview" subtitle={waybillNumber} width={900} noPadding>
                <div style={{ background: '#f1f5f9', minHeight: '100%' }}>
                    {/* Action Bar */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 24px', background: 'white', borderBottom: '1px solid #e2e8f0',
                    }}>
                        <button
                            onClick={() => setShowPreview(false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                        >
                            <ArrowLeft size={15} /> Back to Form
                        </button>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--primary-600, #2563eb)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                            >
                                <Package size={14} /> {loading ? 'Saving...' : 'Save Waybill'}
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#0f172a', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                                <Download size={14} /> Download PDF
                            </button>
                            <button
                                onClick={openPrintWindow}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#0f172a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                                <Printer size={14} /> Print
                            </button>
                        </div>
                    </div>

                    {/* A4 Preview */}
                    <div style={{ padding: 24, display: 'flex', justifyContent: 'center', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
                        <div style={{
                            width: '210mm', minHeight: '297mm', background: 'white',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        }}>
                            <PrintableWaybill waybill={waybillData} innerRef={printRef} />
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    // ── FORM MODE ────────────────────────────────────────────────────────────────
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={record ? `Waybill ${record.waybill_number}` : 'Generate Waybill'} subtitle={record ? 'Review pre-filled details, then preview or save' : 'Sales & Marketing Department'} width={960} noPadding>
            <form onSubmit={e => { e.preventDefault(); handlePreview(); }}>

                {/* ── Section 1: Waybill Info ── */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--slate-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-50,#eff6ff)', color: 'var(--primary-600,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Hash size={14} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)' }}>Waybill Information</div>
                            <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>Trip details for the van route</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                        {/* Waybill Number */}
                        <div>
                            <label style={labelStyle}>Waybill Number</label>
                            <div style={inputWrap}>
                                <Hash size={13} style={iconStyle} />
                                <input value={waybillNumber} readOnly style={{ ...inputStyle, background: 'var(--slate-50)', color: 'var(--slate-400)' }} />
                            </div>
                        </div>

                        {/* Date */}
                        <div>
                            <label style={labelStyle}>Date *</label>
                            <div style={inputWrap}>
                                <Calendar size={13} style={iconStyle} />
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} required />
                            </div>
                        </div>

                        {/* Sales Person */}
                        <div>
                            <label style={labelStyle}>Sales Person *</label>
                            <div style={inputWrap}>
                                <User size={13} style={iconStyle} />
                                <input
                                    value={salesPersonName}
                                    onChange={e => setSalesPersonName(e.target.value.toUpperCase())}
                                    placeholder="e.g. HALIMA"
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>

                        {/* Van Selector — full width */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>Select Van / Driver *</label>
                            <div style={inputWrap}>
                                <Truck size={13} style={iconStyle} />
                                <select value={vanId} onChange={e => setVanId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' } as React.CSSProperties} required>
                                    <option value="">Choose a van…</option>
                                    {vans.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.van_id} — {v.driver_name} ({v.plate_number}){v.route_area ? ` — ${v.route_area}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Van Preview Card */}
                    {selectedVan && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14, marginTop: 14,
                            padding: '12px 16px', background: 'linear-gradient(135deg,#eff6ff,#f0f9ff)',
                            border: '1.5px solid #dbeafe', borderRadius: 10,
                        }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Truck size={18} />
                            </div>
                            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                                {[
                                    ['Driver', selectedVan.driver_name],
                                    ['Van ID', selectedVan.van_id],
                                    ['Plate', selectedVan.plate_number],
                                    ['Route Area', selectedVan.route_area || '—'],
                                ].map(([label, val]) => (
                                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 10, fontWeight: 500, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Section 2: Product Quantities ── */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--slate-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-50,#eff6ff)', color: 'var(--primary-600,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)' }}>Product Quantities</div>
                            <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>Current stock is pre-filled. Add new stock being loaded from stores.</div>
                        </div>
                        {activeCount > 0 && (
                            <div style={{ padding: '4px 12px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                                {activeCount} product{activeCount !== 1 ? 's' : ''} active
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-400)', fontSize: 13 }}>
                            Loading products…
                        </div>
                    ) : (
                        <div style={{ border: '1.5px solid var(--slate-200)', borderRadius: 10, maxHeight: 400, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={colH}>#</th>
                                        <th style={{ ...colH, textAlign: 'left' }}>Product</th>
                                        <th style={{ ...colH, width: 90 }}>Curr. Stock</th>
                                        <th style={{ ...colH, width: 120 }}>Qty Returned / Existing</th>
                                        <th style={{ ...colH, width: 130 }}>Load New Stock</th>
                                        <th style={{ ...colH, width: 90 }}>Total Qty</th>
                                        <th style={{ ...colH, width: 110 }}>Sub-units</th>
                                        <th style={{ ...colH, width: 110 }}>Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, idx) => {
                                        const wi = waybillItems[idx];
                                        const hasData = item.qty_returned !== '' || item.qty_received_from_stores !== '' || item.current_stock > 0;
                                        return (
                                            <tr
                                                key={item.product_id}
                                                style={{
                                                    borderBottom: '1px solid #f1f5f9',
                                                    background: hasData ? '#f0fdf4' : idx % 2 === 0 ? 'white' : '#fafafa',
                                                }}
                                            >
                                                <td style={colD}>{idx + 1}</td>
                                                <td style={{ ...colD, textAlign: 'left', fontWeight: hasData ? 600 : 400 }}>{item.product_name}</td>
                                                <td style={{ ...colD, color: item.current_stock > 0 ? '#1e293b' : '#94a3b8', fontWeight: item.current_stock > 0 ? 600 : 400 }}>
                                                    {item.current_stock}
                                                </td>
                                                <td style={colD}>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        className="no-spinner"
                                                        value={item.qty_returned}
                                                        onChange={e => updateQty(idx, 'qty_returned', e.target.value)}
                                                        placeholder="0"
                                                        style={qtyInput}
                                                    />
                                                </td>
                                                <td style={colD}>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        className="no-spinner"
                                                        value={item.qty_received_from_stores}
                                                        onChange={e => updateQty(idx, 'qty_received_from_stores', e.target.value)}
                                                        placeholder="0"
                                                        style={{ ...qtyInput, border: '1.5px solid #93c5fd', background: '#f0f9ff' }}
                                                    />
                                                </td>
                                                <td style={{ ...colD, fontWeight: 700, color: wi.total_qty ? '#0f172a' : '#cbd5e1' }}>
                                                    {wi.total_qty ?? '—'}
                                                </td>
                                                <td style={{ ...colD, fontSize: 10, color: wi.total_qty ? '#7c3aed' : '#cbd5e1', fontWeight: wi.total_qty ? 600 : 400 }}>
                                                    {wi.total_qty && item.units_per_carton > 1
                                                        ? `${wi.total_qty * item.units_per_carton} ${item.unit_label}`
                                                        : '—'}
                                                </td>
                                                <td style={{ ...colD, fontWeight: 700, color: wi.total_value ? '#166534' : '#cbd5e1', fontFamily: 'monospace' }}>
                                                    {wi.total_value != null
                                                        ? wi.total_value.toLocaleString('en-GH', { minimumFractionDigits: 2 })
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Grand Total */}
                    {grandTotal > 0 && (
                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                            gap: 16, marginTop: 12, padding: '10px 16px',
                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Grand Total (Van Value)</span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                                GH₵ {grandTotal.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    gap: 10, padding: '16px 28px', background: 'var(--slate-50)',
                    borderTop: '1.5px solid var(--slate-200)',
                }}>
                    <button
                        type="button" onClick={onClose}
                        style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 22px', border: '1.5px solid var(--primary-200, #bfdbfe)', borderRadius: 8,
                            background: 'white',
                            color: 'var(--primary-700, #1d4ed8)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        <Package size={15} /> {loading ? 'Saving...' : 'Save only'}
                    </button>
                    <button
                        type="submit"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 22px', border: 'none', borderRadius: 8,
                            background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                            color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        <Eye size={15} /> Preview Waybill <ChevronRight size={14} />
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ── Shared inline styles ──────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--slate-500,#64748b)', marginBottom: 6, letterSpacing: '0.01em',
};
const inputWrap: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center' };
const iconStyle: React.CSSProperties = { position: 'absolute', left: 12, color: '#94a3b8', pointerEvents: 'none' };
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px 9px 36px',
    border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 12, color: '#1e293b', background: 'white', outline: 'none',
};
const colH: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700,
    color: '#475569', borderBottom: '1.5px solid #e2e8f0',
};
const colD: React.CSSProperties = {
    padding: '7px 12px', textAlign: 'center', fontSize: 11, verticalAlign: 'middle',
};
const qtyInput: React.CSSProperties = {
    width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0',
    borderRadius: 6, fontSize: 12, textAlign: 'center', outline: 'none',
    fontFamily: 'monospace', background: 'white', color: '#1e293b',
    /* hide spinner arrows */
    MozAppearance: 'textfield',
} as React.CSSProperties;
