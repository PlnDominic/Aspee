'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Package, Hash, Layers, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UNIT_OPTIONS, GROUPED_UNIT_OPTIONS } from '@/lib/constants';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit';
}

export default function ProductModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: ProductModalProps) {
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [materialType, setMaterialType] = useState<'Raw Material' | 'Packaging Material' | 'Finished Good' | 'Lab Consumables' | 'Factory Consumables' | 'Stationery & Printing Accessories' | 'General Consumables'>('Raw Material');
    const [unit, setUnit] = useState('Pieces');
    const [reorderLevel, setReorderLevel] = useState(10);
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (mode === 'create') {
                resetForm();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    const resetForm = () => {
        setName('');
        setSku('');
        setMaterialType('Raw Material');
        setUnit('Pieces');
        setReorderLevel(10);
        setDescription('');
    };

    const populateForm = (p: any) => {
        setName(p.name || '');
        setSku(p.sku || '');
        setMaterialType(p.material_type || 'Raw Material');
        setUnit(p.unit || 'Pieces');
        setReorderLevel(p.reorder_level || 10);
        setDescription(p.description || '');
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
                description
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

                    <div className="form-field">
                        <label>SKU / Item Code *</label>
                        <div className="input-wrapper">
                            <Hash size={16} className="icon" />
                            <input required value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PRD-001" />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Material Type *</label>
                        <div className="input-wrapper">
                            <Layers size={16} className="icon" />
                            <select required value={materialType} onChange={(e) => setMaterialType(e.target.value as any)}>
                                <option value="Raw Material">Raw Material</option>
                                <option value="Packaging Material">Packaging Material</option>
                                <option value="Lab Consumables">Lab Consumables</option>
                                <option value="Factory Consumables">Factory Consumables</option>
                                <option value="Stationery & Printing Accessories">Stationery & Printing Accessories</option>
                                <option value="General Consumables">General Consumables</option>
                                <option value="Finished Good">Finished Good</option>
                            </select>
                        </div>
                    </div>

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

                    <div className="form-field">
                        <label>Reorder Level</label>
                        <div className="input-wrapper">
                            <AlertTriangle size={16} className="icon" />
                            <input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(parseInt(e.target.value))} />
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
                    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1); /* safe transparent primary */
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
