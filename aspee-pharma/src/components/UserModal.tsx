'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { User, Mail, Phone, Shield, Building2, Activity, Lock } from 'lucide-react';

interface UserFormData {
    id?: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    status: 'Active' | 'Inactive';
    mfa_enabled: boolean;
}

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: UserFormData) => Promise<void>;
    record?: any;
}

const roles = [
    'Super Admin',
    'Managing Director',
    'Sales Manager',
    'Store Manager',
    'Purchasing Manager',
    'Accountant',
    'Production Manager',
    'Van Sales Rep',
    'Quality Assurance',
    'HR Manager',
    'Internal Auditor'
];

const departments = [
    'Administration',
    'Sales',
    'Stores',
    'Purchasing',
    'Accounts',
    'Production',
    'Quality Assurance',
    'Human Resources',
    'Internal Audit'
];

const initialFormData: UserFormData = {
    name: '',
    email: '',
    phone: '',
    role: 'Sales Manager',
    department: 'Sales',
    status: 'Active',
    mfa_enabled: false,
};

export default function UserModal({ isOpen, onClose, onSuccess, record }: UserModalProps) {
    const [formData, setFormData] = useState<UserFormData>(initialFormData);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (record) {
            setFormData({
                id: record.id,
                name: record.name || '',
                email: record.email || '',
                phone: record.phone || '',
                role: record.role || 'Sales Manager',
                department: record.department || 'Sales',
                status: record.status || 'Active',
                mfa_enabled: record.mfa_enabled || false,
            });
        } else {
            setFormData(initialFormData);
        }
    }, [record, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSuccess(formData);
            onClose();
        } catch (error) {
            console.error('Error saving user:', error);
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!record;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit User' : 'Add New User'}
            subtitle={isEditing ? 'Update the user details below' : 'Fill in the details to create a new system user'}
            width={640}
        >
            <form onSubmit={handleSubmit}>
                {/* Personal Info Section */}
                <div className="user-form-section">
                    <div className="user-form-section-header">
                        <User size={15} />
                        <span>Personal Information</span>
                    </div>

                    <div className="user-form-field full-width">
                        <label className="user-form-label">
                            Full Name <span className="user-form-required">*</span>
                        </label>
                        <div className="user-form-input-wrapper">
                            <User size={16} className="user-form-input-icon" />
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Kwame Asante"
                                className="user-form-input has-icon"
                            />
                        </div>
                    </div>

                    <div className="user-form-row">
                        <div className="user-form-field">
                            <label className="user-form-label">
                                Email <span className="user-form-required">*</span>
                            </label>
                            <div className="user-form-input-wrapper">
                                <Mail size={16} className="user-form-input-icon" />
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="user@aspeepharma.com"
                                    className="user-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="user-form-field">
                            <label className="user-form-label">Phone</label>
                            <div className="user-form-input-wrapper">
                                <Phone size={16} className="user-form-input-icon" />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+233 XX XXX XXXX"
                                    className="user-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Role & Access Section */}
                <div className="user-form-section">
                    <div className="user-form-section-header">
                        <Shield size={15} />
                        <span>Role & Access</span>
                    </div>

                    <div className="user-form-row">
                        <div className="user-form-field">
                            <label className="user-form-label">
                                Role <span className="user-form-required">*</span>
                            </label>
                            <div className="user-form-input-wrapper">
                                <Shield size={16} className="user-form-input-icon" />
                                <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="user-form-input has-icon"
                                >
                                    {roles.map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="user-form-field">
                            <label className="user-form-label">
                                Department <span className="user-form-required">*</span>
                            </label>
                            <div className="user-form-input-wrapper">
                                <Building2 size={16} className="user-form-input-icon" />
                                <select
                                    required
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="user-form-input has-icon"
                                >
                                    {departments.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status & Security Section */}
                <div className="user-form-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div className="user-form-section-header">
                        <Lock size={15} />
                        <span>Status & Security</span>
                    </div>

                    <div className="user-form-row">
                        <div className="user-form-field">
                            <label className="user-form-label">Status</label>
                            <div className="user-form-input-wrapper">
                                <Activity size={16} className="user-form-input-icon" />
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className="user-form-input has-icon"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="user-form-field">
                            <label className="user-form-label">Multi-Factor Authentication</label>
                            <div
                                className="user-form-checkbox-wrapper"
                                onClick={() => setFormData({ ...formData, mfa_enabled: !formData.mfa_enabled })}
                            >
                                <div className={`user-form-toggle ${formData.mfa_enabled ? 'active' : ''}`}>
                                    <div className="user-form-toggle-dot" />
                                </div>
                                <span className="user-form-checkbox-label">
                                    {formData.mfa_enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="user-form-actions">
                    <button
                        type="button"
                        onClick={onClose}
                        className="user-btn-cancel"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="user-btn-submit"
                    >
                        {loading ? (
                            <>
                                <span className="user-btn-spinner" />
                                Saving...
                            </>
                        ) : isEditing ? 'Update User' : 'Add User'}
                    </button>
                </div>
            </form>

            <style>{`
                .user-form-section {
                    border-bottom: 1px solid var(--slate-100);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }

                .user-form-section-header {
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

                .user-form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                    margin-top: 14px;
                }

                .user-form-field {
                    display: flex;
                    flex-direction: column;
                }

                .user-form-field.full-width {
                    grid-column: span 2;
                }

                .user-form-label {
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }

                .user-form-required {
                    color: var(--danger);
                    margin-left: 2px;
                }

                .user-form-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .user-form-input-icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                    pointer-events: none;
                    transition: color 0.2s ease;
                    flex-shrink: 0;
                }

                .user-form-input {
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

                .user-form-input.has-icon {
                    padding-left: 38px;
                }

                .user-form-input:hover {
                    border-color: var(--slate-300);
                }

                .user-form-input:focus {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 3px var(--primary-50);
                }

                .user-form-input-wrapper:focus-within .user-form-input-icon {
                    color: var(--primary-500);
                }

                .user-form-input::placeholder {
                    color: var(--slate-400);
                }

                select.user-form-input {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    padding-right: 36px;
                    cursor: pointer;
                }

                .user-form-checkbox-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                }

                .user-form-checkbox-wrapper:hover {
                    border-color: var(--slate-300);
                    background: var(--slate-50);
                }

                .user-form-toggle {
                    width: 36px;
                    height: 20px;
                    border-radius: 10px;
                    background: var(--slate-300);
                    position: relative;
                    transition: background 0.2s ease;
                    flex-shrink: 0;
                }

                .user-form-toggle.active {
                    background: var(--primary-500);
                }

                .user-form-toggle-dot {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--card-bg);
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    transition: transform 0.2s ease;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                }

                .user-form-toggle.active .user-form-toggle-dot {
                    transform: translateX(16px);
                }

                .user-form-checkbox-label {
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--slate-600);
                }

                .user-form-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--slate-100);
                }

                .user-btn-cancel {
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

                .user-btn-cancel:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                    color: var(--slate-700);
                }

                .user-btn-submit {
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

                .user-btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, var(--primary-700), var(--primary-600));
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                    transform: translateY(-1px);
                }

                .user-btn-submit:active:not(:disabled) {
                    transform: translateY(0);
                }

                .user-btn-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .user-btn-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: userSpin 0.6s linear infinite;
                }

                @keyframes userSpin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 640px) {
                    .user-form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </Modal>
    );
}
