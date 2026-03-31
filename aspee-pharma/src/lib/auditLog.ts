import { supabase } from './supabase';

export type AuditAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'VIEW'
    | 'EXPORT'
    | 'LOGIN'
    | 'LOGOUT'
    | 'PRINT'
    | 'STATUS_CHANGE'
    | 'APPROVE';

export interface AuditEntry {
    action: AuditAction;
    module: string;          // e.g. 'Sales Invoices', 'Purchase Orders', 'Stock'
    description: string;     // Human-readable description
    record_id?: string;      // ID of the affected record
    record_type?: string;    // Table name or entity type
    old_values?: any;        // Previous values (for updates)
    new_values?: any;        // New values (for creates/updates)
    user_name?: string;      // Display name of the user
}

/**
 * Logs an action to the audit_log table in Supabase.
 * Fails silently to avoid blocking the main operation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
    try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;
        const userEmail = authData?.user?.email || 'system';

        await supabase.from('audit_log').insert([{
            user_id: userId,
            user_email: userEmail,
            user_name: entry.user_name || userEmail,
            action: entry.action,
            module: entry.module,
            description: entry.description,
            record_id: entry.record_id || null,
            record_type: entry.record_type || null,
            old_values: entry.old_values ? JSON.stringify(entry.old_values) : null,
            new_values: entry.new_values ? JSON.stringify(entry.new_values) : null,
            ip_address: null, // Could be populated server-side
            created_at: new Date().toISOString(),
        }]);
    } catch (error) {
        // Fail silently — audit logging should never block the main operation
        console.warn('[AuditLog] Failed to write audit entry:', error);
    }
}
