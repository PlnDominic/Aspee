'use client';

import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { Package, MapPin, Hash, Calendar, FileText, Save, ChevronDown, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Product { id: string; name: string; sku: string; unit: string; }
interface Location { id: string; name: string; type: string; }

interface OpeningStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        product_id: string;
        location_id: string;
        batch_number: string;
        expiry_date: string | null;
        counted_qty: number;
        notes: string;
    }) => Promise<void>;
}

export default function OpeningStockModal({ isOpen, onClose, onSave }: OpeningStockModalProps) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [recordedQty, setRecordedQty] = useState<number | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [productDropdownOpen, setProductDropdownOpen] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [countedQty, setCountedQty] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchDropdowns();
            resetForm();
        }
    }, [isOpen]);

    useEffect(() => {
        if (productId && locationId) fetchRecordedStock();
        else setRecordedQty(null);
    }, [productId, locationId, batchNumber]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
                setProductDropdownOpen(false);
            }
        };
        if (productDropdownOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [productDropdownOpen]);

    const fetchDropdowns = async () => {
        const [prodRes, locRes] = await Promise.all([
            supabase.from('products').select('id, name, sku, unit').order('name'),
            supabase.from('stock_locations').select('id, name, type').order('name'),
        ]);
        if (!prodRes.error) setProducts(prodRes.data || []);
        if (!locRes.error) setLocations(locRes.data || []);
    };

    const fetchRecordedStock = async () => {
        const { data } = await supabase
            .from('stock_levels')
            .select('qty_on_hand')
            .eq('product_id', productId)
            .eq('location_id', locationId)
            .eq('batch_number', batchNumber.trim() || 'N/A')
            .maybeSingle();
        setRecordedQty(Number(data?.qty_on_hand || 0));
    };

    const resetForm = () => {
        setProductId('');
        setLocationId('');
        setBatchNumber('');
        setExpiryDate('');
        setCountedQty('');
        setNotes('');
        setRecordedQty(null);
        setProductSearch('');
    };

    const handleSave = async () => {
        if (!productId || !locationId || countedQty === '') {
            toast.error('Please select a product, location, and enter the counted quantity');
            return;
        }
        if (Number(countedQty) < 0) {
            toast.error('Quantity cannot be negative');
            return;
        }
        setLoading(true);
        try {
            await onSave({
                product_id: productId,
                location_id: locationId,
                batch_number: batchNumber.trim() || 'N/A',
                expiry_date: expiryDate || null,
                counted_qty: Number(countedQty),
                notes: notes.trim(),
            });
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectedProduct = products.find(p => p.id === productId);
    const filteredProducts = products.filter(p =>
        `${p.name} ${p.sku}`.toLowerCase().includes(productSearch.toLowerCase())
    );

    const delta = recordedQty !== null && countedQty !== '' ? Number(countedQty) - recordedQty : null;

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '9px 12px', borderRadius: 8,
        border: '1px solid var(--slate-200)', fontSize: 13,
        background: 'white', color: 'var(--slate-800)', outline: 'none', boxSizing: 'border-box',
    };
    const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', marginBottom: 4, display: 'block' };
    const fieldStyle: React.CSSProperties = { marginBottom: 16 };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Enter Opening Stock"
            subtitle="One-time entry of stock already physically on hand — not for regular stock movements"
            width={560}
        >
            <div style={{
                display: 'flex', gap: 10, padding: '10px 14px', marginBottom: 18,
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            }}>
                <AlertTriangle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11.5, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    Use this only to record stock that is already physically in the warehouse
                    (e.g. before go-live, or after a physical count). It sets the exact quantity
                    on hand for the product/location/batch you choose. For all normal stock
                    changes, go back to the standard workflow — GRN, Sales, Transfers or Internal Use.
                </p>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><Package size={11} style={{ marginRight: 4 }} />Product *</label>
                <div ref={productDropdownRef} style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => { setProductDropdownOpen(v => !v); setProductSearch(''); }}
                        style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <span style={{ color: selectedProduct ? 'var(--slate-800)' : 'var(--slate-400)' }}>
                            {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : '— Select product —'}
                        </span>
                        <ChevronDown size={14} style={{ color: 'var(--slate-400)', flexShrink: 0, transform: productDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    {productDropdownOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                            background: 'white', border: '1px solid var(--slate-200)', borderRadius: 8,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden',
                        }}>
                            <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--slate-100)', position: 'relative' }}>
                                <Search size={13} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search products…"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    style={{ ...inputStyle, paddingLeft: 32, background: 'var(--slate-50)' }}
                                />
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                {filteredProducts.length === 0 ? (
                                    <div style={{ padding: '12px 16px', color: 'var(--slate-400)', fontSize: 13 }}>No products found</div>
                                ) : filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => { setProductId(p.id); setProductDropdownOpen(false); setProductSearch(''); }}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '9px 16px', fontSize: 13, cursor: 'pointer',
                                            background: p.id === productId ? 'var(--primary-50, #eff6ff)' : 'white',
                                            color: p.id === productId ? 'var(--primary-700, #1d4ed8)' : 'var(--slate-800)',
                                            border: 'none', borderBottom: '1px solid var(--slate-50)',
                                            fontWeight: p.id === productId ? 600 : 400,
                                        }}
                                    >
                                        {p.name} ({p.sku})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><MapPin size={11} style={{ marginRight: 4 }} />Location *</label>
                <select style={inputStyle} value={locationId} onChange={e => setLocationId(e.target.value)}>
                    <option value="">— Select location —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}><Hash size={11} style={{ marginRight: 4 }} />Batch Number</label>
                    <input style={inputStyle} value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="N/A" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}><Calendar size={11} style={{ marginRight: 4 }} />Expiry Date</label>
                    <input type="date" style={inputStyle} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}>Physical Count — Quantity on Hand ({selectedProduct?.unit || 'units'}) *</label>
                <input
                    type="number" min="0" step="0.001"
                    style={inputStyle} value={countedQty}
                    onChange={e => setCountedQty(e.target.value)}
                    placeholder="0"
                />
                {recordedQty !== null && productId && locationId && (
                    <p style={{ fontSize: 11, color: 'var(--slate-500)', margin: '4px 0 0' }}>
                        Currently recorded: <strong>{recordedQty.toLocaleString()}</strong> {selectedProduct?.unit}
                        {delta !== null && delta !== 0 && (
                            <span style={{ color: delta > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                {' '}({delta > 0 ? '+' : ''}{delta.toLocaleString()})
                            </span>
                        )}
                    </p>
                )}
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><FileText size={11} style={{ marginRight: 4 }} />Reason / Notes</label>
                <textarea
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Opening stock before go-live, year-end physical count..."
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'white', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #b45309, #d97706)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                    <Save size={14} /> {loading ? 'Saving...' : 'Set Opening Stock'}
                </button>
            </div>
        </Modal>
    );
}
