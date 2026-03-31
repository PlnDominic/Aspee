'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    Package,
    Plus,
    Trash2,
    Save,
    FileText,
    AlertCircle,
    Search,
    Calculator,
    ChevronDown,
    Copy
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UNIT_OPTIONS, GROUPED_UNIT_OPTIONS } from '@/lib/constants';
import UnitConversionHint from './UnitConversionHint';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
    material_type: string;
}

interface BOMItem {
    id?: string;
    bom_id?: string;
    component_id: string;
    component?: Product;
    quantity_required: number;
    unit: string;
    unit_ratio: number;
    unit_cost?: number;
    notes: string;
}

interface BOM {
    id?: string;
    name: string;
    finished_product_id: string;
    finished_product?: Product;
    version: string;
    is_active: boolean;
    notes: string;
    items: BOMItem[];
}

interface BOMModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BOM) => Promise<void>;
    initialData?: BOM | null;
    mode?: 'create' | 'edit' | 'view';
}

export default function BOMModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: BOMModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Products
    const [finishedGoods, setFinishedGoods] = useState<Product[]>([]);
    const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
    const [packagingMaterials, setPackagingMaterials] = useState<Product[]>([]);

    // Form state
    const [name, setName] = useState('');
    const [finishedProductId, setFinishedProductId] = useState('');
    const [selectedFinishedProduct, setSelectedFinishedProduct] = useState<Product | null>(null);
    const [version, setVersion] = useState('1.0');
    const [isActive, setIsActive] = useState(true);
    const [notes, setNotes] = useState('');
    const [rawItems, setRawItems] = useState<BOMItem[]>([]);
    const [packagingItems, setPackagingItems] = useState<BOMItem[]>([]);

    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            if (mode === 'create') {
                resetForm();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    const fetchProducts = async () => {
        setFetching(true);
        try {
            // Fetch finished goods
            const { data: finished, error: finishedError } = await supabase
                .from('products')
                .select('id, name, sku, unit, material_type')
                .eq('material_type', 'Finished Good')
                .order('name');

            if (finishedError) throw finishedError;
            setFinishedGoods(finished || []);

            // Fetch raw materials
            const { data: raw, error: rawError } = await supabase
                .from('products')
                .select('id, name, sku, unit, material_type')
                .eq('material_type', 'Raw Material')
                .order('name');

            if (rawError) throw rawError;
            setRawMaterials(raw || []);

            // Fetch packaging materials
            const { data: packaging, error: packagingError } = await supabase
                .from('products')
                .select('id, name, sku, unit, material_type')
                .eq('material_type', 'Packaging Material')
                .order('name');

            if (packagingError) throw packagingError;
            setPackagingMaterials(packaging || []);
        } catch (error: any) {
            toast.error('Failed to fetch products: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchBOMItems = async (bomId: string) => {
        try {
            const { data, error } = await supabase
                .from('bom_items')
                .select(`
                    *,
                    component:products(id, name, sku, unit, material_type)
                `)
                .eq('bom_id', bomId)
                .order('position');

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            console.error('Error fetching BOM items:', error);
            return [];
        }
    };

    const resetForm = () => {
        setName('');
        setFinishedProductId('');
        setSelectedFinishedProduct(null);
        setVersion('1.0');
        setIsActive(true);
        setNotes('');
        setRawItems([]);
        setPackagingItems([]);
        setSearchTerm('');
    };

    const populateForm = async (data: BOM) => {
        setName(data.name || '');
        setFinishedProductId(data.finished_product_id || '');
        setVersion(data.version || '1.0');
        setIsActive(data.is_active ?? true);
        setNotes(data.notes || '');

        // Find finished product
        const fp = finishedGoods.find(p => p.id === data.finished_product_id);
        setSelectedFinishedProduct(fp || null);

        // Fetch items and split by material_type
        if (data.id) {
            const bomItems = await fetchBOMItems(data.id);
            const raw: BOMItem[] = [];
            const packaging: BOMItem[] = [];
            bomItems.forEach((item: any) => {
                const enrichedItem = {
                    ...item,
                    unit: item.unit || item.component?.unit || 'Pieces'
                };
                if (item.component?.material_type === 'Packaging Material') {
                    packaging.push(enrichedItem);
                } else {
                    raw.push(enrichedItem);
                }
            });
            setRawItems(raw);
            setPackagingItems(packaging);
        } else {
            const raw: BOMItem[] = [];
            const packaging: BOMItem[] = [];
            (data.items || []).forEach((item: any) => {
                const enrichedItem = {
                    ...item,
                    unit: item.unit || item.component?.unit || 'Pieces'
                };
                if (item.component?.material_type === 'Packaging Material') {
                    packaging.push(enrichedItem);
                } else {
                    raw.push(enrichedItem);
                }
            });
            setRawItems(raw);
            setPackagingItems(packaging);
        }
    };

    const handleFinishedProductChange = (productId: string) => {
        setFinishedProductId(productId);
        const product = finishedGoods.find(p => p.id === productId);
        setSelectedFinishedProduct(product || null);

        // Auto-generate name if empty
        if (!name && product) {
            setName(`BOM for ${product.name}`);
        }
    };

    const addRawItem = () => {
        setRawItems([
            ...rawItems,
            {
                component_id: '',
                quantity_required: 0,
                unit: 'Pieces',
                unit_ratio: 1,
                notes: ''
            }
        ]);
    };

    const addPackagingItem = () => {
        setPackagingItems([
            ...packagingItems,
            {
                component_id: '',
                quantity_required: 0,
                unit: 'Pieces',
                unit_ratio: 1,
                notes: ''
            }
        ]);
    };

    const removeRawItem = (index: number) => {
        setRawItems(rawItems.filter((_, i) => i !== index));
    };

    const removePackagingItem = (index: number) => {
        setPackagingItems(packagingItems.filter((_, i) => i !== index));
    };

    const updateRawItem = (index: number, field: keyof BOMItem, value: any) => {
        const newItems = [...rawItems];
        (newItems[index] as any)[field] = value;

        if (field === 'component_id') {
            const product = rawMaterials.find(p => p.id === value);
            newItems[index].component = product || undefined;
            // Pre-fill unit from product
            if (product) {
                newItems[index].unit = product.unit || 'Pieces';
            }
        }

        setRawItems(newItems);
    };

    const updatePackagingItem = (index: number, field: keyof BOMItem, value: any) => {
        const newItems = [...packagingItems];
        (newItems[index] as any)[field] = value;

        if (field === 'component_id') {
            const product = packagingMaterials.find(p => p.id === value);
            newItems[index].component = product || undefined;
            // Pre-fill unit from product
            if (product) {
                newItems[index].unit = product.unit || 'Pieces';
            }
        }

        setPackagingItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!finishedProductId) {
            toast.error('Please select a finished product');
            return;
        }

        const allItems = [...rawItems, ...packagingItems];

        if (allItems.length === 0) {
            toast.error('Please add at least one component (raw material or packaging material)');
            return;
        }

        // Validate all items have component selected
        const invalidItems = allItems.filter(item => !item.component_id);
        if (invalidItems.length > 0) {
            toast.error('Please select a component for all items');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                name,
                finished_product_id: finishedProductId,
                version,
                is_active: isActive,
                notes,
                items: allItems
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving BOM:', error);
        } finally {
            setLoading(false);
        }
    };

    const isViewOnly = mode === 'view';

    // Calculate totals
    const totalRawComponents = rawItems.length;
    const totalPackagingComponents = packagingItems.length;
    const totalComponents = totalRawComponents + totalPackagingComponents;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'New Bill of Materials' : isViewOnly ? 'BOM Details' : 'Edit Bill of Materials'}
            subtitle={mode === 'create' ? 'Define raw materials and packaging materials for a finished product' : `BOM: ${name}`}
            width={900}
        >
            <form onSubmit={handleSubmit}>
                <div className="form-grid">
                    {/* Header Info */}
                    <div className="section-title full-width">BOM Information</div>

                    <div className="form-field">
                        <label>BOM Name *</label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., BOM for Paracetamol 500mg"
                                disabled={isViewOnly}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Finished Product *</label>
                        <div className="input-wrapper">
                            <Package size={16} className="icon" />
                            <select
                                value={finishedProductId}
                                onChange={(e) => handleFinishedProductChange(e.target.value)}
                                disabled={isViewOnly}
                                required
                            >
                                <option value="">Select finished product</option>
                                {finishedGoods.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Raw Material Components Section */}
                    <div className="section-title full-width" style={{ marginTop: 8 }}>
                        Raw Material Components
                    </div>

                    <div className="items-container full-width">
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40%' }}>Component (Raw Material)</th>
                                    <th style={{ width: '15%' }}>Unit</th>
                                    <th style={{ width: '20%' }}>Qty Required</th>
                                    <th style={{ width: '15%' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rawItems.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            {isViewOnly ? (
                                                <div>
                                                    <div className="product-name">{item.component?.name || '-'}</div>
                                                    <div className="product-sku">{item.component?.sku || '-'}</div>
                                                </div>
                                            ) : (
                                                <div className="component-select">
                                                    <select
                                                        value={item.component_id}
                                                        onChange={(e) => updateRawItem(index, 'component_id', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select component</option>
                                                        {rawMaterials.map(rm => (
                                                            <option key={rm.id} value={rm.id}>
                                                                {rm.name} ({rm.sku})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {isViewOnly ? (
                                                <div className="unit-display">{item.unit || item.component?.unit || '-'}</div>
                                            ) : (
                                                <>
                                                    <select
                                                        value={item.unit || ''}
                                                        onChange={(e) => updateRawItem(index, 'unit', e.target.value)}
                                                        className="unit-select"
                                                        required
                                                    >
                                                        <option value="">Select unit</option>
                                                        {GROUPED_UNIT_OPTIONS.map((g) => (
                                                            <optgroup key={g.label} label={g.label}>
                                                                {g.units.map((unit) => (
                                                                    <option key={unit} value={unit}>{unit}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    {item.component && item.unit && item.component.unit && item.unit !== item.component.unit && (
                                                        <UnitConversionHint value={item.quantity_required} fromUnit={item.unit} toUnit={item.component.unit} compact />
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td>
                                            {isViewOnly ? (
                                                <div className="qty-required">{item.quantity_required}</div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    value={item.quantity_required}
                                                    onChange={(e) => updateRawItem(index, 'quantity_required', parseFloat(e.target.value) || 0)}
                                                    className="qty-input"
                                                    required
                                                />
                                            )}
                                        </td>
                                        <td>
                                            {!isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeRawItem(index)}
                                                    className="btn-icon btn-danger"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {rawItems.length === 0 && (
                            <div className="no-items">
                                <Package size={24} />
                                <p>No raw materials added yet</p>
                            </div>
                        )}

                        {!isViewOnly && (
                            <div className="add-item-row">
                                <button
                                    type="button"
                                    onClick={addRawItem}
                                    className="btn-add"
                                >
                                    <Plus size={16} />
                                    Add Component
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Packaging Material Components Section */}
                    <div className="section-title full-width" style={{ marginTop: 8 }}>
                        Packaging Material Components
                    </div>

                    <div className="items-container full-width">
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40%' }}>Component (Packaging Material)</th>
                                    <th style={{ width: '15%' }}>Unit</th>
                                    <th style={{ width: '20%' }}>Qty Required</th>
                                    <th style={{ width: '15%' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {packagingItems.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            {isViewOnly ? (
                                                <div>
                                                    <div className="product-name">{item.component?.name || '-'}</div>
                                                    <div className="product-sku">{item.component?.sku || '-'}</div>
                                                </div>
                                            ) : (
                                                <div className="component-select">
                                                    <select
                                                        value={item.component_id}
                                                        onChange={(e) => updatePackagingItem(index, 'component_id', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select component</option>
                                                        {packagingMaterials.map(pm => (
                                                            <option key={pm.id} value={pm.id}>
                                                                {pm.name} ({pm.sku})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {isViewOnly ? (
                                                <div className="unit-display">{item.unit || item.component?.unit || '-'}</div>
                                            ) : (
                                                <>
                                                    <select
                                                        value={item.unit || ''}
                                                        onChange={(e) => updatePackagingItem(index, 'unit', e.target.value)}
                                                        className="unit-select"
                                                        required
                                                    >
                                                        <option value="">Select unit</option>
                                                        {GROUPED_UNIT_OPTIONS.map((g) => (
                                                            <optgroup key={g.label} label={g.label}>
                                                                {g.units.map((unit) => (
                                                                    <option key={unit} value={unit}>{unit}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    {item.component && item.unit && item.component.unit && item.unit !== item.component.unit && (
                                                        <UnitConversionHint value={item.quantity_required} fromUnit={item.unit} toUnit={item.component.unit} compact />
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td>
                                            {isViewOnly ? (
                                                <div className="qty-required">{item.quantity_required}</div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    value={item.quantity_required}
                                                    onChange={(e) => updatePackagingItem(index, 'quantity_required', parseFloat(e.target.value) || 0)}
                                                    className="qty-input"
                                                    required
                                                />
                                            )}
                                        </td>
                                        <td>
                                            {!isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePackagingItem(index)}
                                                    className="btn-icon btn-danger"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {packagingItems.length === 0 && (
                            <div className="no-items">
                                <Package size={24} />
                                <p>No packaging materials added yet</p>
                            </div>
                        )}

                        {!isViewOnly && (
                            <div className="add-item-row">
                                <button
                                    type="button"
                                    onClick={addPackagingItem}
                                    className="btn-add"
                                >
                                    <Plus size={16} />
                                    Add Component
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Cost Summary */}
                    {totalComponents > 0 && (
                        <div className="cost-summary full-width">
                            <div className="cost-item">
                                <Calculator size={16} />
                                <span>Raw Material Components: <strong>{totalRawComponents}</strong></span>
                            </div>
                            <div className="cost-item">
                                <span>+</span>
                            </div>
                            <div className="cost-item">
                                <Package size={16} />
                                <span>Packaging Components: <strong>{totalPackagingComponents}</strong></span>
                            </div>
                            <div className="cost-item">
                                <span>=</span>
                            </div>
                            <div className="cost-item">
                                <span>Total Components: <strong>{totalComponents}</strong></span>
                            </div>
                        </div>
                    )}

                    <div className="form-field full-width">
                        <label>Notes</label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" style={{ top: 12 }} />
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes, instructions, etc."
                                rows={3}
                                readOnly={isViewOnly}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        {isViewOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!isViewOnly && (
                        <button type="submit" disabled={loading} className="btn-primary">
                            <Save size={16} />
                            {loading ? 'Saving...' : mode === 'edit' ? 'Update BOM' : 'Create BOM'}
                        </button>
                    )}
                </div>
            </form>

            <style>{`
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .full-width {
                    grid-column: span 2;
                }
                .section-title {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-800);
                    border-bottom: 2px solid var(--slate-100);
                    padding-bottom: 8px;
                    margin-bottom: 4px;
                    margin-top: 12px;
                }
                .section-title:first-of-type {
                    margin-top: 0;
                }
                .form-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .input-wrapper {
                    position: relative;
                }
                .input-wrapper .icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .input-wrapper input, .input-wrapper select, textarea {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 10px;
                    font-size: 11px;
                    outline: none;
                    transition: all 0.2s;
                    background: var(--card-bg);
                }
                textarea {
                    padding-top: 10px;
                }
                .input-wrapper input:focus, .input-wrapper select:focus, textarea:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 4px var(--primary-50);
                }
                .input-wrapper input:disabled, .input-wrapper select:disabled {
                    background: var(--slate-50);
                    cursor: not-allowed;
                }

                .items-container {
                    border: 1.5px solid var(--slate-100);
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .items-table th {
                    background: var(--slate-50);
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-600);
                    border-bottom: 1.5px solid var(--slate-100);
                }
                .items-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--slate-50);
                }
                .product-name {
                    font-weight: 600;
                    font-size: 12px;
                    color: var(--slate-800);
                }
                .product-sku {
                    font-size: 10px;
                    color: var(--slate-500);
                    font-family: var(--font-mono);
                }
                .unit-display {
                    font-size: 11px;
                    color: var(--slate-500);
                }
                .qty-required {
                    font-weight: 600;
                    font-size: 12px;
                    color: var(--primary-600);
                }
                .qty-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .unit-select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 12px;
                    background: var(--card-bg);
                }
                .component-select select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 12px;
                }

                .no-items {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    color: var(--slate-400);
                    text-align: center;
                }
                .no-items svg {
                    margin-bottom: 8px;
                    opacity: 0.5;
                }
                .no-items p {
                    font-size: 12px;
                    margin: 0;
                }

                .add-item-row {
                    padding: 12px 16px;
                    background: var(--slate-50);
                    border-top: 1px solid var(--slate-100);
                }
                .btn-add {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border: 1.5px dashed var(--slate-300);
                    border-radius: 8px;
                    background: var(--card-bg);
                    color: var(--primary-600);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-add:hover {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                }

                .btn-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                    border-radius: 6px;
                    border: 1px solid var(--slate-200);
                    background: var(--card-bg);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-danger {
                    color: var(--danger);
                }
                .btn-danger:hover {
                    background: var(--danger);
                    color: white;
                    border-color: var(--danger);
                }

                .cost-summary {
                    display: flex;
                    gap: 24px;
                    padding: 12px 16px;
                    background: var(--primary-50);
                    border-radius: 8px;
                    margin-bottom: 8px;
                }
                .cost-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    color: var(--primary-700);
                }
                .cost-item strong {
                    color: var(--primary-900);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 24px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
                }
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(6, 182, 212, 0.3);
                }
                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
