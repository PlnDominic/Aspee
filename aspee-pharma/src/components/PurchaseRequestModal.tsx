'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    ClipboardList,
    Save,
    Search,
    Package,
    Trash2,
    Calendar,
    DollarSign
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
    material_type: string;
}

interface RequestItem {
    product_id: string;
    product?: Product;
    quantity: number;
    unit?: string;
    last_purchase_price: number;
    last_purchase_date: string | null;
    purpose: string;
}

interface PurchaseRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editingRequest?: any;
}

export default function PurchaseRequestModal({ isOpen, onClose, onSuccess, editingRequest }: PurchaseRequestModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [items, setItems] = useState<RequestItem[]>([]);
    const [notes, setNotes] = useState('');
    const [requestNumber, setRequestNumber] = useState('');
    const [priority, setPriority] = useState('Normal');

    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All Categories');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (editingRequest) {
                setRequestNumber(editingRequest.request_number);
                setNotes(editingRequest.notes || '');
                setPriority(editingRequest.priority || 'Normal');
                fetchRequestItemsInternal(editingRequest.id);
            } else {
                setItems([]);
                generateRequestNumber();
                setNotes('');
                setPriority('Normal');
            }
            setSearchTerm('');
            setSelectedCategory('All Categories');
            fetchProducts();
        }
    }, [isOpen, editingRequest]);

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
                .neq('material_type', 'Finished Good')
                .order('name');
            if (error) throw error;
            setAllProducts(data || []);
        } catch (error: any) {
            console.error('Products fetch error:', error);
        }
    };

    const fetchRequestItemsInternal = async (requestId: string) => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('purchase_request_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit)
                `)
                .eq('request_id', requestId);

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch request items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generateRequestNumber = () => {
        const date = new Date();
        const year = date.getFullYear();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        setRequestNumber(`PRQ-${year}-${random}`);
    };

    const getPurchaseHistory = async (productId: string) => {
        try {
            // Find last GRN item for this product
            const { data, error } = await supabase
                .from('grn_items')
                .select(`
                    unit_price,
                    grn:grns(received_at)
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;
            
            if (data && data.length > 0) {
                const lastGrn = data[0] as any;
                return {
                    price: lastGrn.unit_price || 0,
                    date: lastGrn.grn?.received_at || null
                };
            }
            return { price: 0, date: null };
        } catch (error) {
            console.error('History fetch error:', error);
            return { price: 0, date: null };
        }
    };

    const addProduct = async (prod: Product) => {
        setFetching(true);
        const history = await getPurchaseHistory(prod.id);
        
        setItems(prev => [...prev, {
            product_id: prod.id,
            product: prod,
            quantity: 1,
            unit: prod.unit,
            last_purchase_price: history.price,
            last_purchase_date: history.date,
            purpose: ''
        }]);
        setSearchTerm('');
        setShowDropdown(false);
        setFetching(false);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, updates: Partial<RequestItem>) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], ...updates };
            return newItems;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (items.length === 0) {
            toast.error('Add at least one item to request');
            return;
        }

        setLoading(true);
        try {
            const { data: auth } = await supabase.auth.getUser();
            const { data: systemUser } = await supabase
                .from('system_users')
                .select('id')
                .eq('auth_user_id', auth.user?.id)
                .maybeSingle();

            let requestId = editingRequest?.id;

            if (editingRequest) {
                const { error: requestError } = await supabase
                    .from('purchase_requests')
                    .update({
                        priority,
                        notes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingRequest.id);

                if (requestError) throw requestError;

                await supabase.from('purchase_request_items').delete().eq('request_id', editingRequest.id);
            } else {
                const { data: request, error: requestError } = await supabase
                    .from('purchase_requests')
                    .insert([{
                        request_number: requestNumber,
                        requested_by: systemUser?.id,
                        priority,
                        notes,
                        status: 'Pending'
                    }])
                    .select()
                    .single();

                if (requestError) throw requestError;
                requestId = request.id;
            }

            const itemsToSave = items.map(item => ({
                request_id: requestId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit: item.unit || item.product?.unit,
                last_purchase_price: item.last_purchase_price,
                last_purchase_date: item.last_purchase_date,
                purpose: item.purpose
            }));

            const { error: itemsError } = await supabase
                .from('purchase_request_items')
                .insert(itemsToSave);

            if (itemsError) throw itemsError;

            toast.success(editingRequest ? 'Request updated' : 'Purchase request submitted');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error saving: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const categoryOptions = ['All Categories', ...Array.from(new Set(allProducts.map((p) => p.material_type))).sort()];

    const filteredProducts = allProducts.filter(p => {
        const alreadyAdded = items.some(i => i.product_id === p.id);
        if (alreadyAdded) return false;
        if (selectedCategory !== 'All Categories' && p.material_type !== selectedCategory) return false;
        if (!searchTerm) return true;
        return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    });
    const totalRequestedQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingRequest ? "Edit Purchase Request" : "New Purchase Request"}
            subtitle="Request materials or components from the purchasing unit"
            width={900}
        >
            <form onSubmit={handleSubmit} className="pr-form">
                <div className="form-section">
                    <h4 className="section-title">
                        <ClipboardList size={16} />
                        Request Details
                    </h4>

                    <div className="form-grid">
                        <div className="form-field">
                            <label>Request #</label>
                            <div className="input-field disabled">
                                <ClipboardList size={16} className="icon" />
                                <input value={requestNumber} readOnly />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Priority</label>
                            <div className="input-field">
                                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                                    <option value="Low">Low</option>
                                    <option value="Normal">Normal</option>
                                    <option value="High">High</option>
                                    <option value="Urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-field full-width">
                            <label>Overall Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Reason for request, vendor preference, etc."
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h4 className="section-title">
                        <Package size={16} />
                        Requested Items
                    </h4>

                    <div className="po-table-actions-bar">
                        <div className="quick-add-utility request-add-utility" ref={searchRef}>
                            <span className="util-label">Add Material/Component</span>
                            <div className="util-fields request-util-fields">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    className="util-select request-category-select"
                                >
                                    {categoryOptions.map((category) => (
                                        <option key={category} value={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                                <div className="request-search-field">
                                    <Search size={16} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or SKU..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setShowDropdown(true);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                    />
                                    {showDropdown && (
                                        <div className="dropdown">
                                            {filteredProducts.length > 0 ? (
                                                filteredProducts.slice(0, 10).map(p => (
                                                    <div key={p.id} className="dropdown-item" onClick={() => addProduct(p)}>
                                                        <div className="name">{p.name}</div>
                                                        <div className="sku">{p.sku} • {p.material_type}</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-results">No products found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="request-count-chip">
                            <span className="request-count-value">{items.length}</span>
                            <span className="request-count-label">{items.length === 1 ? 'line item' : 'line items'}</span>
                        </div>
                    </div>

                    <div className="items-table-wrapper">
                        {items.length > 0 ? (
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>#</th>
                                        <th>Material</th>
                                        <th style={{ width: 100 }}>Qty</th>
                                        <th style={{ width: 120 }}>Unit</th>
                                        <th style={{ width: 220 }}>Purchase History</th>
                                        <th>Purpose</th>
                                        <th style={{ width: 45 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="row-index">{index + 1}</td>
                                            <td>
                                                <div className="name">{item.product?.name}</div>
                                                <div className="sku">{item.product?.sku}</div>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                                                    className="qty-input"
                                                    min="0"
                                                />
                                            </td>
                                            <td>
                                                <span className="unit-chip">{item.unit || item.product?.unit}</span>
                                            </td>
                                            <td>
                                                <div className="history-box">
                                                    <div className="history-item">
                                                        <DollarSign size={10} />
                                                        <span>Last: <b>{item.last_purchase_price.toLocaleString()}</b></span>
                                                    </div>
                                                    <div className="history-item">
                                                        <Calendar size={10} />
                                                        <span>{item.last_purchase_date ? new Date(item.last_purchase_date).toLocaleDateString() : 'Never'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.purpose}
                                                    onChange={(e) => updateItem(index, { purpose: e.target.value })}
                                                    className="purpose-input"
                                                    placeholder="e.g. Low stock"
                                                />
                                            </td>
                                            <td>
                                                <button type="button" onClick={() => removeItem(index)} className="btn-remove-row">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="no-items">
                                No materials selected yet. Use the search field above to add a request line.
                            </div>
                        )}
                    </div>

                    <div className="summary-row">
                        <div className="summary-item">
                            <span className="summary-label">Items Added:</span>
                            <span className="summary-value">{items.length}</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Total Quantity:</span>
                            <span className="summary-value">{totalRequestedQuantity.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                    <button type="submit" disabled={loading || fetching} className="btn-save">
                        <Save size={16} />
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </form>

            <style>{`
                .pr-form {
                    margin-top: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .form-section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-700);
                    margin: 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--slate-100);
                }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .full-width { grid-column: span 2; }
                .form-field { display: flex; flex-direction: column; gap: 8px; }
                .form-field label { display: block; font-size: 11px; font-weight: 600; color: var(--slate-600); }
                .input-field { position: relative; display: flex; align-items: center; }
                .input-field .icon { position: absolute; left: 12px; color: var(--slate-400); }
                .input-field input, .input-field select, textarea {
                    width: 100%; padding: 10px 12px 10px 40px; border: 1px solid var(--slate-200);
                    border-radius: 8px; font-size: 11px; background: var(--card-bg); color: var(--slate-900); outline: none;
                    transition: all 0.2s;
                }
                textarea { padding: 10px 12px; resize: vertical; min-height: 88px; }
                .input-field input:focus,
                .input-field select:focus,
                textarea:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .disabled input { background: var(--slate-50); color: var(--slate-500); }
                .po-table-actions-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 12px;
                }
                .quick-add-utility {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 16px;
                    background: var(--slate-50);
                    border-radius: 12px;
                    border: 1px solid var(--slate-100);
                }
                .request-add-utility {
                    flex: 1;
                    align-items: flex-start;
                }
                .util-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--slate-500);
                    text-transform: uppercase;
                    white-space: nowrap;
                    padding-top: 7px;
                }
                .util-fields {
                    display: flex;
                    gap: 8px;
                }
                .request-util-fields {
                    flex: 1;
                    align-items: stretch;
                }
                .util-select {
                    padding: 10px 12px;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    background: var(--card-bg);
                    color: var(--slate-900);
                    outline: none;
                    min-width: 190px;
                    transition: all 0.2s;
                }
                .util-select:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .request-category-select {
                    flex: 0 0 220px;
                }
                .request-search-field {
                    position: relative;
                    flex: 1;
                }
                .request-search-field .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                    pointer-events: none;
                }
                .request-search-field input {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    background: var(--card-bg);
                    color: var(--slate-900);
                    outline: none;
                    transition: all 0.2s;
                }
                .request-search-field input:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    width: 100%;
                    background: white;
                    border: 1px solid var(--slate-200);
                    border-radius: 10px;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    z-index: 50;
                    max-height: 250px;
                    overflow-y: auto;
                }
                .dropdown-item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--slate-50); }
                .dropdown-item:hover { background: var(--slate-50); }
                .dropdown-item .name { font-weight: 600; font-size: 13px; color: var(--slate-800); }
                .dropdown-item .sku { font-size: 11px; color: var(--slate-500); }
                .request-count-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border: 1px solid var(--slate-200);
                    background: var(--card-bg);
                    white-space: nowrap;
                }
                .request-count-value {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--primary-600);
                }
                .request-count-label {
                    font-size: 11px;
                    color: var(--slate-500);
                    font-weight: 600;
                }
                .items-table-wrapper {
                    overflow-x: auto;
                    border: 1px solid var(--slate-200);
                    border-radius: 12px;
                    background: var(--card-bg);
                }
                .items-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                .items-table th {
                    background: var(--slate-50);
                    padding: 12px 10px;
                    text-align: left;
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--slate-500);
                    text-transform: uppercase;
                    border-bottom: 1px solid var(--slate-200);
                    white-space: nowrap;
                }
                .items-table td {
                    padding: 10px;
                    background: white;
                    border-bottom: 1px solid var(--slate-100);
                    font-size: 11px;
                    vertical-align: middle;
                }
                .row-index {
                    color: var(--slate-400);
                    font-family: var(--font-mono);
                    font-size: 10px;
                }
                .items-table .name { font-weight: 600; color: var(--slate-900); }
                .items-table .sku { font-size: 11px; color: var(--slate-500); }
                .qty-input, .purpose-input {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid var(--slate-200);
                    border-radius: 6px;
                    outline: none;
                    font-size: 11px;
                    background: var(--card-bg);
                }
                .qty-input:focus, .purpose-input:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
                }
                .unit-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: var(--slate-50);
                    color: var(--slate-700);
                    font-size: 10px;
                    font-weight: 700;
                    border: 1px solid var(--slate-200);
                }
                .history-box { display: flex; flex-direction: column; gap: 4px; }
                .history-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--slate-600); }
                .history-item b { color: var(--primary-600); }
                .btn-remove-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: none;
                    background: #FEF2F2;
                    color: #EF4444;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-remove-row:hover {
                    background: #FEE2E2;
                    transform: scale(1.1);
                }
                .no-items {
                    padding: 32px 20px;
                    text-align: center;
                    color: var(--slate-400);
                    font-size: 11px;
                }
                .summary-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 32px;
                    padding: 16px 24px;
                    background: var(--slate-50);
                    border-radius: 12px;
                    margin-top: 12px;
                }
                .summary-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .summary-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--slate-500);
                }
                .summary-value {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--primary-600);
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 8px;
                    padding-top: 24px;
                    border-top: 1px solid var(--slate-100);
                }
                .btn-cancel { padding: 10px 20px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); font-weight: 600; cursor: pointer; }
                .btn-save {
                    display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500)); color: white;
                    font-weight: 600; border: none; cursor: pointer; transition: transform 0.2s;
                }
                .btn-save:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
                .btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
                @media (max-width: 900px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                    .full-width {
                        grid-column: span 1;
                    }
                    .po-table-actions-bar,
                    .quick-add-utility,
                    .summary-row,
                    .modal-actions {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .util-label {
                        padding-top: 0;
                    }
                    .request-category-select {
                        flex-basis: auto;
                    }
                }
            `}</style>
        </Modal>
    );
}
