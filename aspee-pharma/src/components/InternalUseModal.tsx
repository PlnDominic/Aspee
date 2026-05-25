'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Package, MapPin, Hash, Calendar, FileText, Save, ChevronDown, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const PURPOSES = ['Office Use', 'Testing / Sampling', 'Staff Consumption', 'Company Promotion', 'Research & Development', 'Other'];

interface Product { id: string; name: string; sku: string; unit: string; }
interface Location { id: string; name: string; type: string; }

interface InternalUseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'view';
}

export default function InternalUseModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: InternalUseModalProps) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [stockAvailable, setStockAvailable] = useState<number | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [productDropdownOpen, setProductDropdownOpen] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    const isView = mode === 'view';

    const [refNumber, setRefNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [purpose, setPurpose] = useState('Office Use');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchDropdowns();
            if (initialData) {
                setRefNumber(initialData.reference_number || '');
                setDate(initialData.date || new Date().toISOString().split('T')[0]);
                setProductId(initialData.product_id || '');
                setLocationId(initialData.location_id || '');
                setQuantity(String(initialData.quantity || ''));
                setPurpose(initialData.purpose || 'Office Use');
                setNotes(initialData.notes || '');
            } else {
                resetForm();
                generateRefNumber();
            }
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (productId && locationId) fetchStock();
        else setStockAvailable(null);
    }, [productId, locationId]);

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

    const fetchStock = async () => {
        const { data } = await supabase
            .from('stock_levels')
            .select('qty_on_hand')
            .eq('product_id', productId)
            .eq('location_id', locationId);
        const total = (data || []).reduce((sum, r) => sum + Number(r.qty_on_hand || 0), 0);
        setStockAvailable(total);
    };

    const generateRefNumber = () => {
        const now = new Date();
        setRefNumber(`IU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`);
    };

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setProductId('');
        setLocationId('');
        setQuantity('');
        setPurpose('Office Use');
        setNotes('');
        setStockAvailable(null);
    };

    const handleSave = async () => {
        if (!productId || !locationId || !quantity || !purpose) {
            toast.error('Please fill in all required fields');
            return;
        }
        if (Number(quantity) <= 0) {
            toast.error('Quantity must be greater than zero');
            return;
        }
        if (stockAvailable !== null && Number(quantity) > stockAvailable) {
            toast.error(`Quantity exceeds available stock (${stockAvailable.toLocaleString()} units)`);
            return;
        }
        setLoading(true);
        try {
            await onSave({ reference_number: refNumber, date, product_id: productId, location_id: locationId, quantity: Number(quantity), purpose, notes });
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectedProduct = products.find(p => p.id === productId);
    const selectedLocation = locations.find(l => l.id === locationId);
    const filteredProducts = products.filter(p =>
        `${p.name} ${p.sku}`.toLowerCase().includes(productSearch.toLowerCase())
    );

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '9px 12px', borderRadius: 8,
        border: '1px solid var(--slate-200)', fontSize: 13,
        background: isView ? 'var(--slate-50)' : 'white',
        color: 'var(--slate-800)', outline: 'none', boxSizing: 'border-box',
    };
    const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', marginBottom: 4, display: 'block' };
    const fieldStyle: React.CSSProperties = { marginBottom: 16 };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isView ? `Internal Use — ${initialData?.reference_number}` : 'Log Internal Use'}
            subtitle="Record stock consumed for internal company purposes"
            width={560}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}><Hash size={11} style={{ marginRight: 4 }} />Reference No.</label>
                    <input style={inputStyle} value={refNumber} readOnly />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}><Calendar size={11} style={{ marginRight: 4 }} />Date</label>
                    <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} readOnly={isView} />
                </div>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><Package size={11} style={{ marginRight: 4 }} />Product *</label>
                {isView ? (
                    <input style={inputStyle} value={`${initialData?.product?.name || ''} (${initialData?.product?.sku || ''})`} readOnly />
                ) : (
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
                )}
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><MapPin size={11} style={{ marginRight: 4 }} />Deduct from Location *</label>
                {isView ? (
                    <input style={inputStyle} value={initialData?.location?.name || ''} readOnly />
                ) : (
                    <select style={inputStyle} value={locationId} onChange={e => setLocationId(e.target.value)}>
                        <option value="">— Select location —</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                )}
                {stockAvailable !== null && !isView && (
                    <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4, margin: '4px 0 0' }}>
                        Available stock: <strong>{stockAvailable.toLocaleString()}</strong> {selectedProduct?.unit}
                    </p>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Quantity ({selectedProduct?.unit || 'units'}) *</label>
                    <input
                        type="number" min="0.001" step="0.001"
                        style={inputStyle} value={quantity}
                        onChange={e => setQuantity(e.target.value)} readOnly={isView}
                        placeholder="0"
                    />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Purpose *</label>
                    {isView ? (
                        <input style={inputStyle} value={purpose} readOnly />
                    ) : (
                        <select style={inputStyle} value={purpose} onChange={e => setPurpose(e.target.value)}>
                            {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><FileText size={11} style={{ marginRight: 4 }} />Notes / Remarks</label>
                <textarea
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                    value={notes} onChange={e => setNotes(e.target.value)} readOnly={isView}
                    placeholder="Additional notes..."
                />
            </div>

            {!isView && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'white', fontSize: 13, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                    >
                        <Save size={14} /> {loading ? 'Saving...' : 'Log Internal Use'}
                    </button>
                </div>
            )}
        </Modal>
    );
}
