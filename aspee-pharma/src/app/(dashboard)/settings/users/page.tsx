'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import UserModal from '@/components/UserModal';
import { Plus, Users, Shield, UserCheck, UserX, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLog';
import { useSupabaseQuery } from '@/lib/hooks';

const roleColors: Record<string, { bg: string; color: string }> = {
    'Super Admin': { bg: 'linear-gradient(135deg, #7c3aed20, #8b5cf620)', color: '#7c3aed' },
    'Managing Director': { bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', color: '#1d4ed8' },
    'Sales Manager': { bg: '#cffafe', color: '#0e7490' },
    'Store Manager': { bg: '#d1fae5', color: '#047857' },
    'Purchasing Manager': { bg: '#fef3c7', color: '#92400e' },
    'Accountant': { bg: '#ede9fe', color: '#6d28d9' },
    'Production Manager': { bg: '#fce7f3', color: '#be185d' },
    'Van Sales Rep': { bg: '#cffafe', color: '#155e75' },
};

function formatLastLogin(value: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UserManagementPage() {
    const queryClient = useQueryClient();
    const { data, isLoading: loading } = useSupabaseQuery<any>('system_users', {
        orderBy: 'name',
        ascending: true,
    });
    const users = data ?? [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);

    const handleSave = async (formData: any) => {
        try {
            // ── Editing an existing user ──────────────────────────────────────
            if (formData.id) {
                const { id, ...updateData } = formData;
                const { error } = await supabase
                    .from('system_users')
                    .update(updateData)
                    .eq('id', id);
                if (error) throw error;

                await logAudit({
                    action: 'UPDATE',
                    module: 'Users',
                    description: `Updated user profile: ${updateData.email || id}`,
                    record_id: id,
                    record_type: 'system_users',
                    old_values: selectedUser,
                    new_values: updateData,
                });

                toast.success('User updated successfully');
                queryClient.invalidateQueries({ queryKey: ['system_users'] });
                return;
            }

            // ── Creating a new user ───────────────────────────────────────────
            // Call server-side API: creates Supabase auth account, inserts system_users row,
            // generates a temporary password and emails it to the new user.
            const res = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to create user');
            }

            toast.success(`Account created — login credentials sent to ${formData.email}`);

            await logAudit({
                action: 'CREATE',
                module: 'Users',
                description: `Created new user: ${formData.email} (${formData.role})`,
                record_id: json.user?.id,
                record_type: 'system_users',
                new_values: formData,
            });

            queryClient.invalidateQueries({ queryKey: ['system_users'] });
        } catch (error: any) {
            toast.error('Error saving user: ' + error.message);
            throw error;
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        try {
            const userToDelete = users.find((u: any) => u.id === id);
            const { error } = await supabase
                .from('system_users')
                .delete()
                .eq('id', id);
            if (error) throw error;

            await logAudit({
                action: 'DELETE',
                module: 'Users',
                description: `Deleted user: ${userToDelete?.email || id}`,
                record_id: id,
                record_type: 'system_users',
                old_values: userToDelete,
            });

            toast.success('User deleted');
            queryClient.invalidateQueries({ queryKey: ['system_users'] });
        } catch (error: any) {
            toast.error('Error deleting user: ' + error.message);
        }
    };

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status === 'Active').length;
    const inactiveUsers = users.filter((u) => u.status === 'Inactive').length;
    const mfaEnabled = users.filter((u) => u.mfa_enabled === true).length;

    const columns = [
        {
            key: 'name',
            label: 'Name',
            render: (v: unknown, row: Record<string, unknown>) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary-400), var(--accent-400))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                        {(v as string).split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: 11 }}>{v as string}</div>
                        <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{row.email as string}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'role',
            label: 'Role',
            render: (v: unknown) => {
                const style = roleColors[v as string] || { bg: 'var(--slate-100)', color: 'var(--slate-600)' };
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: style.bg, color: style.color,
                    }}>
                        {v as string}
                    </span>
                );
            },
        },
        { key: 'department', label: 'Department' },
        {
            key: 'last_login',
            label: 'Last Login',
            render: (v: unknown) => (
                <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                    {formatLastLogin(v as string | null)}
                </span>
            ),
        },
        {
            key: 'mfa_enabled',
            label: 'MFA',
            render: (v: unknown) => {
                const enabled = v === true;
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: enabled ? '#d1fae5' : '#fef2f2',
                        color: enabled ? '#047857' : '#dc2626',
                        border: `1px solid ${enabled ? '#a7f3d0' : '#fecaca'}`,
                    }}>
                        {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                );
            },
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => (
                <StatusBadge
                    status={v as string}
                    variant={v === 'Active' ? 'success' : 'danger'}
                />
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: unknown, row: Record<string, unknown>) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => {
                            setSelectedUser(row);
                            setIsModalOpen(true);
                        }}
                        style={actionButtonStyle}
                        title="Edit user"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id as string)}
                        style={{ ...actionButtonStyle, color: 'var(--danger)' }}
                        title="Delete user"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="User Management"
                subtitle="Manage system users, roles, and permissions"
                breadcrumbs={[
                    { label: 'Settings', href: '/settings/users' },
                    { label: 'User Management' },
                ]}
                actions={
                    <button
                        onClick={() => {
                            setSelectedUser(null);
                            setIsModalOpen(true);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                        }}
                    >
                        <Plus size={16} /> Add User
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Users" value={String(totalUsers)} icon={<Users size={20} />} color="blue" />
                <StatCard title="Active" value={String(activeUsers)} icon={<UserCheck size={20} />} color="green" />
                <StatCard title="Inactive" value={String(inactiveUsers)} icon={<UserX size={20} />} color="red" />
                <StatCard title="MFA Enabled" value={String(mfaEnabled)} icon={<Shield size={20} />} color="teal" />
            </div>

            {/* Roles Summary */}
            <div style={{
                background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)',
                padding: 20, marginBottom: 24,
            }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 14 }}>Roles Overview</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {Object.entries(roleColors).map(([role, style]) => {
                        const count = users.filter((u) => u.role === role).length;
                        return (
                            <div key={role} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 14px', borderRadius: 8, background: style.bg,
                                border: `1px solid ${style.color}20`,
                            }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: style.color }}>{role}</span>
                                <span style={{
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: style.color, color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 700,
                                }}>
                                    {count}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <DataTable
                columns={columns}
                data={users}
                searchPlaceholder="Search users by name, email, or role..."
            />

            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSave}
                record={selectedUser}
            />
        </div>
    );
}

const actionButtonStyle: React.CSSProperties = {
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid var(--slate-200)',
    background: 'var(--card-bg)',
    color: 'var(--slate-600)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
};
