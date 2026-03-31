'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Truck, User, Phone, MapPin, Hash, Banknote, Activity, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface VanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    record?: any;
}

const initialForm = {
    van_id: '',
    plate_number: '',
    driver_name: '',
    driver_phone: '',
    route_area: '',
    loaded_value: 0,
    status: 'At Depot',
    notes: '',
};

export default function VanModal({ isOpen, onClose, onSuccess, record }: VanModalProps) {
    const [formData, setFormData] = useState(initialForm);
    const [loading, setLoading] = useState(false);

    const isEditing = !!record;

    useEffect(() => {
        if (record) {
            setFormData({
                van_id: record.van_id || '',
                plate_number: record.plate_number || '',
                driver_name: record.driver_name || '',
                driver_phone: record.driver_phone || '',
                route_area: record.route_area || '',
                loaded_value: record.loaded_value || 0,
                status: record.status || 'At Depot',
                notes: record.notes || '',
            });
        } else {
            generateVanId();
        }
    }, [record, isOpen]);

    const generateVanId = async () => {
        try {
            const { data, error } = await supabase
                .from('vans')
                .select('van_id')
                .order('created_at', { ascending: false })
                .limit(1);

            let nextNum = 1;
            if (!error && data && data.length > 0) {
                const lastId = data[0].van_id;
                const match = lastId?.match(/VAN-(\d+)/);
                if (match) {
                    nextNum = parseInt(match[1], 10) + 1;
                }
            }
            const newId = `VAN-${String(nextNum).padStart(3, '0')}`;
            setFormData({ ...initialForm, van_id: newId });
        } catch {
            setFormData({ ...initialForm, van_id: 'VAN-001' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEditing) {
                const { van_id, ...updateData } = formData;
                const { error } = await supabase
                    .from('vans')
                    .update(updateData)
                    .eq('id', record.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('vans')
                    .insert([formData]);
                if (error) throw error;
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving van:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Van' : 'Add New Van'}
            subtitle={isEditing ? 'Update the van and driver details below' : 'Register a new van for route operations'}
            width={640}
        >
            <form onSubmit={handleSubmit}>
                {/* Van Details */}
                <div className="van-form-section">
                    <div className="van-form-section-header">
                        <Truck size={15} />
                        <span>Van Details</span>
                    </div>

                    <div className="van-form-row">
                        <div className="van-form-field">
                            <label className="van-form-label">
                                Van ID <span className="van-form-required">*</span>
                            </label>
                            <div className="van-form-input-wrapper">
                                <Hash size={16} className="van-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={formData.van_id}
                                    readOnly
                                    className="van-form-input has-icon"
                                    style={{ background: 'var(--slate-50)', cursor: 'not-allowed' }}
                                />
                            </div>
                        </div>

                        <div className="van-form-field">
                            <label className="van-form-label">
                                Plate Number <span className="van-form-required">*</span>
                            </label>
                            <div className="van-form-input-wrapper">
                                <Truck size={16} className="van-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={formData.plate_number}
                                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                                    placeholder="e.g. GR-1234-24"
                                    className="van-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Driver Info */}
                <div className="van-form-section">
                    <div className="van-form-section-header">
                        <User size={15} />
                        <span>Driver Information</span>
                    </div>

                    <div className="van-form-row">
                        <div className="van-form-field">
                            <label className="van-form-label">
                                Driver Name <span className="van-form-required">*</span>
                            </label>
                            <div className="van-form-input-wrapper">
                                <User size={16} className="van-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={formData.driver_name}
                                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                    placeholder="e.g. Kwame Mensah"
                                    className="van-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="van-form-field">
                            <label className="van-form-label">Driver Phone</label>
                            <div className="van-form-input-wrapper">
                                <Phone size={16} className="van-form-input-icon" />
                                <input
                                    type="tel"
                                    value={formData.driver_phone}
                                    onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                                    placeholder="+233 XX XXX XXXX"
                                    className="van-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Route & Operations */}
                <div className="van-form-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div className="van-form-section-header">
                        <MapPin size={15} />
                        <span>Route & Operations</span>
                    </div>

                    <div className="van-form-row">
                        <div className="van-form-field">
                            <label className="van-form-label">
                                Route Area <span className="van-form-required">*</span>
                            </label>
                            <div className="van-form-input-wrapper">
                                <MapPin size={16} className="van-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={formData.route_area}
                                    onChange={(e) => setFormData({ ...formData, route_area: e.target.value })}
                                    placeholder="e.g. Kumasi Central"
                                    className="van-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="van-form-field">
                            <label className="van-form-label">Loaded Value (GH₵)</label>
                            <div className="van-form-input-wrapper">
                                <Banknote size={16} className="van-form-input-icon" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.loaded_value}
                                    onChange={(e) => setFormData({ ...formData, loaded_value: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="van-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="van-form-row" style={{ marginTop: 14 }}>
                        <div className="van-form-field">
                            <label className="van-form-label">Status</label>
                            <div className="van-form-input-wrapper">
                                <Activity size={16} className="van-form-input-icon" />
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="van-form-input has-icon"
                                >
                                    <option value="At Depot">At Depot</option>
                                    <option value="Loading">Loading</option>
                                    <option value="On Route">On Route</option>
                                    <option value="Returning">Returning</option>
                                    <option value="Maintenance">Maintenance</option>
                                </select>
                            </div>
                        </div>

                        <div className="van-form-field">
                            <label className="van-form-label">Notes</label>
                            <div className="van-form-input-wrapper">
                                <FileText size={16} className="van-form-input-icon" />
                                <input
                                    type="text"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Optional notes..."
                                    className="van-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="van-form-actions">
                    <button
                        type="button"
                        onClick={onClose}
                        className="van-btn-cancel"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="van-btn-submit"
                    >
                        {loading ? (
                            <>
                                <span className="van-btn-spinner" />
                                Saving...
                            </>
                        ) : isEditing ? 'Update Van' : 'Add Van'}
                    </button>
                </div>
            </form>

            <style>{`
                .van-form-section {
                    border-bottom: 1px solid var(--slate-100);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }

                .van-form-section-header {
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

                .van-form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                }

                .van-form-field {
                    display: flex;
                    flex-direction: column;
                }

                .van-form-field.full-width {
                    grid-column: span 2;
                }

                .van-form-label {
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }

                .van-form-required {
                    color: var(--danger);
                    margin-left: 2px;
                }

                .van-form-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .van-form-input-icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                    pointer-events: none;
                    transition: color 0.2s ease;
                    flex-shrink: 0;
                }

                .van-form-input {
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

                .van-form-input.has-icon {
                    padding-left: 38px;
                }

                .van-form-input:hover {
                    border-color: var(--slate-300);
                }

                .van-form-input:focus {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 3px var(--primary-50);
                }

                .van-form-input-wrapper:focus-within .van-form-input-icon {
                    color: var(--primary-500);
                }

                .van-form-input::placeholder {
                    color: var(--slate-400);
                }

                select.van-form-input {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    padding-right: 36px;
                    cursor: pointer;
                }

                .van-form-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--slate-100);
                }

                .van-btn-cancel {
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

                .van-btn-cancel:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                    color: var(--slate-700);
                }

                .van-btn-submit {
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

                .van-btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, var(--primary-700), var(--primary-600));
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                    transform: translateY(-1px);
                }

                .van-btn-submit:active:not(:disabled) {
                    transform: translateY(0);
                }

                .van-btn-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .van-btn-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: vanSpin 0.6s linear infinite;
                }

                @keyframes vanSpin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 640px) {
                    .van-form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </Modal>
    );
}
