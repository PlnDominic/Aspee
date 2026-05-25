'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    ClipboardList,
    Save,
    AlertCircle,
    Search,
    Plus,
    Trash2,
    Factory
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
    bulk_unit?: string | null;
    bulk_to_base_ratio?: number | null;
    material_type?: string;
}

interface RequestItem {
    product_id: string;
    product?: Product;
    quantity_required: number;
    quantity_requested: number;
    quantity_available?: number;
    unit?: string;
}

interface MaterialRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    productionOrder?: any;
    product?: any;
    requestType?: 'Raw Material' | 'Packaging Material';
    editingRequest?: any;
}

export default function MaterialRequestModal({ isOpen, onClose, onSuccess, productionOrder, product, requestType, editingRequest }: MaterialRequestModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [items, setItems] = useState<RequestItem[]>([]);
    const [notes, setNotes] = useState('');
    const [requestNumber, setRequestNumber] = useState('');

    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [allJobOrders, setAllJobOrders] = useState<any[]>([]);
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const isStandalone = !productionOrder && !product;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isOpen) {
            if (editingRequest) {
                // Loading for Edit
                setRequestNumber(editingRequest.request_number);
                setNotes(editingRequest.notes || '');
                setSelectedOrderId(editingRequest.production_order_id || '');
                fetchRequestItemsInternal(editingRequest.id);
            } else if (productionOrder) {
                fetchOrderItemsInternal(productionOrder);
                setNotes(`Materials for Job Order: ${productionOrder.order_number}`);
                setSelectedOrderId(productionOrder.id);
                generateRequestNumber();
            } else if (product) {
                setItems([{
                    product_id: product.id,
                    product,
                    quantity_required: 0,
                    quantity_requested: 1,
                    unit: product.unit
                }]);
                generateRequestNumber();
                setNotes('');
                setSelectedOrderId('');
            } else {
                setItems([]);
                generateRequestNumber();
                setNotes('');
                setSelectedOrderId('');
            }
            setSearchTerm('');
            fetchProducts();
            fetchJobOrders();
        }
    }, [isOpen, productionOrder, product, editingRequest]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, unit, material_type')
                .order('name');
            if (error) {
                console.error('Products fetch error:', error);
                throw error;
            }
            setAllProducts(data || []);
        } catch (error: any) {
            console.error('Products fetch exception:', error);
            // Don't toast during fetch failure to avoid spamming if it's a network glitch
        }
    };

    const fetchJobOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('production_orders')
                .select('id, order_number, status, quantity, product_id, product:products(name)')
                .in('status', ['Draft', 'Released', 'In Progress'])
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Orders fetch error:', error);
                throw error;
            }
            setAllJobOrders(data || []);
        } catch (error: any) {
            console.error('Orders fetch exception:', error);
        }
    };

    const handleJobOrderChange = async (orderId: string) => {
        setSelectedOrderId(orderId);
        if (!orderId) {
            setItems([]);
            setNotes('');
            return;
        }

        const selectedOrder = allJobOrders.find(o => o.id === orderId);
        if (selectedOrder) {
            setNotes(`Materials for Job Order: ${selectedOrder.order_number}`);
            await fetchOrderItemsInternal(selectedOrder);
        }
    };

    const fetchOrderItemsInternal = async (pOrder: any) => {
        if (!pOrder?.id) return;

        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('production_order_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit, material_type)
                `)
                .eq('order_id', pOrder.id);

            if (error) throw error;

            let finalItems = data || [];

            if (finalItems.length === 0 && pOrder.product_id) {
                const { data: bom } = await supabase
                    .from('bill_of_materials')
                    .select('id')
                    .eq('finished_product_id', pOrder.product_id)
                    .eq('is_active', true)
                    .single();
                
                if (bom) {
                    const { data: bomItems } = await supabase
                        .from('bom_items')
                        .select('*, component:products(id, name, sku, unit, bulk_unit, bulk_to_base_ratio, material_type)')
                        .eq('bom_id', bom.id);
                    
                    if (bomItems) {
                        finalItems = bomItems.map(bi => ({
                            product_id: bi.component_id,
                            product: bi.component,
                            quantity_required: bi.quantity_required,
                            unit: bi.component?.unit
                        }));
                    }
                }
            }

            const requestItems = finalItems.map((item: any) => ({
                product_id: item.product_id,
                product: item.product,
                quantity_required: item.quantity_required * (pOrder.quantity || 1),
                quantity_requested: item.quantity_required * (pOrder.quantity || 1),
                quantity_available: 0,
                unit: item.product?.unit
            }));

            const productIds = requestItems.map(i => i.product_id);
            const { data: stockData } = await supabase
                .from('stock_levels')
                .select('product_id, qty_on_hand')
                .in('product_id', productIds);

            const stockMap: Record<string, number> = {};
            stockData?.forEach(s => {
                stockMap[s.product_id] = (stockMap[s.product_id] || 0) + (s.qty_on_hand || 0);
            });

            requestItems.forEach(item => {
                item.quantity_available = stockMap[item.product_id] || 0;
            });

            setItems(requestItems);
        } catch (error: any) {
            toast.error('Failed to fetch items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchRequestItemsInternal = async (requestId: string) => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('material_request_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit, material_type)
                `)
                .eq('request_id', requestId);

            if (error) throw error;

            const productIds = data?.map(i => i.product_id) || [];
            const { data: stockData } = await supabase
                .from('stock_levels')
                .select('product_id, qty_on_hand')
                .in('product_id', productIds);

            const stockMap: Record<string, number> = {};
            stockData?.forEach(s => {
                stockMap[s.product_id] = (stockMap[s.product_id] || 0) + (s.qty_on_hand || 0);
            });

            setItems((data || []).map((item: any) => ({
                product_id: item.product_id,
                product: item.product,
                quantity_required: 0, // Not applicable for direct edits usually
                quantity_requested: item.quantity_requested,
                quantity_available: stockMap[item.product_id] || 0,
                unit: item.unit || item.product?.unit
            })));
        } catch (error: any) {
            toast.error('Failed to fetch request items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generateRequestNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        const secs = date.getSeconds().toString().padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const suffixStr = requestType === 'Raw Material' ? '-RM' : requestType === 'Packaging Material' ? '-PM' : '';
        setRequestNumber(`MRQ-${year}${month}${day}-${hours}${mins}${secs}-${random}${suffixStr}`);
    };

    const filteredProducts = allProducts.filter(p => {
        const alreadyAdded = items.some(i => i.product_id === p.id);
        if (alreadyAdded) return false;
        
        // Filter by request type if specified
        if (requestType === 'Raw Material' && p.material_type === 'Packaging Material') return false;
        if (requestType === 'Packaging Material' && p.material_type !== 'Packaging Material') return false;

        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
    });

    const addProduct = async (prod: Product) => {
        // Fetch Stock Qty for this specific product
        const { data: stockData } = await supabase
            .from('stock_levels')
            .select('qty_on_hand')
            .eq('product_id', prod.id);
        
        const totalStock = stockData?.reduce((sum, s) => sum + (s.qty_on_hand || 0), 0) || 0;

        setItems(prev => [...prev, {
            product_id: prod.id,
            product: prod,
            quantity_required: 0,
            quantity_requested: 1,
            quantity_available: totalStock,
            unit: prod.unit
        }]);
        setSearchTerm('');
        setShowDropdown(false);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const filteredItems = items.filter(item => {
        // If a Job Order is selected, show all items for that order (RM + Packaging)
        if (selectedOrderId) return true;
        if (!requestType) return true;
        if (requestType === 'Raw Material') return item.product?.material_type !== 'Packaging Material';
        if (requestType === 'Packaging Material') return item.product?.material_type === 'Packaging Material';
        return true;
    });

    const updateItem = (productId: string, updates: Partial<RequestItem>) => {
        setItems(prev => prev.map(item =>
            item.product_id === productId ? { ...item, ...updates } : item
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (filteredItems.length === 0) {
            toast.error('Add at least one material to request');
            return;
        }

        const invalidItems = filteredItems.filter(i => i.quantity_requested <= 0);
        if (invalidItems.length > 0) {
            toast.error('All items must have a quantity greater than 0');
            return;
        }

        setLoading(true);
        try {
            let requestId = editingRequest?.id;

            if (editingRequest) {
                const { error: requestError } = await supabase
                    .from('material_requests')
                    .update({
                        production_order_id: selectedOrderId || null,
                        notes,
                        request_type: requestType || 'All'
                    })
                    .eq('id', editingRequest.id);

                if (requestError) throw requestError;

                // Delete old items to refresh
                const { error: delError } = await supabase
                    .from('material_request_items')
                    .delete()
                    .eq('request_id', editingRequest.id);
                
                if (delError) throw delError;
            } else {
                const { data: request, error: requestError } = await supabase
                    .from('material_requests')
                    .insert([{
                        request_number: requestNumber,
                        production_order_id: selectedOrderId || null,
                        priority: 'Medium',
                        notes,
                        status: 'Pending',
                        request_type: requestType || 'All'
                    }])
                    .select()
                    .single();

                if (requestError) throw requestError;
                requestId = request.id;
            }

            const itemsToSave = filteredItems.map(item => ({
                request_id: requestId,
                product_id: item.product_id,
                quantity_requested: item.quantity_requested,
                unit: item.unit || item.product?.unit || null
            }));

            const { error: itemsError } = await supabase
                .from('material_request_items')
                .insert(itemsToSave);

            if (itemsError) throw itemsError;

            toast.success(editingRequest ? 'Material request updated' : 'Material request submitted');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error saving request: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const modalTitle = editingRequest
        ? `Edit Request: ${editingRequest.request_number}`
        : (selectedOrderId || !requestType)
            ? 'Request Materials'
            : requestType === 'Raw Material'
                ? 'Request Raw Materials'
                : 'Request Packaging Materials';

    const subtitle = productionOrder
        ? requestType === 'Raw Material'
            ? `Request raw materials for Job Order ${productionOrder?.order_number}`
            : requestType === 'Packaging Material'
                ? `Request packaging materials for Job Order ${productionOrder?.order_number}`
                : `New request for Production Order ${productionOrder?.order_number}`
        : product
            ? `Direct request for ${product?.name || 'Materials'}`
            : 'Create a new material request for production';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            subtitle={subtitle}
            width={850}
        >
            <form onSubmit={handleSubmit} className="mr-form">
                <div className="form-grid">
                    <div className="form-field">
                        <label>Request Number</label>
                        <div className="input-wrapper disabled">
                            <ClipboardList size={16} className="icon" />
                            <input value={requestNumber} readOnly />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Job Order Link</label>
                        <div className="input-wrapper">
                            <Factory size={16} className="icon" />
                            <select 
                                value={selectedOrderId} 
                                onChange={(e) => handleJobOrderChange(e.target.value)}
                                disabled={!!productionOrder}
                            >
                                <option value="">Select job order (Optional)</option>
                                {allJobOrders.map(o => (
                                    <option key={o.id} value={o.id}>
                                        {o.order_number} - {o.product?.name} ({o.status})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-field full-width" ref={searchRef}>
                        <label>Add Additional Material</label>
                        <div className="input-wrapper">
                            <Search size={16} className="icon" />
                            <input
                                type="text"
                                placeholder={requestType ? `Search ${requestType}s...` : "Search by name or SKU..."}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowDropdown(true);
                                }}
                                onFocus={() => setShowDropdown(true)}
                            />
                        </div>
                        {showDropdown && (
                            <div className="search-dropdown">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.slice(0, 8).map(p => (
                                        <div key={p.id} className="search-item" onClick={() => addProduct(p)}>
                                            <div>
                                                <div className="product-name">{p.name}</div>
                                                <div className="product-sku">{p.sku} &middot; {p.unit}</div>
                                            </div>
                                            <Plus size={14} className="add-icon" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-results">No {requestType?.toLowerCase() || 'materials'} found</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="items-container full-width">
                        {fetching ? (
                            <div className="fetching">Fetching items...</div>
                        ) : filteredItems.length > 0 ? (
                            <table className="mr-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40%' }}>Material</th>
                                        <th style={{ width: '15%' }}>Unit</th>
                                        {!isStandalone && <th style={{ width: '12%' }}>Required</th>}
                                        <th style={{ width: '15%' }}>Request Qty</th>
                                        <th style={{ width: '13%' }}>Approved Stock</th>
                                        {isStandalone && <th style={{ width: '5%' }}></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="product-name">{item.product?.name}</div>
                                                <div className="product-sku">{item.product?.sku}</div>
                                            </td>
                                            <td>
                                                 <select 
                                                    value={item.unit || item.product?.unit || ''} 
                                                    onChange={(e) => updateItem(item.product_id, { unit: e.target.value })}
                                                    className="unit-select"
                                                 >
                                                    {GROUPED_UNIT_OPTIONS.map((g) => (
                                                        <optgroup key={g.label} label={g.label}>
                                                            {g.units.map((u) => (
                                                                <option key={u} value={u}>{u}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                 </select>
                                                 {item.unit && item.product?.unit && item.unit !== item.product.unit && (
                                                     <UnitConversionHint value={item.quantity_requested} fromUnit={item.unit} toUnit={item.product.unit} compact />
                                                 )}
                                             </td>
                                            {!isStandalone && <td>{item.quantity_required.toLocaleString()}</td>}
                                            <td>
                                                <input
                                                    type="number"
                                                    className="qty-input"
                                                    value={item.quantity_requested}
                                                    onChange={(e) => updateItem(item.product_id, { quantity_requested: parseFloat(e.target.value) || 0 })}
                                                    min="0"
                                                    step="any"
                                                />
                                                {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && item.quantity_requested > 0 && (
                                                    <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>
                                                        ≈ {(item.quantity_requested / item.product.bulk_to_base_ratio % 1 === 0
                                                            ? (item.quantity_requested / item.product.bulk_to_base_ratio).toLocaleString()
                                                            : (item.quantity_requested / item.product.bulk_to_base_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                        )} {item.product.bulk_unit}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ 
                                                    fontWeight: 700, 
                                                    color: (item.quantity_available || 0) >= item.quantity_requested ? 'var(--success-600)' : 'var(--danger)',
                                                    fontSize: 11
                                                }}>
                                                    {(item.quantity_available || 0).toLocaleString()}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="remove-btn"
                                                    onClick={() => removeItem(items.findIndex(i => i.product_id === item.product_id))}
                                                    title="Remove"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="no-items">
                                {isStandalone ? 'Search and add materials above to begin.' : 'No raw materials found for this order.'}
                            </div>
                        )}
                    </div>

                    <div className="form-field full-width">
                        <label>Notes</label>
                        <div className="input-wrapper">
                            <ClipboardList size={16} className="icon" style={{ top: 12 }} />
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional notes..." />
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading} className="btn-primary">
                        <Save size={16} />
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </form>

            <style>{`
                .mr-form { display: flex; flex-direction: column; gap: 20px; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .full-width { grid-column: span 2; }
                .form-field label { display: block; font-size: 11px; font-weight: 500; color: var(--slate-600); margin-bottom: 6px; }
                .input-wrapper { position: relative; display: flex; align-items: center; }
                .input-wrapper .icon { position: absolute; left: 12px; color: var(--slate-400); }
                .input-wrapper input, .input-wrapper select, textarea {
                    width: 100%; padding: 9px 12px 9px 38px; border: 1.5px solid var(--slate-200);
                    border-radius: 8px; font-size: 11px; background: var(--card-bg); color: var(--slate-900); outline: none;
                }
                textarea { padding: 10px 12px 10px 38px; }
                .disabled input { background: var(--slate-50); color: var(--slate-500); }
                .items-container { border: 1px solid var(--slate-200); border-radius: 10px; overflow: hidden; }
                .mr-table { width: 100%; border-collapse: collapse; }
                .mr-table th, .mr-table td { padding: 10px 12px; border-bottom: 1px solid var(--slate-100); font-size: 11px; text-align: left; }
                .mr-table th { background: var(--slate-50); font-weight: 700; color: var(--slate-600); }
                .product-name { font-weight: 600; color: var(--slate-800); }
                .product-sku { font-size: 10px; color: var(--slate-500); }
                .qty-input { width: 100%; padding: 8px 10px; border: 1.5px solid var(--slate-200); border-radius: 8px; font-size: 11px; background: var(--card-bg); }
                .fetching, .no-items, .no-results { padding: 20px; text-align: center; font-size: 11px; color: var(--slate-500); }
                .search-dropdown { margin-top: 8px; border: 1px solid var(--slate-200); border-radius: 10px; background: var(--card-bg); max-height: 240px; overflow-y: auto; }
                .search-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--slate-100); }
                .search-item:hover { background: var(--slate-50); }
                .add-icon { color: var(--primary-600); }
                .remove-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: #fef2f2; color: #dc2626; cursor: pointer; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
                .btn-secondary { padding: 10px 20px; border-radius: 8px; border: 1.5px solid var(--slate-200); background: var(--card-bg); color: var(--slate-600); font-size: 11px; font-weight: 600; cursor: pointer; }
                .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 8px; border: none; background: linear-gradient(135deg, var(--primary-600), var(--primary-500)); color: white; font-size: 11px; font-weight: 600; cursor: pointer; }
            `}</style>
        </Modal>
    );
}
