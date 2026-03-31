/**
 * autoPostJournal.ts
 *
 * Auto-creates balanced journal entries in the general ledger whenever
 * a financial event occurs in the Purchasing, Sales, or Expense modules.
 *
 * Accounting rules applied:
 *   Invoice Issued    → DR Accounts Receivable   / CR Sales Revenue
 *   Receipt Received  → DR Cash at Bank           / CR Accounts Receivable
 *   Supplier Paid     → DR Accounts Payable       / CR Cash at Bank
 *   GRN QA Approved   → DR Inventory              / CR Accounts Payable
 *   Credit Note       → DR Sales Revenue           / CR Accounts Receivable
 *   Expense Approved  → DR [Expense COA Account]  / CR Cash at Bank / Petty Cash
 */

import { supabase } from '@/lib/supabase';

export type AutoJournalEvent =
    | 'INVOICE_ISSUED'
    | 'RECEIPT_RECEIVED'
    | 'SUPPLIER_PAYMENT'
    | 'GRN_APPROVED'
    | 'CREDIT_NOTE_ISSUED'
    | 'EXPENSE_APPROVED';

export interface AutoJournalPayload {
    event: AutoJournalEvent;
    amount: number;
    date: string;
    description: string;
    /** Source document number (invoice number, PO number, GRN number, expense number, etc.) */
    refNumber: string;
    /** 'Cash' | 'Bank Transfer' | 'Cheque' | 'Mobile Money' — used to pick cash vs bank account */
    paymentMethod?: string;
    /** For EXPENSE_APPROVED: the expense category, used to resolve the COA debit account */
    expenseCategory?: string;
}

// ── Expense category → Chart of Accounts account name ─────────────────────────
//
// Maps every EXPENSE_CATEGORIES entry to its matching COA account name.
// Falls back to the category name itself so no expense is ever lost.

const EXPENSE_CATEGORY_TO_COA: Record<string, string> = {
    // Payroll & Welfare → Salaries & Wages
    'ASPEE STAFF WELFARE SCHEME':          'Salaries & Wages',
    'Staff Salaries (S&A)':                'Salaries & Wages',
    'Staff Bonus and Allowances':          'Salaries & Wages',
    'Staff Medical And Welfare Exp':       'Salaries & Wages',
    'Staff Overtime (S&A)':                'Salaries & Wages',
    'Feeding/Refreshment Expense':         'Salaries & Wages',
    'Employee benefits (S&A)':             'Salaries & Wages',
    'Staff Training and Education (S&A)':  'Salaries & Wages',
    'Seminars/Workshop/Training Exp':      'Salaries & Wages',

    // Operations & S&A → varies
    'Travel & lodging (S&A)':             'Salaries & Wages',   // travel is a staff cost
    'Telecommunication and Postages (S&A)':'Utilities',
    'Protocol Exp':                        'Salaries & Wages',
    'Vehicle Fuel Expense':                'Maintenance & Repairs',
    'Printing and Stationery Exp':         'Utilities',
    'Research & Development Exp':          'Marketing & Sales',
    'Security Expense':                    'Utilities',
    'Misc. expenses (S&A)':               'Salaries & Wages',

    // Professional & ICT
    'Audit and Accountancy Exp':           'Taxes & Licenses',
    'Professional and Consultancy Fees':   'Taxes & Licenses',
    'ICT Expense':                         'Utilities',
    'Registration & Licensing Exp':        'Taxes & Licenses',
    'Software Subscription Expense':       'Utilities',

    // Marketing & Sales
    'Marketing and Distribution Expense':  'Marketing & Sales',
    'Advertising expenses (S&A)':          'Marketing & Sales',
    'Sales commission (S&A)':              'Marketing & Sales',

    // Maintenance & Occupancy
    'Rent expenses (S&A)':                 'Rent Expense',
    'Repairing expenses (S&A)':            'Maintenance & Repairs',
    'Vehicle Repairs & Maintenance Expense':'Maintenance & Repairs',
    'Cleaning and Sanitation Exp':         'Utilities',
    'Building Repairs & Maintenance (S&A)':'Maintenance & Repairs',
    'Equipment Repairs & Maintenance':     'Maintenance & Repairs',

    // Financial & Taxes
    'PAYE - GRA':                          'Taxes & Licenses',
    'INTERNET EXPENSES':                   'Utilities',
    'Insurance expenses (S&A)':            'Insurance',
    'Bank Charges':                        'Taxes & Licenses',
    'Interest Expenses':                   'Taxes & Licenses',
    'Income taxes (Current Year)':         'Taxes & Licenses',

    // Other
    'Donations':                           'Marketing & Sales',
    'Other Income':                        'Salaries & Wages',
};

/** Resolves an expense category string to the correct COA account name */
export function resolveExpenseAccount(category: string): string {
    return EXPENSE_CATEGORY_TO_COA[category] ?? category;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateEntryNumber(prefix: string): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    return `${prefix}-${yy}${mm}-${seq}`;
}

/** Returns 'Petty Cash' for cash payments, 'Cash at Bank' for everything else */
function resolvePaymentAccount(paymentMethod?: string): string {
    return paymentMethod === 'Cash' ? 'Petty Cash' : 'Cash at Bank';
}

// ── Entry builder ──────────────────────────────────────────────────────────────

function buildEntry(payload: AutoJournalPayload): {
    entry_number: string;
    date: string;
    description: string;
    ref_type: string;
    debit_account: string;
    debit_amount: number;
    credit_account: string;
    credit_amount: number;
    created_by: string;
    notes: string;
} {
    const { event, amount, date, description, refNumber, paymentMethod, expenseCategory } = payload;
    const cashAccount = resolvePaymentAccount(paymentMethod);
    const amt = Math.abs(amount);

    switch (event) {
        case 'INVOICE_ISSUED':
            return {
                entry_number: generateEntryNumber('SLS'),
                date,
                description,
                ref_type: 'Sales',
                debit_account: 'Accounts Receivable',
                debit_amount: amt,
                credit_account: 'Sales Revenue',
                credit_amount: amt,
                created_by: 'System',
                notes: `Auto-posted from Sales Invoice ${refNumber}`,
            };

        case 'RECEIPT_RECEIVED':
            return {
                entry_number: generateEntryNumber('RCT'),
                date,
                description,
                ref_type: 'Sales',
                debit_account: cashAccount,
                debit_amount: amt,
                credit_account: 'Accounts Receivable',
                credit_amount: amt,
                created_by: 'System',
                notes: `Auto-posted from Sales Receipt ${refNumber}`,
            };

        case 'SUPPLIER_PAYMENT':
            return {
                entry_number: generateEntryNumber('PAY'),
                date,
                description,
                ref_type: 'Purchase',
                debit_account: 'Accounts Payable',
                debit_amount: amt,
                credit_account: cashAccount,
                credit_amount: amt,
                created_by: 'System',
                notes: `Auto-posted from Supplier Payment ${refNumber}`,
            };

        case 'GRN_APPROVED':
            return {
                entry_number: generateEntryNumber('GRN'),
                date,
                description,
                ref_type: 'Purchase',
                debit_account: 'Inventory - Raw Materials',
                debit_amount: amt,
                credit_account: 'Accounts Payable',
                credit_amount: amt,
                created_by: 'System',
                notes: `Auto-posted from GRN ${refNumber}`,
            };

        case 'CREDIT_NOTE_ISSUED':
            return {
                entry_number: generateEntryNumber('CN'),
                date,
                description,
                ref_type: 'Sales',
                debit_account: 'Sales Revenue',
                debit_amount: amt,
                credit_account: 'Accounts Receivable',
                credit_amount: amt,
                created_by: 'System',
                notes: `Auto-posted from Credit Note ${refNumber}`,
            };

        case 'EXPENSE_APPROVED': {
            const expenseAccount = resolveExpenseAccount(expenseCategory || 'Misc. expenses (S&A)');
            return {
                entry_number: generateEntryNumber('EXP'),
                date,
                description,
                ref_type: 'Expense',
                debit_account: expenseAccount,
                debit_amount: amt,
                credit_account: cashAccount,
                credit_amount: amt,
                created_by: 'System',
                notes: `Auto-posted from Expense ${refNumber} (${expenseCategory})`,
            };
        }
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Posts an auto-generated balanced journal entry.
 *
 * Duplicate guard: before inserting, queries journal_entries for an existing
 * row whose `notes` matches the exact auto-post signature for this event +
 * refNumber. If one already exists the insert is skipped silently — this
 * prevents double-counting when a user re-saves an already-posted document.
 *
 * All errors are swallowed so a GL failure never blocks the originating
 * business operation.
 */
export async function autoPostJournal(payload: AutoJournalPayload): Promise<void> {
    if (!payload.amount || payload.amount <= 0) return;

    const entry = buildEntry(payload);

    // ── Duplicate guard ──────────────────────────────────────────────────────
    // The `notes` field is deterministic per (event, refNumber) pair, making
    // it a reliable idempotency key without requiring a schema change.
    const { data: existing, error: checkError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('notes', entry.notes)
        .limit(1);

    if (checkError) {
        console.error('[autoPostJournal] Duplicate check failed:', checkError.message);
        // Continue to insert anyway — a failed check should not block posting
    } else if (existing && existing.length > 0) {
        console.info(
            `[autoPostJournal] Skipped duplicate GL entry for: ${entry.notes}`
        );
        return;
    }

    // ── Insert ───────────────────────────────────────────────────────────────
    const { error } = await supabase.from('journal_entries').insert([entry]);

    if (error) {
        console.error('[autoPostJournal] Failed to post GL entry:', error.message, entry);
    }
}
