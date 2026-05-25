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
    module: string;
    description: string;
    record_id?: string;
    record_type?: string;
    old_values?: any;
    new_values?: any;
    user_name?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
    try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;
        const userEmail = authData?.user?.email || 'system';
        const userName = entry.user_name || userEmail;

        const { data: systemUser } = userId
            ? await supabase
                .from('system_users')
                .select('department, name')
                .eq('auth_user_id', userId)
                .maybeSingle()
            : { data: null };

        const { error: activityError } = await supabase.from('department_activity_logs').insert([{
            department: systemUser?.department || 'Administration',
            activity_date: new Date().toISOString().split('T')[0],
            user_id: userId,
            user_email: userEmail,
            user_name: systemUser?.name || userName,
            action: entry.action,
            module: entry.module,
            description: entry.description,
            record_id: entry.record_id || null,
            record_type: entry.record_type || null,
            metadata: {
                old_values: entry.old_values || null,
                new_values: entry.new_values || null,
            },
        }]);

        if (activityError && activityError.code !== '42P01' && activityError.code !== 'PGRST205') {
            console.warn('[AuditLog] Failed to write department activity:', activityError);
        }

        const { error: legacyError } = await supabase.from('audit_log').insert([{
            user_id: userId,
            user_email: userEmail,
            user_name: userName,
            action: entry.action,
            module: entry.module,
            description: entry.description,
            record_id: entry.record_id || null,
            record_type: entry.record_type || null,
            old_values: entry.old_values ? JSON.stringify(entry.old_values) : null,
            new_values: entry.new_values ? JSON.stringify(entry.new_values) : null,
            ip_address: null,
            created_at: new Date().toISOString(),
        }]);

        if (legacyError && legacyError.code !== '42P01' && legacyError.code !== 'PGRST205') {
            console.warn('[AuditLog] Failed to mirror legacy audit entry:', legacyError);
        }
    } catch (error) {
        console.warn('[AuditLog] Failed to write audit entry:', error);
    }
}
