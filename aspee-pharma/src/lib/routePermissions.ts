export const routePermissions: Record<string, string[]> = {
    '/dashboard': ['*'],
    '/sales/requests': ['Super Admin', 'Sales Manager', 'Van Sales Rep', 'Store Manager'],
    '/stores/sales-requests': ['Super Admin', 'Store Manager'],
    '/sales/collections': ['Super Admin', 'Accountant', 'Sales Manager'],
    '/sales': ['Super Admin', 'Sales Manager', 'Van Sales Rep'],
    '/customers': ['Super Admin', 'Sales Manager', 'Van Sales Rep'],
    '/purchasing/grn': ['Super Admin', 'Purchasing Manager', 'Quality Assurance'],
    '/purchasing': ['Super Admin', 'Purchasing Manager'],
    '/suppliers': ['Super Admin', 'Purchasing Manager'],
    '/stores': ['Super Admin', 'Store Manager'],
    '/production': ['Super Admin', 'Production Manager', 'Store Manager'],
    '/qa': ['Super Admin', 'Quality Assurance'],
    '/accounting': ['Super Admin', 'Accountant'],
    '/internal-audit': ['Super Admin', 'Internal Auditor'],
    '/hr': ['Super Admin', 'HR Manager'],
    '/weekly-reports/review': ['Super Admin', 'Managing Director'],
    '/weekly-reports': ['*'],
    '/settings/profile': ['*'],
    '/settings': ['Super Admin'],
};

export const USER_ADMIN_ROLES = ['Super Admin'] as const;
export const REPORT_ADMIN_ROLES = ['Super Admin', 'Managing Director'] as const;
export const ACCOUNTING_ROLES = ['Super Admin', 'Managing Director', 'Accountant'] as const;
