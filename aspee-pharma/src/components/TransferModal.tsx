'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { 
    ArrowLeftRight, 
    MapPin, 
    Package, 
    Plus, 
    Trash2, 
    Save, 
    Calendar,
    Hash,
    FileText,
    AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
}

interface Location {
    id: string;
    name: string;
    type: string;
}

interface TransferItem {
    product_id: string;
    product?: Product;
    quantity: number;
    current_stock?: number;
}

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
}

export default function TransferModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: TransferModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    
    const [transferNumber, setTransferNumber] = useState('');
    const [fromLocationId, setFromLocationId] = useState('');
    const [toLocationId, setToLocationId] = useState('');
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<TransferItem[]>([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchData();
            if (mode === 'create') {
                resetForm();
                generateTransferNumber();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    const fetchData = async () => {
        setFetching(true);
        try {
            const [prodRes, locRes] = await Promise.all([
                supabase.from('products').select('id, name, sku, unit').order('name'),
                supabase.from('stock_locations').select('*').order('name')
            ]);
            
            if (prodRes.error) throw prodRes.error;
            if (locRes.error) throw locRes.error;
            
            setProducts(prodRes.data || []);
            setLocations(locRes.data || []);
        } catch (error: any) {
            toast.error('Failed to fetch data: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generateTransferNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        setTransferNumber(`TRF-${year}${month}${day}-${random}`);
    };

    const resetForm = () => {
        setTransferNumber('');
        setFromLocationId('');
        setToLocationId('');
        setTransferDate(new Date().toISOString().split('T')[0]);
        setItems([{ product_id: '', quantity: 1 }]);
        setNotes('');
    };

    const populateForm = async (data: any) => {
        setTransferNumber(data.transfer_number || '');
        setFromLocationId(data.from_location_id || '');
        setToLocationId(data.to_location_id || '');
        setTransferDate(data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]);
        setNotes(data.notes || '');

        // Fetch items
        if (data.id) {
            const { data: itemsData, error } = await supabase
                .from('stock_transfer_items')
                .select('*, product:products(id, name, sku, unit)')
                .eq('transfer_id', data.id);
            
            if (error) {
                console.error('Error fetching items:', error);
            } else {
                setItems(itemsData || []);
            }
        }
    };

    const addItem = () => {
        setItems([...items, { product_id: '', quantity: 1 }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof TransferItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        if (field === 'product_id' && value) {
            const product = products.find(p => p.id === value);
            newItems[index].product = product;
        }
        
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!fromLocationId || !toLocationId) {
            toast.error('Please select both From and To locations');
            return;
        }

        if (fromLocationId === toLocationId) {
            toast.error('Source and Destination locations cannot be the same');
            return;
        }

        const validItems = items.filter(item => item.product_id && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Please add at least one valid item');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                transfer_number: transferNumber,
                from_location_id: fromLocationId,
                to_location_id: toLocationId,
                notes,
                status: 'Pending',
                items: validItems.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                }))
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving transfer:', error);
        } finally {
            setLoading(false);
        }
    };

    const isViewOnly = mode === 'view';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'New Stock Transfer' : isViewOnly ? 'Transfer Details' : 'Edit Transfer'}
            subtitle={mode === 'create' ? 'Move stock between locations' : `Reviewing transfer ${transferNumber}`}
            width={850}
        >
            <form onSubmit={handleSubmit} className="transfer-form">
                <div className="form-grid">
                    {/* Header Info */}
                    <div className="section-title full-width">Transfer Information</div>
                    
                    <div className="form-field">
                        <label>Transfer Number</label>
                        <div className="input-wrapper disabled">
                            <Hash size={16} className="icon" />
                            <input value={transferNumber} readOnly />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Date</label>
                        <div className="input-wrapper">
                            <Calendar size={16} className="icon" />
                            <input 
                                type="date" 
                                value={transferDate} 
                                onChange={(e) => setTransferDate(e.target.value)} 
                                readOnly={isViewOnly}
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Source Location (From) *</label>
                        <div className="input-wrapper">
                            <MapPin size={16} className="icon" />
                            <select 
                                required 
                                value={fromLocationId} 
                                onChange={(e) => setFromLocationId(e.target.value)}
                                disabled={isViewOnly}
                            >
                                <option value="">Select source</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Destination Location (To) *</label>
                        <div className="input-wrapper">
                            <MapPin size={16} className="icon" />
                            <select 
                                required 
                                value={toLocationId} 
                                onChange={(e) => setToLocationId(e.target.value)}
                                disabled={isViewOnly}
                            >
                                <option value="">Select destination</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="section-title full-width" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Transfer Items</span>
                        {!isViewOnly && (
                            <button type="button" onClick={addItem} className="btn-add-item">
                                <Plus size={14} /> Add Item
                            </button>
                        )}
                    </div>

                    <div className="items-container full-width">
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50%' }}>Product</th>
                                    <th style={{ width: '20%' }}>Unit</th>
                                    <th style={{ width: '20%' }}>Quantity</th>
                                    {!isViewOnly && <th style={{ width: '10%' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <select 
                                                required 
                                                value={item.product_id}
                                                onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                                disabled={isViewOnly}
                                                className="item-select"
                                            >
                                                <option value="">Select product</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div className="unit-display">{item.product?.unit || '-'}</div>
                                        </td>
                                        <td>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                                disabled={isViewOnly}
                                                className="item-input"
                                            />
                                        </td>
                                        {!isViewOnly && (
                                            <td>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeItem(index)}
                                                    className="btn-remove"
                                                    disabled={items.length === 1}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="form-field full-width">
                        <label>Notes</label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" style={{ top: 12 }} />
                            <textarea 
                                value={notes} 
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Purpose of transfer, driver info, etc."
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
                            {loading ? 'Saving...' : mode === 'edit' ? 'Update Transfer' : 'Save Transfer'}
                        </button>
                    </div>
                )}
            </form>

            <style>{`
                .transfer-form {
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
                
                .btn-add-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: var(--primary-50);
                    color: var(--primary-600);
                    border: 1px solid var(--primary-200);
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-add-item:hover {
                    background: var(--primary-100);
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
                    padding: 10px 16px;
                    border-bottom: 1px solid var(--slate-50);
                }
                .item-select, .item-input {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                }
                .unit-display {
                    font-size: 11px;
                    color: var(--slate-500);
                }
                .btn-remove {
                    color: var(--slate-400);
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .btn-remove:hover:not(:disabled) {
                    background: var(--danger-light);
                    color: var(--danger);
                }
                .btn-remove:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
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
                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(6, 182, 212, 0.3);
                }
            `}</style>
        </Modal>
    );
}
