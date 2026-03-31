'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    AlertCircle,
    Save,
    Search,
    Plus,
    Trash2,
    History,
    Calendar,
    Package,
    ClipboardList,
    FileText,
    Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import MaterialDefectHistoryModal from './MaterialDefectHistoryModal';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
}

interface ReportItem {
    product_id: string;
    product?: Product;
    batch_number: string;
    defect_type: string;
    quantity: number;
    expiry_date: string;
    remarks: string;
}

interface QAReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editingReport?: any;
}

export default function QAReportModal({ isOpen, onClose, onSuccess, editingReport }: QAReportModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [items, setItems] = useState<ReportItem[]>([]);
    const [type, setType] = useState('Critical Report');
    const [category, setCategory] = useState('Expiring Materials');
    const [priority, setPriority] = useState('Normal');
    const [notes, setNotes] = useState('');
    const [reportNumber, setReportNumber] = useState('');

    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyProductId, setHistoryProductId] = useState<string | null>(null);
    const [historyProductName, setHistoryProductName] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (editingReport) {
                setReportNumber(editingReport.report_number);
                setType(editingReport.type);
                setCategory(editingReport.category);
                setPriority(editingReport.priority);
                setNotes(editingReport.notes || '');
                fetchReportItems(editingReport.id);
            } else {
                setItems([]);
                generateReportNumber();
                setType('Critical Report');
                setCategory('Expiring Materials');
                setPriority('Normal');
                setNotes('');
            }
            fetchProducts();
        }
    }, [isOpen, editingReport]);

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

    const fetchReportItems = async (reportId: string) => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('qa_internal_report_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit)
                `)
                .eq('report_id', reportId);

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generateReportNumber = () => {
        const date = new Date();
        const timestamp = date.getTime().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        setReportNumber(`QA-REP-${timestamp}-${random}`);
    };

    const addProduct = (prod: Product) => {
        setItems(prev => [...prev, {
            product_id: prod.id,
            product: prod,
            batch_number: '',
            defect_type: category === 'Expiring Materials' ? 'Expired Material' : 'Standard',
            quantity: 1,
            expiry_date: '',
            remarks: ''
        }]);
        setSearchTerm('');
        setShowDropdown(false);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, updates: Partial<ReportItem>) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], ...updates };
            return newItems;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (items.length === 0) {
            toast.error('Add at least one item');
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

            let reportId = editingReport?.id;

            if (editingReport) {
                const { error } = await supabase
                    .from('qa_internal_reports')
                    .update({
                        type,
                        category,
                        priority,
                        notes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingReport.id);

                if (error) throw error;
                await supabase.from('qa_internal_report_items').delete().eq('report_id', editingReport.id);
            } else {
                const { data, error } = await supabase
                    .from('qa_internal_reports')
                    .insert([{
                        report_number: reportNumber,
                        type,
                        category,
                        priority,
                        notes,
                        requested_by: systemUser?.id,
                        status: 'Pending'
                    }])
                    .select()
                    .single();

                if (error) throw error;
                reportId = data.id;
            }

            const itemsToSave = items.map(item => ({
                report_id: reportId,
                product_id: item.product_id,
                batch_number: item.batch_number,
                defect_type: item.defect_type,
                quantity: item.quantity,
                expiry_date: item.expiry_date || null,
                remarks: item.remarks
            }));

            const { error: itemsError } = await supabase
                .from('qa_internal_report_items')
                .insert(itemsToSave);

            if (itemsError) throw itemsError;

            toast.success(editingReport ? 'Report updated' : 'Report submitted to QA');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error saving: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = allProducts.filter(p => {
        if (!searchTerm) return true;
        return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingReport ? "Edit QA Report" : "New QA Report/Requisition"}
            subtitle="Submit critical issues or material requisitions to Quality Assurance"
            width={950}
        >
            <form onSubmit={handleSubmit} className="qa-rep-form">
                <div className="form-grid">
                    <div className="form-field">
                        <label>Report #</label>
                        <div className="input-field disabled">
                            <FileText size={16} className="icon" />
                            <input value={reportNumber} readOnly />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Type</label>
                        <div className="input-field">
                            <select value={type} onChange={(e) => setType(e.target.value)}>
                                <option value="Critical Report">Critical Report</option>
                                <option value="Requisition">Requisition</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Category</label>
                        <div className="input-field">
                            <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="Expiring Materials">Expired Materials</option>
                                <option value="Controlled Materials">Controlled Materials</option>
                                <option value="Leakages">Leakages</option>
                                <option value="Breakages">Breakages</option>
                                <option value="Spillages">Spillages</option>
                                <option value="Contamination Issue">Contamination Issue</option>
                                <option value="Quality Deviation">Quality Deviation</option>
                                <option value="Other">Other Defect</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Priority</label>
                        <div className="input-field">
                            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                                <option value="Normal">Normal</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-field full-width" ref={searchRef}>
                        <label>Add Materials/Batches</label>
                        <div className="input-field">
                            <Search size={16} className="icon" />
                            <input
                                type="text"
                                placeholder="Search materials..."
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
                                    <div className="no-results">No materials found</div>
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
                                        <th style={{ width: 150 }}>Batch #</th>
                                        <th style={{ width: 140 }}>Issue Type</th>
                                        <th style={{ width: 80 }}>Qty</th>
                                        <th style={{ width: 140 }}>Expiry Date</th>
                                        <th>Remarks/Issue</th>
                                        <th style={{ width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="material-cell">
                                                    <div>
                                                        <div className="name">{item.product?.name}</div>
                                                        <div className="sku">{item.product?.sku}</div>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setHistoryProductId(item.product_id);
                                                            setHistoryProductName(item.product?.name || '');
                                                            setHistoryModalOpen(true);
                                                        }}
                                                        className="history-btn"
                                                        title="View History"
                                                    >
                                                        <Activity size={12} /> History
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.batch_number}
                                                    onChange={(e) => updateItem(index, { batch_number: e.target.value })}
                                                    className="inline-input"
                                                    placeholder="Batch ID"
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    value={item.defect_type}
                                                    onChange={(e) => updateItem(index, { defect_type: e.target.value })}
                                                    className="inline-input"
                                                >
                                                    <option value="Standard">Standard Issue</option>
                                                    <option value="Expired Material">Expired</option>
                                                    <option value="Leakage">Leakage</option>
                                                    <option value="Breakage">Breakage</option>
                                                    <option value="Spillage">Spillage</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                                                    className="inline-input"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="date"
                                                    value={item.expiry_date}
                                                    onChange={(e) => updateItem(index, { expiry_date: e.target.value })}
                                                    className="inline-input"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.remarks}
                                                    onChange={(e) => updateItem(index, { remarks: e.target.value })}
                                                    className="inline-input"
                                                    placeholder="Describe issue..."
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
                            <div className="no-items">Add materials using the search bar above</div>
                        )}
                    </div>

                    <div className="form-field full-width">
                        <label>Detailed Notes & History Context</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Provide additional context, history of the issue, etc."
                        />
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                    <button type="submit" disabled={loading || fetching} className="btn-save">
                        <Save size={16} />
                        {loading ? 'Submitting...' : 'Submit Report'}
                    </button>
                </div>
            </form>

            <MaterialDefectHistoryModal 
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                productId={historyProductId}
                productName={historyProductName}
            />

            <style>{`
                .qa-rep-form { margin-top: 10px; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .full-width { grid-column: span 2; }
                .form-field label { display: block; font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; margin-bottom: 8px; }
                .input-field { position: relative; display: flex; align-items: center; }
                .input-field .icon { position: absolute; left: 12px; color: var(--slate-400); }
                .input-field input, .input-field select, textarea {
                    width: 100%; padding: 10px 12px 10px 40px; border: 1.5px solid var(--slate-200);
                    border-radius: 10px; font-size: 13px; background: white; color: var(--slate-900); outline: none;
                }
                textarea { padding-left: 12px; }
                .disabled input { background: var(--slate-50); color: var(--slate-500); }
                .dropdown { position: absolute; width: 100%; background: white; border: 1px solid var(--slate-200); border-radius: 10px; z-index: 50; margin-top: 4px; max-height: 200px; overflow-y: auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .dropdown-item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--slate-50); }
                .dropdown-item:hover { background: var(--slate-50); }
                .items-table-container { border: 1px solid var(--slate-200); border-radius: 12px; overflow: visible; margin-top: 10px; }
                .items-table { width: 100%; border-collapse: collapse; overflow: visible; }
                .items-table th { background: #f8fafc; padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; }
                .items-table td { padding: 8px 10px; border-top: 1px solid #f1f5f9; font-size: 13px; }
                .material-cell { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
                .history-btn { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--slate-200); background: white; color: var(--primary-600); font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .history-btn:hover { background: var(--primary-50); border-color: var(--primary-200); }
                .inline-input { width: 100%; padding: 6px 8px; border: 1px solid var(--slate-100); border-radius: 6px; font-size: 12px; outline: none; }
                .inline-input:focus { border-color: var(--primary-400); }
                .remove-btn { color: var(--danger); border: none; background: none; cursor: pointer; padding: 5px; }
                .no-items { padding: 30px; text-align: center; color: var(--slate-400); font-style: italic; font-size: 13px; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
                .btn-cancel { padding: 10px 24px; border-radius: 10px; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-600); font-weight: 600; cursor: pointer; }
                .btn-save { display: flex; align-items: center; gap: 8px; padding: 10px 28px; border-radius: 10px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; font-weight: 600; border: none; cursor: pointer; }
            `}</style>
        </Modal>
    );
}
