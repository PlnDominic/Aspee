'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, User, Sun, Moon, CheckCircle2, Info, AlertCircle, XCircle, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

import GlobalSearch from './GlobalSearch';
import { useTheme } from '@/components/ThemeProvider';
import { useNotifications, useCurrentUser } from '@/lib/hooks';

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    const router = useRouter();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const { data: user } = useCurrentUser();
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOpenSearch = () => setIsSearchOpen(true);
        document.addEventListener('open-global-search', handleOpenSearch);

        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('open-global-search', handleOpenSearch);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            // router.refresh() clears the Next.js router cache so stale server data isn't served
            router.push('/login');
            router.refresh();
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 size={16} color="var(--success)" />;
            case 'warning': return <AlertCircle size={16} color="var(--warning)" />;
            case 'error': return <XCircle size={16} color="var(--danger)" />;
            default: return <Info size={16} color="var(--primary-500)" />;
        }
    };

    return (
        <>
            <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            <header
                style={{
                    height: 'var(--header-height)',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 32px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 40,
                    backdropFilter: 'blur(8px)',
                    borderBottom: '1px solid var(--divider)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>{title}</h1>
                    {subtitle && (
                        <p style={{ fontSize: 13, color: 'var(--slate-400)', fontWeight: 500 }}>{subtitle}</p>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Search */}
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: 12,
                            border: '1px solid var(--divider)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginRight: 8,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'var(--divider)';
                        }}
                    >
                        <Search size={18} color="var(--slate-400)" strokeWidth={1.5} />
                        <span style={{ fontSize: 13, color: 'var(--slate-400)', fontWeight: 500 }}>Search anything...</span>
                        <kbd
                            style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--divider)',
                                borderRadius: 6,
                                color: 'var(--slate-500)',
                                marginLeft: 16,
                                fontWeight: 600,
                            }}
                        >
                            ⌘K
                        </kbd>
                    </div>

                    {/* Shared Button Style */}
                    {(() => {
                        const iconButtonStyle: React.CSSProperties = {
                            width: 42,
                            height: 42,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 12,
                            border: '1px solid var(--divider)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            color: 'var(--slate-400)',
                        };

                        const onHover = (e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                            e.currentTarget.style.color = 'var(--foreground)';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.1)';
                        };

                        const onLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                            e.currentTarget.style.borderColor = 'var(--divider)';
                            e.currentTarget.style.color = 'var(--slate-400)';
                            e.currentTarget.style.boxShadow = 'none';
                        };

                        return (
                            <>
                                <div style={{ position: 'relative' }} ref={notificationRef}>
                                    <button
                                        onClick={() => setShowNotifications(!showNotifications)}
                                        style={iconButtonStyle}
                                        onMouseEnter={onHover}
                                        onMouseLeave={onLeave}
                                    >
                                        <Bell size={20} strokeWidth={1.5} />
                                        {unreadCount > 0 && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    top: -2,
                                                    right: -2,
                                                    minWidth: 18,
                                                    height: 18,
                                                    borderRadius: '50%',
                                                    background: 'var(--primary-500)',
                                                    border: '3px solid var(--background)',
                                                    color: 'white',
                                                    fontSize: '9px',
                                                    fontWeight: 800,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
                                                }}
                                            >
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>

                                    {showNotifications && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 12px)',
                                            right: 0,
                                            width: 340,
                                            background: 'var(--card-bg)',
                                            border: '1px solid var(--divider)',
                                            borderRadius: 16,
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                                            zIndex: 100,
                                            overflow: 'hidden',
                                            backdropFilter: 'blur(20px)',
                                        }}>
                                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
                                                {unreadCount > 0 && (
                                                    <button 
                                                        onClick={() => markAllAsRead.mutate()}
                                                        style={{ fontSize: 12, color: 'var(--primary-400)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                    >
                                                        Mark all read
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                                {notifications.length > 0 ? (
                                                    notifications.map((n: any) => (
                                                        <div 
                                                            key={n.id} 
                                                            onClick={() => {
                                                                if (!n.is_read) markAsRead.mutate(n.id);
                                                                if (n.link) window.location.href = n.link;
                                                                setShowNotifications(false);
                                                            }}
                                                            style={{
                                                                padding: '16px 20px',
                                                                borderBottom: '1px solid var(--divider)',
                                                                cursor: 'pointer',
                                                                background: n.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                                                display: 'flex',
                                                                gap: 14,
                                                                transition: 'background 0.2s ease'
                                                            }}
                                                        >
                                                            <div style={{ marginTop: 2 }}>{getIcon(n.type)}</div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--slate-900)', marginBottom: 4 }}>{n.title}</div>
                                                                <div style={{ fontSize: 12, color: 'var(--slate-400)', lineHeight: 1.5 }}>{n.message}</div>
                                                                <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 8 }}>{new Date(n.created_at).toLocaleString()}</div>
                                                            </div>
                                                            {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)', marginTop: 6, boxShadow: '0 0 10px var(--primary-500)' }} />}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--slate-500)', fontSize: 13 }}>
                                                        No new notifications
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={toggleTheme}
                                    style={iconButtonStyle} 
                                    onMouseEnter={onHover} 
                                    onMouseLeave={onLeave}
                                    title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                                >
                                    {theme === 'light' ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
                                </button>
                            </>
                        );
                    })()}

                    <div style={{ width: '1px', height: '24px', background: 'var(--divider)', margin: '0 8px' }} />

                    {/* User Avatar + Dropdown */}
                    <div style={{ position: 'relative' }} ref={userMenuRef}>
                        <div
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '4px',
                                borderRadius: 14,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: showUserMenu ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                border: '1px solid transparent',
                                ...(showUserMenu ? { borderColor: 'var(--divider)' } : {}),
                            }}
                            onMouseEnter={e => { if(!showUserMenu) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; }}
                            onMouseLeave={e => { if(!showUserMenu) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    background: user?.photo_url ? 'transparent' : 'linear-gradient(135deg, var(--primary-500), var(--secondary-500))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}
                            >
                                {user?.photo_url ? (
                                    <img 
                                        src={user.photo_url} 
                                        alt={user.name || 'User'} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
                                        {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : <User size={20} strokeWidth={2} />}
                                    </div>
                                )}
                            </div>
                            <div style={{ marginRight: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)', letterSpacing: '-0.01em' }}>{user?.name || 'Admin User'}</div>
                                <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 500 }}>{user?.role || 'Super Admin'}</div>
                            </div>
                            <ChevronDown size={14} color="var(--slate-500)" style={{ transition: 'transform 0.2s', transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                        </div>

                        {showUserMenu && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 12px)',
                                right: 0,
                                width: 220,
                                background: 'var(--card-bg)',
                                border: '1px solid var(--divider)',
                                borderRadius: 16,
                                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                zIndex: 100,
                                overflow: 'hidden',
                                backdropFilter: 'blur(20px)',
                            }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: user?.photo_url ? 'transparent' : 'linear-gradient(135deg, var(--primary-500), var(--secondary-500))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden', position: 'relative', flexShrink: 0
                                    }}>
                                        {user?.photo_url ? (
                                            <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
                                                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : <User size={18} />}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{user?.name || 'Admin User'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>{user?.role || 'Super Admin'}</div>
                                    </div>
                                </div>

                                <div style={{ padding: '8px' }}>
                                    <button
                                        onClick={() => { router.push('/settings/profile'); setShowUserMenu(false); }}
                                        style={menuItemStyle}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Settings size={16} strokeWidth={1.5} />
                                        Profile & Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loggingOut}
                                        style={{ ...menuItemStyle, color: '#f87171' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <LogOut size={16} strokeWidth={1.5} />
                                        {loggingOut ? 'Signing out...' : 'Sign Out'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}

const menuItemStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: 'var(--slate-700)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s ease',
};
