export const routePermissions: Record<string, string[]> = {
    '/dashboard': ['*'],
    '/sales/requests': ['Super Admin', 'Sales Manager', 'Van Sales Rep', 'Store Manager', 'Accountant'],
    '/stores/sales-requests': ['Super Admin', 'Store Manager', 'Accountant'],
    '/sales/collections': ['Super Admin', 'Accountant', 'Sales Manager'],
    '/sales': ['Super Admin', 'Sales Manager', 'Van Sales Rep', 'Accountant'],
    '/customers': ['Super Admin', 'Sales Manager', 'Van Sales Rep', 'Accountant'],
    '/purchasing/grn': ['Super Admin', 'Purchasing Manager', 'Quality Assurance', 'Accountant'],
    '/purchasing': ['Super Admin', 'Purchasing Manager', 'Accountant'],
    '/suppliers': ['Super Admin', 'Purchasing Manager', 'Accountant'],
    '/stores': ['Super Admin', 'Store Manager', 'Accountant'],
    '/production': ['Super Admin', 'Production Manager', 'Store Manager', 'Accountant'],
    '/qa': ['Super Admin', 'Quality Assurance', 'Accountant'],
    '/accounting': ['Super Admin', 'Accountant'],
    '/internal-audit': ['Super Admin', 'Internal Auditor'],
    '/hr': ['Super Admin', 'HR Manager', 'Accountant'],
    '/weekly-reports/review': ['Super Admin', 'Managing Director', 'Accountant'],
    '/weekly-reports': ['*'],
    '/settings/profile': ['*'],
    '/settings': ['Super Admin'],
};

export const USER_ADMIN_ROLES = ['Super Admin'] as const;
export const REPORT_ADMIN_ROLES = ['Super Admin', 'Managing Director'] as const;
export const ACCOUNTING_ROLES = ['Super Admin', 'Managing Director', 'Accountant'] as const;
