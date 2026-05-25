'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Package, Hash, Layers, AlertTriangle, FileText, RefreshCw, DollarSign, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { GROUPED_UNIT_OPTIONS } from '@/lib/constants';
import { bulkConversionLabel } from '@/lib/unitConversions';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit';
}

const MATERIAL_PREFIXES: Record<string, string> = {
    'Raw Material':                        'RM',
    'Packaging Material':                  'PM',
    'Finished Good':                       'FG',
    'Lab Consumables':                     'LC',
    'Factory Consumables':                 'FC',
    'Stationery & Printing Accessories':   'SP',
    'General Consumables':                 'GC',
};

function generateSku(materialType: string): string {
    const prefix = MATERIAL_PREFIXES[materialType] ?? 'PRD';
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${yy}${mm}${dd}-${rand}`;
}

export default function ProductModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: ProductModalProps) {
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [materialType, setMaterialType] = useState<string>('Raw Material');
    const [unit, setUnit] = useState('Pieces');
    const [reorderLevel, setReorderLevel] = useState(10);
    const [description, setDescription] = useState('');
    const [productCategory, setProductCategory] = useState('Other Products');
    const [cashPrice, setCashPrice] = useState<string>('');
    const [creditPrice, setCreditPrice] = useState<string>('');
    const [bulkUnit, setBulkUnit] = useState('');
    const [bulkToBaseRatio, setBulkToBaseRatio] = useState<string>('');
    const [purchaseUnit, setPurchaseUnit] = useState('Kilograms');
    const usesCrossUnitFlow = materialType === 'Raw Material' || materialType === 'Packaging Material';

    useEffect(() => {
        if (isOpen) {
            if (mode === 'create') {
                resetForm();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    // Re-generate SKU when material type changes in create mode
    useEffect(() => {
        if (mode === 'create' && isOpen) {
            setSku(generateSku(materialType));
        }
    }, [materialType, mode, isOpen]);

    const resetForm = () => {
        setName('');
        setSku(generateSku('Raw Material'));
        setMaterialType('Raw Material');
        setUnit('Pieces');
        setReorderLevel(10);
        setDescription('');
        setProductCategory('Other Products');
        setCashPrice('');
        setCreditPrice('');
        setBulkUnit('');
        setBulkToBaseRatio('');
        setPurchaseUnit('Kilograms');
    };

    const populateForm = (p: any) => {
        setName(p.name || '');
        setSku(p.sku || '');
        setMaterialType(p.material_type || 'Raw Material');
        setUnit(p.unit || 'Pieces');
        setReorderLevel(p.reorder_level || 10);
        setDescription(p.description || '');
        setProductCategory(p.product_category || 'Other Products');
        setCashPrice(p.cash_price != null ? String(p.cash_price) : '');
        setCreditPrice(p.credit_price != null ? String(p.credit_price) : '');
        setBulkUnit(p.bulk_unit || '');
        setBulkToBaseRatio(p.bulk_to_base_ratio != null ? String(p.bulk_to_base_ratio) : '');
        setPurchaseUnit(p.purchase_unit || 'Kilograms');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                name,
                sku,
                material_type: materialType,
                unit,
                reorder_level: reorderLevel,
                description,
                product_category: productCategory,
                cash_price: materialType === 'Finished Good' && cashPrice !== '' ? parseFloat(cashPrice) : null,
                credit_price: materialType === 'Finished Good' && creditPrice !== '' ? parseFloat(creditPrice) : null,
                bulk_unit: bulkUnit || null,
                bulk_to_base_ratio: bulkUnit && bulkToBaseRatio !== '' ? parseFloat(bulkToBaseRatio) : null,
                purchase_unit: usesCrossUnitFlow ? purchaseUnit : null,
                issue_unit: usesCrossUnitFlow ? unit : null,
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving product:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit Product' : 'Add New Product'}
            subtitle={mode === 'edit' ? 'Update product master data' : 'Register a new product in the system'}
        >
            <form onSubmit={handleSubmit} className="product-form">
                <div className="form-grid">
                    <div className="form-field full-width">
                        <label>Product Name *</label>
                        <div className="input-wrapper">
                            <Package size={16} className="icon" />
                            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter product name" />
                        </div>
                    </div>

                    {materialType === 'Finished Good' && (
                        <>
                            <div className="form-field">
                                <label>Official Cash Price (GHâ‚µ)</label>
                                <div className="input-wrapper">
                                    <DollarSign size={16} className="icon" />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={cashPrice}
                                        onChange={(e) => setCashPrice(e.target.value)}
                                        placeholder="Per bottle or skellet"
                                    />
                                </div>
                            </div>
                            <div className="form-field">
                                <label>Official Credit Price (GHâ‚µ)</label>
                                <div className="input-wrapper">
                                    <DollarSign size={16} className="icon" />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={creditPrice}
                                        onChange={(e) => setCreditPrice(e.target.value)}
                                        placeholder="Leave blank if not approved"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-field">
                        <label>SKU / Item Code *</label>
                        <div className="input-wrapper">
                            <Hash size={16} className="icon" />
                            <input
                                required
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                placeholder="Auto-generated"
                                style={{ paddingRight: mode === 'create' ? 38 : undefined }}
                            />
                            {mode === 'create' && (
                                <button
                                    type="button"
                                    onClick={() => setSku(generateSku(materialType))}
                                    title="Regenerate SKU"
                                    style={{
                                        position: 'absolute', right: 10,
                                        background: 'none', border: 'none',
                                        cursor: 'pointer', color: 'var(--slate-400)',
                                        display: 'flex', padding: 4, borderRadius: 4,
                                    }}
                                >
                                    <RefreshCw size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {materialType !== 'Finished Good' && <div className="form-field">
                        <label>Material Type *</label>
                        <div className="input-wrapper">
                            <Layers size={16} className="icon" />
                            <select required value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
                                <option value="Raw Material">Raw Material</option>
                                <option value="Packaging Material">Packaging Material</option>
                                <option value="Lab Consumables">Lab Consumables</option>
                                <option value="Factory Consumables">Factory Consumables</option>
                                <option value="Stationery & Printing Accessories">Stationery & Printing Accessories</option>
                                <option value="General Consumables">General Consumables</option>
                                <option value="Finished Good">Finished Good</option>
                            </select>
                        </div>
                    </div>}

                    <div className="form-field">
                        <label>Unit of Measure</label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" />
                            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                                {GROUPED_UNIT_OPTIONS.map((group) => (
                                    <optgroup key={group.label} label={group.label}>
                                        {group.units.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    {usesCrossUnitFlow && (
                        <div className="form-field">
                            <label>
                                Purchase Unit
                                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--slate-400)' }}> — unit on POs (converts to {unit} in stock)</span>
                            </label>
                            <div className="input-wrapper">
                                <FileText size={16} className="icon" />
                                <select value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)}>
                                    {GROUPED_UNIT_OPTIONS.map((group) => (
                                        <optgroup key={group.label} label={group.label}>
                                            {group.units.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {materialType !== 'Finished Good' && <div className="form-field">
                        <label>Bulk Unit <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--slate-400)' }}>— outer packaging (e.g. Carton)</span></label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" />
                            <select value={bulkUnit} onChange={(e) => setBulkUnit(e.target.value)}>
                                <option value="">None</option>
                                {GROUPED_UNIT_OPTIONS.map((group) => (
                                    <optgroup key={group.label} label={group.label}>
                                        {group.units.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>}

                    <div className="form-field">
                        <label>
                            Base Units per Bulk
                            {bulkUnit && unit && bulkToBaseRatio && (
                                <span style={{
                                    marginLeft: 8,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: 'var(--primary-600)',
                                    background: 'rgba(6,182,212,0.08)',
                                    border: '1px solid rgba(6,182,212,0.2)',
                                    borderRadius: 4,
                                    padding: '1px 6px',
                                }}>
                                    1 {bulkUnit} = {bulkToBaseRatio} {unit}
                                </span>
                            )}
                        </label>
                        <div className="input-wrapper">
                            <Hash size={16} className="icon" />
                            <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={bulkToBaseRatio}
                                onChange={(e) => setBulkToBaseRatio(e.target.value)}
                                placeholder={bulkUnit ? `e.g. 30 (1 ${bulkUnit} = 30 ${unit})` : 'Select bulk unit first'}
                                disabled={!bulkUnit}
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Reorder Level</label>
                        <div className="input-wrapper">
                            <AlertTriangle size={16} className="icon" />
                            <input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(parseInt(e.target.value))} />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Product Category</label>
                        <div className="input-wrapper">
                            <Tag size={16} className="icon" />
                            <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}>
                                <option value="Oral Liquid">Oral Liquid</option>
                                <option value="Oral Solid">Oral Solid</option>
                                <option value="Controlled Products">Controlled Products</option>
                                <option value="Other Products">Other Products</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-field full-width">
                        <label>Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional product description" rows={3} />
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? 'Saving...' : mode === 'edit' ? 'Update Product' : 'Add Product'}
                    </button>
                </div>
            </form>

            <style>{`
                .product-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .form-field.full-width {
                    grid-column: span 2;
                }
                .form-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-wrapper .icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                }
                .input-wrapper input, .input-wrapper select, textarea {
                    width: 100%;
                    padding: 9px 12px 9px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    background: var(--card-bg);
                    color: var(--slate-900);
                    outline: none;
                }
                textarea {
                    padding: 10px 12px;
                }
                .input-wrapper input:focus, .input-wrapper select:focus, textarea:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                }
                .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-primary {
                    padding: 10px 24px;
                    border-radius: 8px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
            `}</style>
        </Modal>
    );
}
