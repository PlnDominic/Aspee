'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { 
    Factory, 
    Package, 
    Plus, 
    Trash2, 
    Save, 
    Calendar,
    Hash,
    FileText,
    AlertCircle,
    ChevronDown,
    ClipboardList
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { convertUnit } from '@/lib/unitConversions';
import UnitConversionHint from './UnitConversionHint';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
    bulk_unit?: string | null;
    bulk_to_base_ratio?: number | null;
    material_type: string;
}

interface BOMItem {
    product_id: string;
    product?: Product;
    quantity_required: number;
    quantity_available?: number;
    unit?: string;
}

interface ProductionOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
    onRequestMaterials?: (order: any, requestType: 'Raw Material' | 'Packaging Material') => void;
}

export default function ProductionOrderModal({ isOpen, onClose, onSave, initialData, mode = 'create', onRequestMaterials }: ProductionOrderModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    
    const [products, setProducts] = useState<Product[]>([]);
    const [bomItems, setBomItems] = useState<BOMItem[]>([]);
    
    const [orderNumber, setOrderNumber] = useState('');
    const [productId, setProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [bomVersion, setBomVersion] = useState('1.0');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');

    // New Product Creation State
    const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
    const [newProductName, setNewProductName] = useState('');

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            if (mode === 'create') {
                resetForm();
                generateOrderNumber();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    const fetchProducts = async () => {
        setFetching(true);
        try {
            // Fetch Finished Goods for production
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, unit, material_type')
                .eq('material_type', 'Finished Good')
                .order('name');
            
            if (error) throw error;
            setProducts(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch products: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchBOMItems = async (productId: string) => {
        if (!productId) {
            setBomItems([]);
            return;
        }

        setFetching(true);
        try {
            // Step 1: Find the active BOM for this finished product
            const { data: bom, error: bomError } = await supabase
                .from('bill_of_materials')
                .select('id')
                .eq('finished_product_id', productId)
                .eq('is_active', true)
                .single();

            if (bomError || !bom) {
                console.log('No active BOM found for this product');
                setBomItems([]);
                return;
            }

            // Step 2: Fetch BOM items with component details
            const { data: items, error: itemsError } = await supabase
                .from('bom_items')
                .select('*, component:products(id, name, sku, unit, bulk_unit, bulk_to_base_ratio, material_type)')
                .eq('bom_id', bom.id)
                .order('position');

            if (itemsError) {
                console.log('Error fetching BOM items:', itemsError.message);
                setBomItems([]);
            } else {
                // Step 3: Fetch Approved Quantities for all components
                const componentIds = (items || []).map((i: any) => i.component_id);
                const { data: qas } = await supabase
                    .from('grn_items')
                    .select('product_id, quantity_received, unit')
                    .in('product_id', componentIds)
                    .eq('qa_status', 'Approved');

                const qaMap: Record<string, number> = {};
                qas?.forEach(q => {
                    const productForStock = items.find((i: any) => i.component_id === q.product_id)?.component;
                    const baseQty = productForStock 
                        ? convertUnit(q.quantity_received, q.unit, productForStock.unit) 
                        : q.quantity_received;
                    
                    qaMap[q.product_id] = (qaMap[q.product_id] || 0) + baseQty;
                });

                // Transform BOM items
                const transformed = (items || []).map((item: any) => ({
                    product_id: item.component_id,
                    product: item.component,
                    quantity_required: item.quantity_required,
                    quantity_available: qaMap[item.component_id] || 0,
                    unit: item.unit
                }));
                setBomItems(transformed);
            }
        } catch (error: any) {
            console.log('Error fetching BOM:', error.message);
            setBomItems([]);
        } finally {
            setFetching(false);
        }
    };

    const generateOrderNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    setOrderNumber(`PRD-${year}${month}${day}-${hours}${minutes}${seconds}${ms}`);
  };

    const resetForm = () => {
        setOrderNumber('');
        setProductId('');
        setSelectedProduct(null);
        setQuantity(1);
        setBomVersion('1.0');
        setStartDate(new Date().toISOString().split('T')[0]);
        setDueDate('');
        setNotes('');
        setIsAddingNewProduct(false);
        setNewProductName('');
        setBomItems([]);
    };

    const populateForm = async (data: any) => {
        setOrderNumber(data.order_number || '');
        setProductId(data.product_id || '');
        setQuantity(data.quantity || 1);
        setBomVersion(data.bom_version || '1.0');
        setStartDate(data.start_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
        setDueDate(data.due_date?.split('T')[0] || '');
        setNotes(data.notes || '');

        // Find selected product
        const product = products.find(p => p.id === data.product_id);
        setSelectedProduct(product || null);

        // Fetch BOM items
        if (data.product_id) {
            await fetchBOMItems(data.product_id);
        }

        // Fetch actual order items if editing
        if (data.id) {
            try {
                const { data: itemsData, error } = await supabase
                    .from('production_order_items')
                    .select(`
                        *,
                        product:products(id, name, sku, unit)
                    `)
                    .eq('order_id', data.id);
                
                if (!error && itemsData && itemsData.length > 0) {
                    setBomItems(itemsData);
                }
            } catch (err) {
                console.error('Error fetching order items:', err);
            }
        }
    };

    const handleProductChange = (prodId: string) => {
        setProductId(prodId);
        const product = products.find(p => p.id === prodId);
        setSelectedProduct(product || null);
        fetchBOMItems(prodId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isAddingNewProduct && !productId) {
            toast.error('Please select a finished product to produce');
            return;
        }

        if (isAddingNewProduct && !newProductName) {
            toast.error('Please enter the name of the new finished product');
            return;
        }

        if (quantity < 1) {
            toast.error('Quantity must be at least 1');
            return;
        }

        setLoading(true);
        try {
            let finalProductId = productId;

            // Handle New Product Creation
            if (isAddingNewProduct) {
                // Generate a SKU
                const sku = `FG-${newProductName.toUpperCase().replace(/\s+/g, '-').slice(0, 10)}-${Math.floor(1000 + Math.random() * 9000)}`;
                
                const { data: newProd, error: prodError } = await supabase
                    .from('products')
                    .insert([{
                        name: newProductName,
                        sku: sku,
                        material_type: 'Finished Good',
                        unit: 'pcs'
                    }])
                    .select()
                    .single();
                
                if (prodError) throw prodError;
                finalProductId = newProd.id;
                toast.success(`Registered new product: ${newProductName}`);
            }

            await onSave({
                id: initialData?.id,
                order_number: orderNumber,
                product_id: finalProductId,
                quantity: quantity,
                bom_version: bomVersion,
                start_date: startDate,
                due_date: dueDate || null,
                notes: notes,
                status: 'Draft',
                items: bomItems.map(item => ({
                    product_id: item.product_id,
                    quantity_required: item.quantity_required,
                    quantity_used: 0
                }))
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving job order:', error);
        } finally {
            setLoading(false);
        }
    };

    const isViewOnly = mode === 'view';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'New Job Order' : isViewOnly ? 'Job Order Details' : 'Edit Job Order'}
            subtitle={mode === 'create' ? 'Create a new job order' : `Order ${orderNumber}`}
            width={850}
        >
            <form onSubmit={handleSubmit} className="production-form">
                <div className="form-grid">
                    {/* Header Info */}
                    <div className="section-title full-width">Order Information</div>
                    
                    <div className="form-field">
                        <label>Order Number</label>
                        <div className="input-wrapper disabled">
                            <Hash size={16} className="icon" />
                            <input value={orderNumber} readOnly />
                        </div>
                    </div>

                    <div className="form-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ margin: 0 }}>Finished Product *</label>
                            {mode === 'create' && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsAddingNewProduct(!isAddingNewProduct);
                                        if (!isAddingNewProduct) setProductId('');
                                    }}
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: 'var(--primary-600)', 
                                        fontSize: 10, 
                                        fontWeight: 600, 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                >
                                    {isAddingNewProduct ? 'Back to Selection' : '+ Add New Product'}
                                </button>
                            )}
                        </div>
                        <div className="input-wrapper">
                            <Package size={16} className="icon" />
                            {isAddingNewProduct ? (
                                <input 
                                    required 
                                    type="text"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    placeholder="Enter new finished product name"
                                    autoFocus
                                />
                            ) : (
                                <select 
                                    required={!isAddingNewProduct} 
                                    value={productId} 
                                    onChange={(e) => handleProductChange(e.target.value)}
                                    disabled={isViewOnly}
                                >
                                    <option value="">Select finished product</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Production Quantity *</label>
                        <div className="input-wrapper">
                            <Factory size={16} className="icon" />
                            <input 
                                type="number" 
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                disabled={isViewOnly}
                                placeholder="Enter quantity"
                            />
                        </div>
                    </div>



                    <div className="form-field">
                        <label>Start Date</label>
                        <div className="input-wrapper">
                            <Calendar size={16} className="icon" />
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={isViewOnly}
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Due Date</label>
                        <div className="input-wrapper">
                            <Calendar size={16} className="icon" />
                            <input 
                                type="date" 
                                value={dueDate} 
                                onChange={(e) => setDueDate(e.target.value)}
                                disabled={isViewOnly}
                            />
                        </div>
                    </div>

                    {/* Materials Section */}
                    {bomItems.length > 0 ? (
                        <>
                            <div className="section-title full-width" style={{ marginTop: 12 }}>
                                Raw Materials Required
                            </div>
                            <div className="items-container full-width">
                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '35%' }}>Component</th>
                                            <th style={{ width: '15%' }}>Unit</th>
                                            <th style={{ width: '15%' }}>Qty Required</th>
                                            <th style={{ width: '15%' }}>Total Needed</th>
                                            <th style={{ width: '20%' }}>Approved Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bomItems.filter(item => item.product?.material_type !== 'Packaging Material').map((item, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <div className="product-name">{item.product?.name || 'Unknown'}</div>
                                                    <div className="product-sku">{item.product?.sku || '-'}</div>
                                                </td>
                                                <td>
                                                    <div className="unit-display">{item.unit || item.product?.unit || '-'}</div>
                                                    {item.unit && item.product?.unit && item.unit !== item.product.unit && (
                                                        <UnitConversionHint value={item.quantity_required * quantity} fromUnit={item.unit} toUnit={item.product.unit} compact />
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="qty-required">{item.quantity_required}</div>
                                                    {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && (
                                                        <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 500 }}>
                                                            ≈ {(item.quantity_required / item.product.bulk_to_base_ratio % 1 === 0
                                                                ? (item.quantity_required / item.product.bulk_to_base_ratio).toLocaleString()
                                                                : (item.quantity_required / item.product.bulk_to_base_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                            )} {item.product.bulk_unit}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="qty-total">{(item.quantity_required * quantity).toLocaleString()}</div>
                                                    {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && (
                                                        <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 500 }}>
                                                            ≈ {((item.quantity_required * quantity) / item.product.bulk_to_base_ratio % 1 === 0
                                                                ? ((item.quantity_required * quantity) / item.product.bulk_to_base_ratio).toLocaleString()
                                                                : ((item.quantity_required * quantity) / item.product.bulk_to_base_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                            )} {item.product.bulk_unit}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{
                                                        fontWeight: 700,
                                                        color: (item.quantity_available || 0) >= (item.quantity_required * quantity) ? 'var(--success-600)' : 'var(--danger)',
                                                        fontSize: 12
                                                    }}>
                                                        {(item.quantity_available || 0).toLocaleString()}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {bomItems.filter(item => item.product?.material_type !== 'Packaging Material').length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--slate-400)' }}>
                                                    No raw materials found in BOM
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="section-title full-width" style={{ marginTop: 12 }}>
                                Packaging Materials Required
                            </div>
                            <div className="items-container full-width">
                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '35%' }}>Component</th>
                                            <th style={{ width: '15%' }}>Unit</th>
                                            <th style={{ width: '15%' }}>Qty Required</th>
                                            <th style={{ width: '15%' }}>Total Needed</th>
                                            <th style={{ width: '20%' }}>Approved Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bomItems.filter(item => item.product?.material_type === 'Packaging Material').map((item, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <div className="product-name">{item.product?.name || 'Unknown'}</div>
                                                    <div className="product-sku">{item.product?.sku || '-'}</div>
                                                </td>
                                                <td>
                                                    <div className="unit-display">{item.unit || item.product?.unit || '-'}</div>
                                                    {item.unit && item.product?.unit && item.unit !== item.product.unit && (
                                                        <UnitConversionHint value={item.quantity_required * quantity} fromUnit={item.unit} toUnit={item.product.unit} compact />
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="qty-required">{item.quantity_required}</div>
                                                    {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && (
                                                        <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 500 }}>
                                                            ≈ {(item.quantity_required / item.product.bulk_to_base_ratio % 1 === 0
                                                                ? (item.quantity_required / item.product.bulk_to_base_ratio).toLocaleString()
                                                                : (item.quantity_required / item.product.bulk_to_base_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                            )} {item.product.bulk_unit}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="qty-total">{(item.quantity_required * quantity).toLocaleString()}</div>
                                                    {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && (
                                                        <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 500 }}>
                                                            ≈ {((item.quantity_required * quantity) / item.product.bulk_to_base_ratio % 1 === 0
                                                                ? ((item.quantity_required * quantity) / item.product.bulk_to_base_ratio).toLocaleString()
                                                                : ((item.quantity_required * quantity) / item.product.bulk_to_base_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                            )} {item.product.bulk_unit}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{
                                                        fontWeight: 700, 
                                                        color: (item.quantity_available || 0) >= (item.quantity_required * quantity) ? 'var(--success-600)' : 'var(--danger)',
                                                        fontSize: 12
                                                    }}>
                                                        {(item.quantity_available || 0).toLocaleString()}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {bomItems.filter(item => item.product?.material_type === 'Packaging Material').length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--slate-400)' }}>
                                                    No packaging materials found in BOM
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="items-container full-width" style={{ marginTop: 12 }}>
                            <div className="no-bom">
                                <AlertCircle size={20} />
                                <p>
                                    {productId 
                                        ? 'No Bill of Materials found for this product. Add raw materials manually after creation.'
                                        : 'Select a finished product to see required materials'}
                                </p>
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
                                placeholder="Production notes, special instructions, etc."
                                rows={3}
                                readOnly={isViewOnly}
                            />
                        </div>
                    </div>
                </div>

                {!isViewOnly && (
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            <Save size={16} />
                            {loading ? 'Saving...' : mode === 'edit' ? 'Update Order' : 'Create Order'}
                        </button>
                    </div>
                )}

                {isViewOnly && (
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
                    </div>
                )}
            </form>

            <style>{`
                .production-form {
                    padding: 8px 4px;
                }
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
                .input-wrapper.disabled {
                    opacity: 0.7;
                    background: var(--slate-50);
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
                .qty-required, .qty-total {
                    font-weight: 600;
                    font-size: 12px;
                    color: var(--slate-700);
                }
                .qty-total {
                    color: var(--primary-600);
                }

                .no-bom {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 32px;
                    color: var(--slate-400);
                    text-align: center;
                }
                .no-bom svg {
                    margin-bottom: 8px;
                    color: var(--amber-500);
                }
                .no-bom p {
                    font-size: 12px;
                    max-width: 300px;
                    margin: 0;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 28px;
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
