'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Save, Camera, Shield, Bell, Globe, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser, useAction } from '@/lib/hooks';
import { toast } from 'sonner';

export default function ProfilePage() {
    const [activeTab, setActiveTab] = useState<'general' | 'security' | 'notifications'>('general');

    const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

    const [profile, setProfile] = useState({
        full_name: '',
        email: '',
        phone: '',
        job_title: '',
    });

    const [notificationsPrefs, setNotificationsPrefs] = useState({
        low_stock_alerts: true,
        expiry_alerts: true,
        order_updates: true,
        payment_reminders: false,
        daily_summary: false,
        system_updates: true,
    });

    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Password change state
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [updatingPassword, setUpdatingPassword] = useState(false);

    // Sync profile state when currentUser loads
    useEffect(() => {
        if (currentUser) {
            setProfile({
                full_name: currentUser.name || '',
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                job_title: currentUser.job_title || '',
            });
            setPhotoUrl(currentUser.photo_url || null);
            if (currentUser.notification_preferences) {
                setNotificationsPrefs({
                    ...notificationsPrefs,
                    ...currentUser.notification_preferences
                });
            }
        }
    }, [currentUser]);

    const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            const { data: auth } = await supabase.auth.getUser();
            const user = auth?.user;
            
            if (!user) {
                toast.error('You must be logged in to upload a photo');
                setUploading(false);
                return;
            }

            const file = event.target.files?.[0];
            
            if (!file) {
                setUploading(false);
                return;
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                setUploading(false);
                return;
            }

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                toast.error('File size must be less than 2MB');
                setUploading(false);
                return;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatar')
                .upload(filePath, file);

            if (uploadError) {
                // If bucket doesn't exist, create it
                if (uploadError.message.includes('not found')) {
                    toast.error('Avatar storage not configured. Please contact administrator.');
                } else {
                    throw uploadError;
                }
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatar')
                .getPublicUrl(filePath);

            // Update user profile with new photo URL
            if (user?.id) {
                const updateData = { photo_url: publicUrl, updated_at: new Date().toISOString() };
                
                const { data: existing } = await supabase
                    .from('system_users')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();

                if (!existing?.id) {
                    throw new Error('Profile record not found. Contact an administrator.');
                }

                await supabase
                    .from('system_users')
                    .update(updateData)
                    .eq('id', existing.id);

                setPhotoUrl(publicUrl);
                toast.success('Profile photo updated successfully');
            }

        } catch (error: any) {
            console.error('Error uploading photo:', error);
            toast.error('Failed to upload photo: ' + error.message);
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const initials = useMemo(() => {
        const parts = (profile.full_name || 'User').trim().split(/\s+/);
        return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
    }, [profile.full_name]);

    const saveProfile = useAction<typeof profile>({
        mutationFn: async (profileData) => {
            const { data: auth } = await supabase.auth.getUser();
            const user = auth?.user;
            if (!user?.id) {
                throw new Error('You are not signed in');
            }

            const updateData: any = {
                name: profileData.full_name,
                email: profileData.email,
                phone: profileData.phone,
                job_title: profileData.job_title,
                notification_preferences: notificationsPrefs,
                updated_at: new Date().toISOString(),
            };

            // Prefer updating existing row by auth_user_id; if none exists, upsert.
            const { data: existing, error: findError } = await supabase
                .from('system_users')
                .select('id')
                .eq('auth_user_id', user.id)
                .maybeSingle();

            if (findError) throw findError;

            if (!existing?.id) {
                throw new Error('Profile record not found. Contact an administrator.');
            }

            const { error } = await supabase
                .from('system_users')
                .update(updateData)
                .eq('id', existing.id);
            if (error) throw error;
        },
        invalidateKeys: ['currentUser'],
        successMessage: 'Profile saved',
    });

    const handleSave = () => {
        saveProfile.mutate(profile);
    };

    const handlePasswordChange = async () => {
        // Validate passwords
        if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
            toast.error('Please fill in all password fields');
            return;
        }

        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwords.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.newPassword
            });

            if (error) throw error;

            toast.success('Password updated successfully');
            
            // Clear password fields
            setPasswords({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });

        } catch (error: any) {
            console.error('Error updating password:', error);
            toast.error('Failed to update password: ' + error.message);
        } finally {
            setUpdatingPassword(false);
        }
    };

    const tabs = [
        { key: 'general', label: 'General', icon: <Globe size={16} /> },
        { key: 'security', label: 'Security', icon: <Shield size={16} /> },
        { key: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ] as const;

    if (isUserLoading) {
        return (
            <div className="animate-fade-in">
                <PageHeader
                    title="Profile"
                    subtitle="Manage your account settings and preferences"
                    breadcrumbs={[{ label: 'Settings', href: '/settings/profile' }, { label: 'Profile' }]}
                />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            border: '3px solid var(--slate-200)',
                            borderTopColor: 'var(--primary-500)',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 16px',
                        }}></div>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>Loading profile...</p>
                    </div>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Profile"
                subtitle="Manage your account settings and preferences"
                breadcrumbs={[{ label: 'Settings', href: '/settings/profile' }, { label: 'Profile' }]}
            />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--slate-100)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 18px', borderRadius: 8, border: 'none',
                            background: activeTab === tab.key ? 'white' : 'transparent',
                            color: activeTab === tab.key ? 'var(--primary-600)' : 'var(--slate-500)',
                            fontSize: 11, fontWeight: activeTab === tab.key ? 600 : 500,
                            cursor: 'pointer',
                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Profile Photo Card */}
                    <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28, gridColumn: '1 / -1' }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 20 }}>Profile Photo</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: photoUrl ? 'transparent' : 'linear-gradient(135deg, var(--primary-500), var(--accent-500))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: 'white',
                                overflow: 'hidden',
                                border: photoUrl ? '2px solid var(--slate-200)' : 'none',
                            }}>
                                {photoUrl ? (
                                    <img 
                                        src={photoUrl} 
                                        alt="Profile" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    initials
                                )}
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 16px', borderRadius: 8, border: '1px solid var(--slate-200)',
                                        background: uploading ? 'var(--slate-100)' : 'var(--card-bg)',
                                        fontSize: 11, fontWeight: 500, 
                                        color: uploading ? 'var(--slate-400)' : 'var(--slate-700)', 
                                        cursor: uploading ? 'not-allowed' : 'pointer',
                                        opacity: uploading ? 0.7 : 1,
                                    }}
                                >
                                    {uploading ? (
                                        <>
                                            <div style={{
                                                width: 16, height: 16, borderRadius: '50%',
                                                border: '2px solid var(--slate-300)',
                                                borderTopColor: 'var(--primary-500)',
                                                animation: 'spin 1s linear infinite',
                                            }}></div>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={16} /> Change Photo
                                        </>
                                    )}
                                </button>
                                <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 8 }}>JPG, PNG or GIF. Max 2MB.</p>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Personal Information */}
                    <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 20 }}>Personal Information</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                { key: 'full_name', label: 'Full Name', type: 'text' },
                                { key: 'email', label: 'Email Address', type: 'email' },
                                { key: 'phone', label: 'Phone Number', type: 'tel' },
                                { key: 'job_title', label: 'Job Title', type: 'text' },
                            ].map((field, i) => (
                                <div key={i}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 6 }}>
                                        {field.label}
                                    </label>
                                    <input
                                        type={field.type}
                                        value={(profile as any)[field.key] || ''}
                                        onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}
                                        readOnly={field.key === 'email'}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: 8,
                                            border: '1px solid var(--slate-200)', fontSize: 11,
                                            color: 'var(--slate-800)', outline: 'none',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onFocus={(e) => {
                                            if (field.key !== 'email') e.currentTarget.style.borderColor = 'var(--primary-500)';
                                        }}
                                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--slate-200)'}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handleSave}
                            disabled={saveProfile.isPending}
                            style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 24px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(6, 182, 212, 0.3)',
                        }}>
                            <Save size={16} /> {saveProfile.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <div style={{ maxWidth: 600 }}>
                    <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28, marginBottom: 20 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 20 }}>Change Password</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 6 }}>Current Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type={showPasswords.current ? 'text' : 'password'} 
                                        placeholder="••••••••" 
                                        value={passwords.currentPassword}
                                        onChange={(e) => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: 8,
                                            border: '1px solid var(--slate-200)', fontSize: 11, outline: 'none',
                                            paddingRight: '40px'
                                        }} 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                                        style={{
                                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                            color: 'var(--slate-500)'
                                        }}
                                    >
                                        {showPasswords.current ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 6 }}>New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type={showPasswords.new ? 'text' : 'password'} 
                                        placeholder="••••••••" 
                                        value={passwords.newPassword}
                                        onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: 8,
                                            border: '1px solid var(--slate-200)', fontSize: 11, outline: 'none',
                                            paddingRight: '40px'
                                        }} 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                                        style={{
                                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                            color: 'var(--slate-500)'
                                        }}
                                    >
                                        {showPasswords.new ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--slate-600)', marginBottom: 6 }}>Confirm New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type={showPasswords.confirm ? 'text' : 'password'} 
                                        placeholder="••••••••" 
                                        value={passwords.confirmPassword}
                                        onChange={(e) => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: 8,
                                            border: '1px solid var(--slate-200)', fontSize: 11, outline: 'none',
                                            paddingRight: '40px'
                                        }} 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                                        style={{
                                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                            color: 'var(--slate-500)'
                                        }}
                                    >
                                        {showPasswords.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={handlePasswordChange}
                                disabled={updatingPassword}
                                style={{
                                    width: 'fit-content', padding: '10px 20px', borderRadius: 8, border: 'none',
                                    background: updatingPassword ? 'var(--slate-300)' : 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                    fontSize: 11, fontWeight: 600, color: 'white', cursor: updatingPassword ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    opacity: updatingPassword ? 0.7 : 1,
                                }}
                            >
                                {updatingPassword ? (
                                    <>
                                        <div style={{
                                            width: 14, height: 14, borderRadius: '50%',
                                            border: '2px solid var(--slate-400)',
                                            borderTopColor: 'white',
                                            animation: 'spin 1s linear infinite',
                                        }}></div>
                                        Updating...
                                    </>
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div style={{ maxWidth: 600 }}>
                    <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', padding: 28 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 20 }}>Notification Preferences</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                { key: 'low_stock_alerts', label: 'Low Stock Alerts', desc: 'Get notified when products fall below reorder level' },
                                { key: 'expiry_alerts', label: 'Expiry Alerts', desc: 'Notifications for products nearing expiry date' },
                                { key: 'order_updates', label: 'Order Updates', desc: 'Updates on purchase orders and delivery status' },
                                { key: 'payment_reminders', label: 'Payment Reminders', desc: 'Reminders for overdue customer invoices' },
                                { key: 'daily_summary', label: 'Daily Summary', desc: 'End-of-day summary of sales and stock movements' },
                                { key: 'system_updates', label: 'System Updates', desc: 'Notifications about maintenance and new features' },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '14px 16px', borderRadius: 8, background: 'var(--slate-50)',
                                    border: '1px solid var(--slate-100)',
                                }}>
                                    <div>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-800)' }}>{item.label}</p>
                                        <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>{item.desc}</p>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={(notificationsPrefs as any)[item.key]} 
                                        onChange={(e) => setNotificationsPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                        style={{
                                            width: 20, height: 20, accentColor: 'var(--primary-500)', cursor: 'pointer',
                                        }} 
                                    />
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => handleSave()}
                                disabled={saveProfile.isPending}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 24px', borderRadius: 8, border: 'none',
                                    background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                    fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(6, 182, 212, 0.3)',
                                }}>
                                <Save size={16} /> {saveProfile.isPending ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
