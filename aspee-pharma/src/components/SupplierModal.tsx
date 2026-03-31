'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Building2, User, Phone, Mail, MapPin, Tag, CreditCard, Activity } from 'lucide-react';

interface Supplier {
    id?: string;
    name: string;
    contact_person: string;
    email: string;
    phone: string;
    address: string;
    category: 'Local' | 'Imported' | 'Other';
    payment_terms: string;
    status: 'Active' | 'Inactive';
}

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier) => Promise<void>;
    supplier?: Supplier | null;
}

const initialSupplier: Supplier = {
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    category: 'Local',
    payment_terms: 'Net 30',
    status: 'Active',
};

export default function SupplierModal({ isOpen, onClose, onSave, supplier }: SupplierModalProps) {
    const [formData, setFormData] = useState<Supplier>(initialSupplier);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (supplier) {
            setFormData(supplier);
        } else {
            setFormData(initialSupplier);
        }
    }, [supplier, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving supplier:', error);
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!supplier;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Supplier' : 'Add New Supplier'}
            subtitle={isEditing ? 'Update the supplier details below' : 'Fill in the details to register a new supplier'}
            width={640}
        >
            <form onSubmit={handleSubmit}>
                {/* Company Info Section */}
                <div className="supplier-form-section">
                    <div className="supplier-form-section-header">
                        <Building2 size={15} />
                        <span>Company Information</span>
                    </div>

                    <div className="supplier-form-field full-width">
                        <label className="supplier-form-label">
                            Supplier Name <span className="supplier-form-required">*</span>
                        </label>
                        <div className="supplier-form-input-wrapper">
                            <Building2 size={16} className="supplier-form-input-icon" />
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Acme Pharmaceuticals Ltd."
                                className="supplier-form-input has-icon"
                            />
                        </div>
                    </div>

                    <div className="supplier-form-row">
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Category</label>
                            <div className="supplier-form-input-wrapper">
                                <Tag size={16} className="supplier-form-input-icon" />
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                                    className="supplier-form-input has-icon"
                                >
                                    <option value="Local">Local</option>
                                    <option value="Imported">Imported</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Status</label>
                            <div className="supplier-form-input-wrapper">
                                <Activity size={16} className="supplier-form-input-icon" />
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className="supplier-form-input has-icon"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="supplier-form-section">
                    <div className="supplier-form-section-header">
                        <User size={15} />
                        <span>Contact Details</span>
                    </div>

                    <div className="supplier-form-field full-width">
                        <label className="supplier-form-label">Contact Person</label>
                        <div className="supplier-form-input-wrapper">
                            <User size={16} className="supplier-form-input-icon" />
                            <input
                                type="text"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                placeholder="e.g. John Mensah"
                                className="supplier-form-input has-icon"
                            />
                        </div>
                    </div>

                    <div className="supplier-form-row">
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Phone Number</label>
                            <div className="supplier-form-input-wrapper">
                                <Phone size={16} className="supplier-form-input-icon" />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+233 XX XXX XXXX"
                                    className="supplier-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Email Address</label>
                            <div className="supplier-form-input-wrapper">
                                <Mail size={16} className="supplier-form-input-icon" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contact@example.com"
                                    className="supplier-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Address & Payment Section */}
                <div className="supplier-form-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div className="supplier-form-section-header">
                        <MapPin size={15} />
                        <span>Address & Payment</span>
                    </div>

                    <div className="supplier-form-field full-width">
                        <label className="supplier-form-label">Payment Terms</label>
                        <div className="supplier-form-input-wrapper">
                            <CreditCard size={16} className="supplier-form-input-icon" />
                            <input
                                type="text"
                                value={formData.payment_terms}
                                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                placeholder="e.g. Net 30, Net 60, COD"
                                className="supplier-form-input has-icon"
                            />
                        </div>
                    </div>

                    <div className="supplier-form-field full-width">
                        <label className="supplier-form-label">Office Address</label>
                        <div className="supplier-form-input-wrapper textarea-wrapper">
                            <MapPin size={16} className="supplier-form-input-icon textarea-icon" />
                            <textarea
                                rows={3}
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Full physical address..."
                                className="supplier-form-textarea has-icon"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="supplier-form-actions">
                    <button
                        type="button"
                        onClick={onClose}
                        className="supplier-btn-cancel"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="supplier-btn-submit"
                    >
                        {loading ? (
                            <>
                                <span className="supplier-btn-spinner" />
                                Saving...
                            </>
                        ) : isEditing ? 'Update Supplier' : 'Add Supplier'}
                    </button>
                </div>
            </form>

            <style>{`
                .supplier-form-section {
                    border-bottom: 1px solid var(--slate-100);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }

                .supplier-form-section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--primary-600);
                    margin-bottom: 16px;
                }

                .supplier-form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                    margin-top: 14px;
                }

                .supplier-form-field {
                    display: flex;
                    flex-direction: column;
                }

                .supplier-form-field.full-width {
                    grid-column: span 2;
                }

                .supplier-form-label {
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }

                .supplier-form-required {
                    color: var(--danger);
                    margin-left: 2px;
                }

                .supplier-form-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .supplier-form-input-wrapper.textarea-wrapper {
                    align-items: flex-start;
                }

                .supplier-form-input-icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                    pointer-events: none;
                    transition: color 0.2s ease;
                    flex-shrink: 0;
                }

                .supplier-form-input-icon.textarea-icon {
                    top: 12px;
                }

                .supplier-form-input,
                .supplier-form-textarea {
                    width: 100%;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    font-size: 11px;
                    color: var(--slate-800);
                    background: var(--card-bg);
                    outline: none;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .supplier-form-input.has-icon,
                .supplier-form-textarea.has-icon {
                    padding-left: 38px;
                }

                .supplier-form-textarea {
                    resize: vertical;
                    min-height: 80px;
                }

                .supplier-form-input:hover,
                .supplier-form-textarea:hover {
                    border-color: var(--slate-300);
                }

                .supplier-form-input:focus,
                .supplier-form-textarea:focus {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 3px var(--primary-50);
                }

                .supplier-form-input:focus + .supplier-form-input-icon,
                .supplier-form-input-wrapper:focus-within .supplier-form-input-icon {
                    color: var(--primary-500);
                }

                .supplier-form-input::placeholder,
                .supplier-form-textarea::placeholder {
                    color: var(--slate-400);
                }

                select.supplier-form-input {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    padding-right: 36px;
                    cursor: pointer;
                }

                .supplier-form-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--slate-100);
                }

                .supplier-btn-cancel {
                    padding: 10px 22px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .supplier-btn-cancel:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                    color: var(--slate-700);
                }

                .supplier-btn-submit {
                    padding: 10px 28px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: inherit;
                }

                .supplier-btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, var(--primary-700), var(--primary-600));
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                    transform: translateY(-1px);
                }

                .supplier-btn-submit:active:not(:disabled) {
                    transform: translateY(0);
                }

                .supplier-btn-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .supplier-btn-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: supplierSpin 0.6s linear infinite;
                }

                @keyframes supplierSpin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 640px) {
                    .supplier-form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </Modal>
    );
}
