'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    ClipboardList,
    Save,
    Search,
    Plus,
    Trash2,
    History,
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
                .select('id, name, sku, unit')
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

    const filteredProducts = allProducts.filter(p => {
        const alreadyAdded = items.some(i => i.product_id === p.id);
        if (alreadyAdded) return false;
        if (!searchTerm) return true;
        return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingRequest ? "Edit Purchase Request" : "New Purchase Request"}
            subtitle="Request materials or components from the purchasing unit"
            width={900}
        >
            <form onSubmit={handleSubmit} className="pr-form">
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

                    <div className="form-field full-width" ref={searchRef}>
                        <label>Add Material/Component</label>
                        <div className="input-field">
                            <Search size={16} className="icon" />
                            <input
                                type="text"
                                placeholder="Search by name or SKU..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                            />
                        </div>
                        {showDropdown && (
                            <div className="dropdown">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.slice(0, 10).map(p => (
                                        <div key={p.id} className="dropdown-item" onClick={() => addProduct(p)}>
                                            <div className="name">{p.name}</div>
                                            <div className="sku">{p.sku}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-results">No products found</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="items-table-container full-width">
                        {items.length > 0 ? (
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th style={{ width: 100 }}>Qty</th>
                                        <th style={{ width: 120 }}>Unit</th>
                                        <th style={{ width: 220 }}>Purchase History</th>
                                        <th>Purpose</th>
                                        <th style={{ width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index}>
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
                                                />
                                            </td>
                                            <td>
                                                <div className="unit">{item.unit || item.product?.unit}</div>
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
                                                <button type="button" onClick={() => removeItem(index)} className="remove-btn">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="no-items">No items added. Use the search bar above to add materials.</div>
                        )}
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

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                    <button type="submit" disabled={loading || fetching} className="btn-save">
                        <Save size={16} />
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </form>

            <style>{`
                .pr-form { margin-top: 10px; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .full-width { grid-column: span 2; }
                .form-field label { display: block; font-size: 12px; font-weight: 600; color: var(--slate-700); margin-bottom: 8px; }
                .input-field { position: relative; display: flex; align-items: center; }
                .input-field .icon { position: absolute; left: 12px; color: var(--slate-400); }
                .input-field input, .input-field select, textarea {
                    width: 100%; padding: 10px 12px 10px 40px; border: 1.5px solid var(--slate-200);
                    border-radius: 10px; font-size: 13px; background: white; color: var(--slate-900); outline: none;
                    transition: border-color 0.2s;
                }
                textarea { padding-left: 12px; }
                .input-field input:focus { border-color: var(--primary-500); }
                .disabled input { background: var(--slate-50); color: var(--slate-500); }
                .dropdown {
                    position: absolute; width: 100%; background: white; border: 1px solid var(--slate-200);
                    border-radius: 10px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 50;
                    margin-top: 4px; max-height: 250px; overflow-y: auto;
                }
                .dropdown-item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--slate-50); }
                .dropdown-item:hover { background: var(--slate-50); }
                .dropdown-item .name { font-weight: 600; font-size: 13px; color: var(--slate-800); }
                .dropdown-item .sku { font-size: 11px; color: var(--slate-500); }
                .items-table-container { 
                    border: 1px solid var(--slate-200); border-radius: 12px; overflow: hidden;
                    background: var(--slate-50); margin-top: 10px;
                }
                .items-table { width: 100%; border-collapse: collapse; }
                .items-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; }
                .items-table td { padding: 12px; background: white; border-top: 1px solid #f1f5f9; font-size: 13px; }
                .items-table .name { font-weight: 600; color: var(--slate-900); }
                .items-table .sku { font-size: 11px; color: var(--slate-500); }
                .qty-input { width: 100%; padding: 8px; border: 1.5px solid var(--slate-100); border-radius: 6px; outline: none; }
                .purpose-input { width: 100%; padding: 8px; border: 1.5px solid var(--slate-100); border-radius: 6px; outline: none; font-size: 12px; }
                .history-box { display: flex; flex-direction: column; gap: 4px; }
                .history-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--slate-600); }
                .history-item b { color: var(--primary-600); }
                .remove-btn { color: var(--danger); border: none; background: none; cursor: pointer; padding: 5px; border-radius: 4px; }
                .remove-btn:hover { background: #fee2e2; }
                .no-items { padding: 30px; text-align: center; color: var(--slate-400); font-style: italic; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
                .btn-cancel { padding: 10px 24px; border-radius: 10px; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-600); font-weight: 600; cursor: pointer; }
                .btn-save {
                    display: flex; align-items: center; gap: 8px; padding: 10px 28px; border-radius: 10px;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500)); color: white;
                    font-weight: 600; border: none; cursor: pointer; transition: transform 0.2s;
                }
                .btn-save:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
                .btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
            `}</style>
        </Modal>
    );
}
