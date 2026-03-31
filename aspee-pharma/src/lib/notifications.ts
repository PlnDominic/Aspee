import { supabase } from './supabase';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationPayload {
    title: string;
    message: string;
    type: NotificationType;
    target_role: string | null; // null = global, or 'Procurement', 'Warehouse', 'Sales', 'Finance', 'QA', 'Production'
    link?: string;
}

/**
 * Inserts a notification into the notifications table.
 * Fails silently — notifications should never block the main operation.
 */
async function insertNotification(payload: NotificationPayload): Promise<void> {
    try {
        await supabase.from('notifications').insert([{
            title: payload.title,
            message: payload.message,
            type: payload.type,
            target_role: payload.target_role,
            link: payload.link || null,
            is_read: false,
        }]);
    } catch (error) {
        console.warn('[Notifications] Failed to insert notification:', error);
    }
}

/**
 * Prevent duplicate notifications by checking if a similar one was sent recently (within 1 hour).
 */
async function isDuplicate(title: string, message: string): Promise<boolean> {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data } = await supabase
            .from('notifications')
            .select('id')
            .eq('title', title)
            .eq('message', message)
            .gte('created_at', oneHourAgo)
            .limit(1);
        return (data && data.length > 0) || false;
    } catch {
        return false;
    }
}

// ─── Trigger Functions ───────────────────────────────────────────────

/**
 * Notify Procurement when stock drops to or below reorder level after a sale.
 */
export async function notifyLowStock(
    productName: string,
    currentQty: number,
    reorderLevel: number
): Promise<void> {
    if (currentQty > reorderLevel) return;

    const title = 'Low Stock Alert';
    const message = `${productName} is at ${currentQty} units (reorder level: ${reorderLevel}). Consider placing a purchase order.`;

    if (await isDuplicate(title, message)) return;

    await insertNotification({
        title,
        message,
        type: currentQty === 0 ? 'error' : 'warning',
        target_role: 'Procurement',
        link: '/stores/stock',
    });
}

/**
 * Notify Warehouse/QA when a GRN is rejected or quarantined.
 */
export async function notifyGRNQAResult(
    grnNumber: string,
    qaStatus: string,
    remarks?: string
): Promise<void> {
    if (qaStatus !== 'Rejected' && qaStatus !== 'Quarantine') return;

    const isRejected = qaStatus === 'Rejected';
    await insertNotification({
        title: isRejected ? 'GRN Rejected by QA' : 'GRN Sent to Quarantine',
        message: `${grnNumber} has been ${isRejected ? 'rejected' : 'quarantined'} by QA.${remarks ? ` Remarks: ${remarks}` : ''}`,
        type: isRejected ? 'error' : 'warning',
        target_role: 'Warehouse',
        link: '/purchasing/grn',
    });
}

/**
 * Notify QA when a new GRN is created and awaiting inspection.
 */
export async function notifyGRNPendingQA(
    grnNumber: string,
    supplierName: string
): Promise<void> {
    await insertNotification({
        title: 'New GRN Awaiting QA',
        message: `${grnNumber} from ${supplierName} has been received and is pending QA inspection.`,
        type: 'info',
        target_role: 'QA',
        link: '/purchasing/grn',
    });
}

/**
 * Notify Finance when a new expense is submitted for approval.
 */
export async function notifyExpensePending(
    expenseNumber: string,
    amount: number,
    category: string
): Promise<void> {
    await insertNotification({
        title: 'Expense Pending Approval',
        message: `${expenseNumber} for GH\u20B5 ${amount.toFixed(2)} (${category}) requires approval.`,
        type: 'info',
        target_role: 'Finance',
        link: '/accounting/expenses',
    });
}

/**
 * Notify Accounts when invoices become overdue.
 * Call this on dashboard load — checks for Issued invoices past due_date.
 */
export async function checkAndNotifyOverdueInvoices(): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: overdueInvoices } = await supabase
            .from('sales_invoices')
            .select('invoice_number, customer_name, total_amount, due_date')
            .in('status', ['Issued', 'Partially Paid'])
            .lt('due_date', today)
            .limit(10);

        if (!overdueInvoices || overdueInvoices.length === 0) return;

        for (const inv of overdueInvoices) {
            const daysPastDue = Math.ceil(
                (new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
            );

            const title = 'Invoice Overdue';
            const message = `${inv.invoice_number} from ${inv.customer_name} (GH\u20B5 ${Number(inv.total_amount).toFixed(2)}) is ${daysPastDue} day${daysPastDue > 1 ? 's' : ''} overdue.`;

            if (await isDuplicate(title, message)) continue;

            await insertNotification({
                title,
                message,
                type: daysPastDue > 30 ? 'error' : 'warning',
                target_role: 'Accounts',
                link: '/sales/invoices',
            });
        }
    } catch (error) {
        console.warn('[Notifications] Failed to check overdue invoices:', error);
    }
}

/**
 * Notify Warehouse when products are expiring within 30 days.
 * Call this on dashboard load.
 */
export async function checkAndNotifyExpiringStock(): Promise<void> {
    try {
        const today = new Date();
        const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        const { data: expiringItems } = await supabase
            .from('grn_items')
            .select('batch_no, expiry_date, quantity_received, product:products(name)')
            .gte('expiry_date', todayStr)
            .lte('expiry_date', thirtyDaysOut)
            .limit(10);

        if (!expiringItems || expiringItems.length === 0) return;

        for (const item of expiringItems) {
            const productName = (item.product as any)?.name || 'Unknown Product';
            const daysUntil = Math.ceil(
                (new Date(item.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            const title = 'Product Expiring Soon';
            const message = `${productName} (Batch: ${item.batch_no || 'N/A'}) expires in ${daysUntil} day${daysUntil > 1 ? 's' : ''}.`;

            if (await isDuplicate(title, message)) continue;

            await insertNotification({
                title,
                message,
                type: daysUntil <= 7 ? 'error' : 'warning',
                target_role: 'Warehouse',
                link: '/stores/stock',
            });
        }
    } catch (error) {
        console.warn('[Notifications] Failed to check expiring stock:', error);
    }
}
