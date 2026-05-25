'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
    '/overview': { title: 'Dashboard', subtitle: 'Overview of your business operations' },
    '/purchasing/suppliers': { title: 'Suppliers', subtitle: 'Manage your supplier network' },
    '/purchasing/purchase-orders': { title: 'Purchase Orders', subtitle: 'Track and manage purchase orders' },
    '/purchasing/grn': { title: 'Goods Receipt Notes', subtitle: 'Record incoming goods deliveries' },
    '/stores/products': { title: 'Products', subtitle: 'Product master data and catalog' },
    '/stores/stock': { title: 'Stock Levels', subtitle: 'Real-time inventory across locations' },
    '/stores/transfers': { title: 'Stock Transfers', subtitle: 'Inter-location stock movements' },
    '/production': { title: 'Production', subtitle: 'Production orders and BOM management' },
    '/sales/routes': { title: 'Routes & Vans', subtitle: 'Van inventory and route management' },
    '/sales/invoices': { title: 'Invoices', subtitle: 'Sales invoicing and billing' },
    '/sales/credit-notes': { title: 'Credit Notes', subtitle: 'Returns and price adjustments' },
    '/sales/receipts': { title: 'Receipts', subtitle: 'Payment receipts and collections' },
    '/sales/customers': { title: 'Customers', subtitle: 'Customer accounts and credit management' },
    '/sales/requests': { title: 'Sales Request', subtitle: 'Send finished-goods requests from the Sales department to Stores' },
    '/stores/sales-requests': { title: 'Sales Request', subtitle: 'Review and process finished-goods requests from the Sales department' },
    '/qa': { title: 'Quality Assurance Dashboard', subtitle: 'Overview of all quality control activities' },
    '/qa/in-process': { title: 'In Process Controls', subtitle: 'Quality checks during manufacturing' },
    '/qa/finished-products': { title: 'Finished Products Analysis', subtitle: 'Final quality assurance before release' },
    '/accounting/journal': { title: 'Journal Entries', subtitle: 'Double-entry bookkeeping ledger' },
    '/accounting/ledger': { title: 'General Ledger', subtitle: 'Account balances and transaction history' },
    '/accounting/trial-balance': { title: 'Trial Balance', subtitle: 'Formal statement of all account debit and credit balances' },
    '/accounting/expenses': { title: 'Expenses', subtitle: 'Track and categorise business expenses' },
    '/accounting/payroll': { title: 'Payroll', subtitle: 'Employee salary processing' },
    '/accounting/tax': { title: 'Tax Management', subtitle: 'VAT/GST tracking and reporting' },
    '/accounting/petty-cash': { title: 'Petty Cash', subtitle: 'Petty cash fund management' },
    '/internal-audit': { title: 'Audit Plans', subtitle: 'Plan and schedule internal audits' },
    '/internal-audit/reports': { title: 'Audit Reports', subtitle: 'Internal audit findings and ratings' },
    '/internal-audit/non-conformances': { title: 'Non-Conformances', subtitle: 'Track and resolve non-conformance reports' },
    '/hr/employees': { title: 'Employees', subtitle: 'Employee records and profiles' },
    '/hr/attendance': { title: 'Attendance', subtitle: 'Daily attendance tracking' },
    '/hr/leave': { title: 'Leave Management', subtitle: 'Leave requests and approvals' },
    '/hr/payroll': { title: 'Payroll Preparation', subtitle: 'Prepare and validate employee payroll for Accounts' },
    '/compliance/regulators': { title: 'Regulators & Renewals', subtitle: 'Track regulator permits/licenses and renewal due dates' },
    '/weekly-reports': { title: 'Weekly Reports', subtitle: 'Monday to Friday department reports for the Managing Director' },
    '/weekly-reports/review': { title: 'Weekly Report Review', subtitle: 'Managing Director review of department submissions' },
    '/settings/profile': { title: 'Profile', subtitle: 'Manage your account settings' },
    '/settings/users': { title: 'User Management', subtitle: 'Manage system users and roles' },
    '/settings/reports': { title: 'Report Settings', subtitle: 'Configure automated weekly department reports' },
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const pageInfo = pageTitles[pathname] || { title: 'Page', subtitle: '' };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
            <main
                style={{
                    flex: 1,
                    marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
                    transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    width: '0', // Force flex child to respect container width for overflow handling
                }}
            >
                <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
                <div style={{ flex: 1, padding: 'clamp(16px, 4vw, 32px)', width: '100%', overflowX: 'hidden' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
