// Mirrors the SQL side of access control (see
// supabase/migrations/20260927000000_user_module_permissions.sql):
// module_default_access(), app_private.edit_window_days_for_role(). This
// copy is display-only — the numbers shown here are what an admin should
// expect, but the database functions are what actually enforce access, so
// keep the two in sync if either changes.

export type ModuleAccess = 'none' | 'view' | 'edit';

export interface ModuleDef {
    key: string;
    label: string;
}

export const MODULES: ModuleDef[] = [
    { key: 'sales', label: 'Sales' },
    { key: 'purchasing', label: 'Purchasing' },
    { key: 'stores', label: 'Stores' },
    { key: 'production', label: 'Production' },
    { key: 'qa', label: 'Quality Assurance' },
    { key: 'accounting', label: 'Accounting' },
    { key: 'hr', label: 'HR' },
    { key: 'internal_audit', label: 'Internal Audit' },
    { key: 'compliance', label: 'Compliance' },
];

export function roleDefaultAccess(role: string, moduleKey: string): ModuleAccess {
    if (role === 'Super Admin') return 'edit';

    switch (moduleKey) {
        case 'purchasing':
            if (role === 'Purchasing Manager') return 'edit';
            if (role === 'Managing Director' || role === 'Accountant') return 'view';
            return 'none';
        case 'qa':
            if (role === 'Quality Assurance') return 'edit';
            if (role === 'Managing Director' || role === 'Accountant') return 'view';
            return 'none';
        case 'stores':
            if (role === 'Store Manager') return 'edit';
            if (role === 'Purchasing Manager' || role === 'Accountant') return 'view';
            return 'none';
        case 'production':
            if (role === 'Production Manager') return 'edit';
            if (role === 'Store Manager' || role === 'Accountant') return 'view';
            return 'none';
        case 'sales':
            if (role === 'Sales Manager' || role === 'Van Sales Rep') return 'edit';
            if (role === 'Accountant') return 'view';
            return 'none';
        case 'accounting':
            if (role === 'Accountant') return 'edit';
            if (role === 'Managing Director') return 'view';
            return 'none';
        case 'internal_audit':
            if (role === 'Internal Auditor') return 'edit';
            if (role === 'Managing Director') return 'view';
            return 'none';
        case 'hr':
            if (role === 'HR Manager') return 'edit';
            if (role === 'Accountant') return 'view';
            return 'none';
        case 'compliance':
            if (role === 'Quality Assurance' || role === 'Managing Director') return 'edit';
            if (role === 'Accountant') return 'view';
            return 'none';
        default:
            return 'view';
    }
}

// Officer tier: 21-day edit window. Manager tier: 60-day. Super Admin /
// Managing Director: unlimited (null).
export function editWindowDaysForRole(role: string): number | null {
    if (role === 'Super Admin' || role === 'Managing Director') return null;
    if ([
        'Sales Manager', 'Store Manager', 'Purchasing Manager',
        'Production Manager', 'HR Manager',
    ].includes(role)) return 60;
    return 21;
}

export function formatEditWindow(days: number | null): string {
    return days == null ? 'Unlimited' : `${days} days`;
}

// Route prefix -> module key, used by Sidebar.tsx and middleware.ts to know
// which module's override applies to a given URL. Order doesn't matter —
// matching is by longest/most-specific prefix already handled by the caller.
export const MODULE_ROUTE_PREFIXES: Record<string, string[]> = {
    sales: ['/sales', '/customers'],
    purchasing: ['/purchasing', '/suppliers'],
    qa: ['/qa'],
    stores: ['/stores'],
    production: ['/production'],
    accounting: ['/accounting'],
    internal_audit: ['/internal-audit'],
    hr: ['/hr'],
    compliance: ['/compliance'],
};

export function moduleForRoute(pathname: string): string | null {
    for (const [mod, prefixes] of Object.entries(MODULE_ROUTE_PREFIXES)) {
        if (prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) return mod;
    }
    return null;
}

