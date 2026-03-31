import { z } from 'zod';

// Common validation schemas
export const phoneSchema = z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal(''));

export const emailSchema = z
    .string()
    .email('Invalid email address');

export const requiredString = (fieldName: string, minLength = 1) =>
    z.string().min(minLength, `${fieldName} is required`);

// Product validation
export const productSchema = z.object({
    name: requiredString('Product name', 2).max(200),
    sku: requiredString('SKU', 1).max(50),
    description: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    reorder_level: z.coerce.number().min(0).default(0),
    unit_price: z.coerce.number().min(0).default(0),
    pack_size: z.coerce.number().min(1).default(1),
    is_active: z.boolean().default(true),
});

// Customer validation
export const customerSchema = z.object({
    name: requiredString('Customer name', 2).max(200),
    email: emailSchema.optional().or(z.literal('')),
    phone: phoneSchema,
    address: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    tax_id: z.string().optional(),
    credit_limit: z.coerce.number().min(0).default(0),
    payment_terms: z.string().optional(),
    is_active: z.boolean().default(true),
});

// Supplier validation
export const supplierSchema = z.object({
    name: requiredString('Supplier name', 2).max(200),
    email: emailSchema.optional().or(z.literal('')),
    phone: phoneSchema,
    address: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    tax_id: z.string().optional(),
    payment_terms: z.string().optional(),
    lead_time_days: z.coerce.number().min(0).default(0),
    is_active: z.boolean().default(true),
});

// User validation
export const userSchema = z.object({
    name: requiredString('Full name', 2).max(200),
    email: emailSchema,
    phone: phoneSchema,
    role: requiredString('Role'),
    department: requiredString('Department'),
    status: z.enum(['Active', 'Inactive']).default('Active'),
    mfa_enabled: z.boolean().default(false),
});

// Purchase Order validation
export const purchaseOrderSchema = z.object({
    supplier_id: requiredString('Supplier'),
    order_date: z.string().min(1, 'Order date is required'),
    expected_delivery: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['Draft', 'Issued', 'Partially Received', 'Received', 'Cancelled']).default('Draft'),
});

// Sales Invoice validation
export const invoiceSchema = z.object({
    customer_id: requiredString('Customer'),
    invoice_date: z.string().min(1, 'Invoice date is required'),
    due_date: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']).default('Draft'),
});

// Expense validation
export const expenseSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    category: requiredString('Category'),
    description: z.string().optional(),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    payment_method: z.string().optional(),
    reference: z.string().optional(),
    is_reimbursed: z.boolean().default(false),
});

// Petty Cash validation
export const pettyCashSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    type: z.enum(['Receipt', 'Payment']),
    category: requiredString('Category'),
    description: z.string().optional(),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    payment_method: z.string().optional(),
    reference: z.string().optional(),
});

// Journal Entry validation
export const journalEntrySchema = z.object({
    date: z.string().min(1, 'Date is required'),
    description: requiredString('Description'),
    reference: z.string().optional(),
    entries: z.array(z.object({
        account_id: z.string().min(1, 'Account is required'),
        debit: z.coerce.number().min(0).default(0),
        credit: z.coerce.number().min(0).default(0),
        description: z.string().optional(),
    })).min(2, 'At least two entries are required').refine(
        (entries) => {
            const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
            const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
            return Math.abs(totalDebit - totalCredit) < 0.01;
        },
        { message: 'Debits and credits must balance' }
    ),
});

// Production Order validation
export const productionOrderSchema = z.object({
    product_id: requiredString('Product'),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    production_date: z.string().min(1, 'Production date is required'),
    expected_completion: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['Draft', 'In Progress', 'Completed', 'Cancelled']).default('Draft'),
});

// Stock Transfer validation
export const stockTransferSchema = z.object({
    from_location: requiredString('Source location'),
    to_location: requiredString('Destination location'),
    transfer_date: z.string().min(1, 'Transfer date is required'),
    notes: z.string().optional(),
    status: z.enum(['Draft', 'In Transit', 'Completed', 'Cancelled']).default('Draft'),
});

// Material Request validation
export const materialRequestSchema = z.object({
    product_id: requiredString('Product'),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    required_date: z.string().min(1, 'Required date is required'),
    priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
    notes: z.string().optional(),
    status: z.enum(['Draft', 'Pending', 'Fulfilled', 'Cancelled']).default('Draft'),
});

// Van validation
export const vanSchema = z.object({
    name: requiredString('Van name', 2).max(100),
    registration: requiredString('Registration number', 2).max(50),
    driver_name: z.string().optional(),
    driver_phone: phoneSchema,
    capacity: z.coerce.number().min(0).default(0),
    status: z.enum(['Active', 'Maintenance', 'Inactive']).default('Active'),
});

// Type exports
export type ProductFormData = z.infer<typeof productSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type SupplierFormData = z.infer<typeof supplierSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type PettyCashFormData = z.infer<typeof pettyCashSchema>;
export type ProductionOrderFormData = z.infer<typeof productionOrderSchema>;
export type StockTransferFormData = z.infer<typeof stockTransferSchema>;
export type MaterialRequestFormData = z.infer<typeof materialRequestSchema>;
export type VanFormData = z.infer<typeof vanSchema>;
