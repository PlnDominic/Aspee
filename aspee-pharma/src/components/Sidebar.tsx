'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    Warehouse,
    Factory,
    Truck,
    Receipt,
    Users,
    Calculator,
    ShoppingCart,
    ClipboardList,
    FileCheck,
    Boxes,
    BarChart3,
    ArrowLeftRight,
    FileText,
    CreditCard,
    Send,
    BookOpen,
    Banknote,
    Landmark,
    Coins,
    ChevronDown,
    ChevronRight,
    PanelLeftClose,
    PanelLeft,
    Pill,
    Settings,
    UserCog,
    User,
    Activity,
    ShieldCheck,
    PieChart,
    Search,
    UserCircle,
    AlertTriangle,
    CalendarDays,
    Eye,
    Scale,
    Briefcase,
    Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { useCurrentUser } from '@/lib/hooks';

// ── Role-based access (mirrors middleware routePermissions) ──────────────────
// Maps a route prefix → roles allowed to see it.
// Routes not listed are visible to every authenticated user.
// 'Super Admin' always bypasses all checks.
const ROUTE_ROLES: Record<string, string[]> = {
    '/stores/sales-requests': ['Super Admin', 'Store Manager'],
    '/sales/requests':      ['Super Admin', 'Sales Manager', 'Van Sales Rep', 'Store Manager'],
    '/sales':               ['Super Admin', 'Sales Manager', 'Van Sales Rep'],
    '/accounting/collections': ['Super Admin', 'Accountant'],
    '/customers':           ['Super Admin', 'Sales Manager', 'Van Sales Rep'],
    '/purchasing/payments': ['Super Admin', 'Accountant', 'Purchasing Manager'],
    '/purchasing/grn':      ['Super Admin', 'Purchasing Manager', 'Quality Assurance'],
    '/purchasing':          ['Super Admin', 'Purchasing Manager'],
    '/stores':              ['Super Admin', 'Store Manager'],
    '/production':          ['Super Admin', 'Production Manager', 'Store Manager'],
    '/qa/incoming':         ['Super Admin', 'Quality Assurance'],
    '/qa/internal-reports': ['Super Admin', 'Quality Assurance'],
    '/qa':                  ['Super Admin', 'Quality Assurance'],
    '/accounting':          ['Super Admin', 'Accountant'],
    '/internal-audit':      ['Super Admin', 'Internal Auditor'],
    '/hr':                  ['Super Admin', 'HR Manager'],
    '/weekly-reports/review':['Super Admin', 'Managing Director'],
    '/weekly-reports':      ['Super Admin', 'Managing Director', 'Sales Manager', 'Store Manager', 'Purchasing Manager', 'Accountant', 'Production Manager', 'Van Sales Rep', 'Quality Assurance', 'HR Manager', 'Internal Auditor'],
    '/compliance':          ['Super Admin', 'Quality Assurance', 'Managing Director'],
    '/settings/users':      ['Super Admin'],
    '/settings/reports':    ['Super Admin'],
    '/settings/audit-log':  ['Super Admin'],
};

function canAccess(href: string, role: string | null | undefined): boolean {
    if (!role || role === 'Super Admin') return true;

    // Find the longest (most specific) matching rule for this href
    const match = Object.keys(ROUTE_ROLES)
        .filter(route => href === route || href.startsWith(route + '/'))
        .sort((a, b) => b.length - a.length)[0];

    if (!match) return true;                          // no restriction → always visible
    return ROUTE_ROLES[match].includes(role);
}

// ── Navigation definition ────────────────────────────────────────────────────

interface NavChild {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface NavItem {
    label: string;
    href?: string;
    icon: React.ReactNode;
    children?: NavChild[];
}

const navigation: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/overview',
        icon: <LayoutDashboard size={20} />,
    },
    {
        label: 'Procurement',
        icon: <ShoppingCart size={20} />,
        children: [
            { label: 'Suppliers',       href: '/purchasing/suppliers',       icon: <Users size={18} /> },
            { label: 'Purchase Orders', href: '/purchasing/purchase-orders', icon: <ClipboardList size={18} /> },
            { label: 'Requisitions',    href: '/purchasing/requests',        icon: <ClipboardList size={18} /> },
        ],
    },
    {
        label: 'Quality Assurance',
        icon: <ShieldCheck size={20} />,
        children: [
            { label: 'Overview',            href: '/qa',                    icon: <Activity size={18} /> },
            { label: 'Incoming Materials',  href: '/qa/incoming',           icon: <Truck size={18} /> },
            { label: 'In Process Controls', href: '/qa/in-process',         icon: <ClipboardList size={18} /> },
            { label: 'Finished Products',   href: '/qa/finished-products',  icon: <ShieldCheck size={18} /> },
            { label: 'Internal Reports',    href: '/qa/internal-reports',   icon: <Activity size={18} /> },
            { label: 'Goods Receipt',       href: '/purchasing/grn',        icon: <FileCheck size={18} /> },
        ],
    },
    {
        label: 'Stores',
        icon: <Warehouse size={20} />,
        children: [
            { label: 'Products',          href: '/stores/products',          icon: <Pill size={18} /> },
            { label: 'Stock Inventory',   href: '/stores/stock',             icon: <Boxes size={18} /> },
            { label: 'Internal Use',      href: '/stores/internal-use',      icon: <Briefcase size={18} /> },
            { label: 'Material Defects',  href: '/stores/material-defects',  icon: <AlertTriangle size={18} /> },
            { label: 'Material Expiry',   href: '/stores/material-expiry',   icon: <Clock size={18} /> },
            { label: 'Sales Request',     href: '/stores/sales-requests',    icon: <ClipboardList size={18} /> },
            { label: 'Stock Transfers',   href: '/stores/transfers',         icon: <ArrowLeftRight size={18} /> },
            { label: 'Material Requests', href: '/stores/material-requests', icon: <ClipboardList size={18} /> },
            { label: 'Purchase Requests', href: '/stores/purchase-requests', icon: <ShoppingCart size={18} /> },
            { label: 'QA Reports',        href: '/stores/qa-reports',        icon: <Activity size={18} /> },
        ],
    },
    {
        label: 'Production',
        icon: <Factory size={20} />,
        children: [
            { label: 'Bill of Materials', href: '/production/bom',               icon: <FileText size={18} /> },
            { label: 'Job Orders',        href: '/production',                    icon: <Package size={18} /> },
            { label: 'Material Requests', href: '/production/material-requests', icon: <ClipboardList size={18} /> },
        ],
    },
    {
        label: 'Sales',
        icon: <Receipt size={20} />,
        children: [
            { label: 'Customers',           href: '/sales/customers',    icon: <Users size={18} /> },
            { label: 'Routes & Vans',       href: '/sales/routes',       icon: <Truck size={18} /> },
            { label: 'Invoices',            href: '/sales/invoices',          icon: <FileText size={18} /> },
            { label: 'Sales Request',       href: '/sales/requests',          icon: <ClipboardList size={18} /> },
            { label: 'Dispatch Management', href: '/sales/dispatch',          icon: <Truck size={18} /> },
            { label: 'Waybills',            href: '/sales/waybill',           icon: <FileText size={18} /> },
            { label: 'Receipts',            href: '/sales/receipts',     icon: <CreditCard size={18} /> },
            { label: 'Credit Notes',        href: '/sales/credit-notes', icon: <BookOpen size={18} /> },
            { label: 'Sales Reports',        href: '/sales/reports',      icon: <BarChart3 size={18} /> },
        ],
    },
    {
        label: 'Accounting',
        icon: <Calculator size={20} />,
        children: [
            { label: 'Journal Entries',   href: '/accounting/journal',    icon: <BookOpen size={18} /> },
            { label: 'General Ledger',    href: '/accounting/ledger',        icon: <BookOpen size={18} /> },
            { label: 'Trial Balance',     href: '/accounting/trial-balance', icon: <Scale size={18} /> },
            { label: 'Expenses',          href: '/accounting/expenses',   icon: <Banknote size={18} /> },
            { label: 'Payroll',           href: '/accounting/payroll',    icon: <Users size={18} /> },
            { label: 'Tax Periods',       href: '/accounting/tax',        icon: <Landmark size={18} /> },
            { label: 'Petty Cash',        href: '/accounting/petty-cash', icon: <Coins size={18} /> },
            { label: 'Supplier Payments', href: '/purchasing/payments',   icon: <CreditCard size={18} /> },
            { label: 'Collections',       href: '/accounting/collections', icon: <Banknote size={18} /> },
            { label: 'A/R Aging',         href: '/accounting/ar-aging',   icon: <BarChart3 size={18} /> },
            { label: 'Financial Reports', href: '/accounting/reports',    icon: <PieChart size={18} /> },
            { label: 'Comprehensive Income', href: '/accounting/comprehensive-income', icon: <FileText size={18} /> },
            { label: 'Financial Position', href: '/accounting/financial-position', icon: <FileCheck size={18} /> },
            { label: 'Equity Statement', href: '/accounting/equity', icon: <PieChart size={18} /> },
            { label: 'Cash Flow', href: '/accounting/cash-flow', icon: <ArrowLeftRight size={18} /> },
            { label: 'Accounting Notes', href: '/accounting/notes', icon: <ClipboardList size={18} /> },
            { label: 'Banks', href: '/accounting/banks', icon: <Landmark size={18} /> },
        ],
    },
    {
        label: 'Internal Audit',
        icon: <Search size={20} />,
        children: [
            { label: 'Audit Plans',        href: '/internal-audit',                   icon: <ClipboardList size={18} /> },
            { label: 'Audit Reports',      href: '/internal-audit/reports',           icon: <FileText size={18} /> },
            { label: 'Non-Conformances',   href: '/internal-audit/non-conformances',  icon: <AlertTriangle size={18} /> },
        ],
    },
    {
        label: 'HR Management',
        icon: <UserCircle size={20} />,
        children: [
            { label: 'Employees',          href: '/hr/employees',  icon: <Users size={18} /> },
            { label: 'Attendance',         href: '/hr/attendance', icon: <ClipboardList size={18} /> },
            { label: 'Leave Management',   href: '/hr/leave',      icon: <CalendarDays size={18} /> },
            { label: 'Payroll Preparation', href: '/hr/payroll',   icon: <Banknote size={18} /> },
        ],
    },
    {
        label: 'Compliance',
        icon: <ShieldCheck size={20} />,
        children: [
            { label: 'Regulators & Renewals', href: '/compliance/regulators', icon: <FileCheck size={18} /> },
        ],
    },
    {
        label: 'Weekly Reports',
        icon: <Send size={20} />,
        children: [
            { label: 'Department Report', href: '/weekly-reports', icon: <FileText size={18} /> },
            { label: 'MD Review', href: '/weekly-reports/review', icon: <Eye size={18} /> },
        ],
    },
    {
        label: 'Settings',
        icon: <Settings size={20} />,
        children: [
            { label: 'Profile',          href: '/settings/profile',    icon: <User size={18} /> },
            { label: 'User Management',  href: '/settings/users',      icon: <UserCog size={18} /> },
            { label: 'Report Settings',  href: '/settings/reports',    icon: <BarChart3 size={18} /> },
            { label: 'Audit Trail',      href: '/settings/audit-log',  icon: <ClipboardList size={18} /> },
        ],
    },
];

// ── Component ────────────────────────────────────────────────────────────────

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { data: currentUser } = useCurrentUser();
    const userRole: string | null = currentUser?.role ?? null;

    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    // Auto-expand the section containing the current page
    React.useEffect(() => {
        const currentItem = navigation.find(item => {
            if (item.children) {
                return item.children.some(child => pathname.startsWith(child.href));
            }
            return false;
        });
        
        if (currentItem) {
            setExpandedGroup(currentItem.label);
        }
    }, [pathname]);

    const toggleGroup = (label: string) => {
        setExpandedGroup(prev => prev === label ? null : label);
    };

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    // Filter nav items by the current user's role
    const visibleNav: NavItem[] = navigation
        .map(item => {
            if (item.children) {
                const visibleChildren = item.children.filter(c => canAccess(c.href, userRole));
                if (visibleChildren.length === 0) return null;   // hide empty groups
                return { ...item, children: visibleChildren };
            }
            if (!canAccess(item.href!, userRole)) return null;
            return item;
        })
        .filter(Boolean) as NavItem[];

    return (
        <aside
            className={clsx('sidebar', collapsed && 'sidebar--collapsed')}
            style={{
                width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
                minHeight: '100vh',
                background: 'var(--sidebar-bg)',
                color: 'var(--sidebar-text)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 50,
                overflow: 'hidden',
                borderRight: '1px solid var(--sidebar-border)',
            }}
        >
            {/* Logo */}
            <div
                style={{
                    padding: collapsed ? '20px 12px' : '24px 20px',
                    borderBottom: '1px solid var(--sidebar-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    minHeight: 'var(--header-height)',
                }}
            >
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <Image 
                        src="/logo.png" 
                        alt="Aspee Pharma" 
                        fill
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
                {!collapsed && (
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--slate-900)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                            Aspee Pharma
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--slate-400)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            Enterprise Resource
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto', overflowX: 'hidden' }}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {visibleNav.map(item => {
                        const hasChildren = item.children && item.children.length > 0;
                        const isExpanded = expandedGroup === item.label;
                        const isGroupActive = hasChildren
                            ? item.children!.some(c => isActive(c.href))
                            : isActive(item.href!);

                        const baseItemStyle: React.CSSProperties = {
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            border: 'none',
                            borderRadius: 10,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            textDecoration: 'none',
                            position: 'relative',
                        };

                        const activeItemStyle: React.CSSProperties = {
                            ...baseItemStyle,
                            background: 'rgba(59, 130, 246, 0.08)',
                            color: 'var(--primary-500)',
                            boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1) inset',
                        };

                        const inactiveItemStyle: React.CSSProperties = {
                            ...baseItemStyle,
                            background: 'transparent',
                            color: 'var(--sidebar-text)',
                        };

                        return (
                            <li key={item.label}>
                                {hasChildren ? (
                                    <>
                                        <button
                                            onClick={() => toggleGroup(item.label)}
                                            style={isGroupActive ? activeItemStyle : inactiveItemStyle}
                                            onMouseEnter={e => {
                                                if (!isGroupActive) {
                                                    e.currentTarget.style.background = 'var(--sidebar-hover)';
                                                    e.currentTarget.style.color = 'var(--foreground)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isGroupActive) {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = 'var(--sidebar-text)';
                                                }
                                            }}
                                        >
                                            <span style={{ flexShrink: 0, display: 'flex', color: isGroupActive ? 'var(--primary-500)' : 'inherit' }}>
                                                {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18, strokeWidth: 1.5 })}
                                            </span>
                                            {!collapsed && (
                                                <>
                                                    <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                        {item.label}
                                                    </span>
                                                    <span style={{ flexShrink: 0, display: 'flex', transition: 'transform 0.3s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                        <ChevronDown size={14} />
                                                    </span>
                                                </>
                                            )}
                                        </button>

                                        {!collapsed && isExpanded && (
                                            <ul
                                                style={{
                                                    listStyle: 'none',
                                                    marginLeft: 26,
                                                    marginTop: 4,
                                                    marginBottom: 4,
                                                    borderLeft: '1.5px solid var(--sidebar-border)',
                                                    paddingLeft: 10,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '2px',
                                                }}
                                            >
                                                {item.children!.map(child => {
                                                    const isChildActive = isActive(child.href);
                                                    return (
                                                        <li key={child.href}>
                                                            <Link
                                                                href={child.href}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '10px',
                                                                    padding: '8px 12px',
                                                                    borderRadius: 8,
                                                                    fontSize: 11,
                                                                    fontWeight: isChildActive ? 600 : 500,
                                                                    color: isChildActive ? 'var(--primary-500)' : 'var(--sidebar-text)',
                                                                    background: isChildActive ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                                                    textDecoration: 'none',
                                                                    transition: 'all 0.15s ease',
                                                                }}
                                                                onMouseEnter={e => {
                                                                    if (!isChildActive) {
                                                                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                                                                        e.currentTarget.style.color = 'var(--foreground)';
                                                                    }
                                                                }}
                                                                onMouseLeave={e => {
                                                                    if (!isChildActive) {
                                                                        e.currentTarget.style.background = 'transparent';
                                                                        e.currentTarget.style.color = 'var(--sidebar-text)';
                                                                    }
                                                                }}
                                                            >
                                                                <span style={{ display: 'flex', flexShrink: 0, color: isChildActive ? 'var(--primary-500)' : 'inherit' }}>
                                                                    {React.cloneElement(child.icon as React.ReactElement<any>, { size: 16, strokeWidth: 1.5 })}
                                                                </span>
                                                                <span style={{ whiteSpace: 'nowrap' }}>{child.label}</span>
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </>
                                ) : (
                                    <Link
                                        href={item.href!}
                                        style={isActive(item.href!) ? activeItemStyle : inactiveItemStyle}
                                        onMouseEnter={e => {
                                            if (!isActive(item.href!)) {
                                                e.currentTarget.style.background = 'var(--sidebar-hover)';
                                                e.currentTarget.style.color = 'var(--foreground)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isActive(item.href!)) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'var(--sidebar-text)';
                                            }
                                        }}
                                    >
                                        <span style={{ flexShrink: 0, display: 'flex', color: isActive(item.href!) ? 'var(--primary-500)' : 'inherit' }}>
                                            {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18, strokeWidth: 1.5 })}
                                        </span>
                                        {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                                        {isActive(item.href!) && !collapsed && (
                                            <div style={{
                                                position: 'absolute', right: 14, width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-500)',
                                                boxShadow: '0 0 10px var(--primary-500)'
                                            }} />
                                        )}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Collapse Toggle */}
            <div style={{ padding: '16px 12px', borderTop: '1px solid var(--sidebar-border)' }}>
                <button
                    onClick={onToggle}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap: '12px',
                        padding: '12px 14px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--sidebar-text)',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                        e.currentTarget.style.color = 'var(--foreground)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--sidebar-text)';
                    }}
                >
                    {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                    {!collapsed && <span>Collapse Sidebar</span>}
                </button>
            </div>
        </aside>
    );
}
