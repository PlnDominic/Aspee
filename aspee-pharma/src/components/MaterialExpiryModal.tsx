'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Package, MapPin, Hash, Calendar, FileText, Save, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const DISPOSAL_METHODS = ['Destroyed / Incinerated', 'Returned to Supplier', 'Quarantined', 'Donated', 'Disposed via Licensed Waste Handler'];

interface Product { id: string; name: string; sku: string; unit: string; }
interface Location { id: string; name: string; type: string; }

interface MaterialExpiryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'view';
}

export default function MaterialExpiryModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: MaterialExpiryModalProps) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [stockAvailable, setStockAvailable] = useState<number | null>(null);

    const isView = mode === 'view';

    const [refNumber, setRefNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [disposalMethod, setDisposalMethod] = useState('Destroyed / Incinerated');
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
                setBatchNumber(initialData.batch_number || '');
                setExpiryDate(initialData.expiry_date || '');
                setDisposalMethod(initialData.disposal_method || 'Destroyed / Incinerated');
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
        setRefNumber(`EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`);
    };

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setProductId('');
        setLocationId('');
        setQuantity('');
        setBatchNumber('');
        setExpiryDate('');
        setDisposalMethod('Destroyed / Incinerated');
        setNotes('');
        setStockAvailable(null);
    };

    const handleSave = async () => {
        if (!productId || !locationId || !quantity || !disposalMethod) {
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
            await onSave({
                reference_number: refNumber, date, product_id: productId, location_id: locationId,
                quantity: Number(quantity), batch_number: batchNumber || null,
                expiry_date: expiryDate || null, disposal_method: disposalMethod, notes,
            });
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectedProduct = products.find(p => p.id === productId);

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
            title={isView ? `Material Expiry — ${initialData?.reference_number}` : 'Log Material Expiry'}
            subtitle="Record expired materials and capture disposal information"
            width={560}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}><Hash size={11} style={{ marginRight: 4 }} />Reference No.</label>
                    <input style={inputStyle} value={refNumber} readOnly />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}><Calendar size={11} style={{ marginRight: 4 }} />Record Date</label>
                    <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} readOnly={isView} />
                </div>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><Package size={11} style={{ marginRight: 4 }} />Product *</label>
                {isView ? (
                    <input style={inputStyle} value={`${initialData?.product?.name || ''} (${initialData?.product?.sku || ''})`} readOnly />
                ) : (
                    <select style={inputStyle} value={productId} onChange={e => setProductId(e.target.value)}>
                        <option value="">— Select product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
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
                    <label style={labelStyle}><Clock size={11} style={{ marginRight: 4 }} />Expiry Date</label>
                    <input type="date" style={inputStyle} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} readOnly={isView} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Batch Number</label>
                    <input
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                        value={batchNumber} onChange={e => setBatchNumber(e.target.value)}
                        readOnly={isView} placeholder="e.g. BATCH-2024-001"
                    />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Disposal Method *</label>
                    {isView ? (
                        <input style={inputStyle} value={disposalMethod} readOnly />
                    ) : (
                        <select style={inputStyle} value={disposalMethod} onChange={e => setDisposalMethod(e.target.value)}>
                            {DISPOSAL_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}><FileText size={11} style={{ marginRight: 4 }} />Notes / Remarks</label>
                <textarea
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                    value={notes} onChange={e => setNotes(e.target.value)} readOnly={isView}
                    placeholder="Additional notes about the expiry or disposal..."
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
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #b45309, #d97706)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                    >
                        <Save size={14} /> {loading ? 'Saving...' : 'Log Expiry'}
                    </button>
                </div>
            )}
        </Modal>
    );
}
