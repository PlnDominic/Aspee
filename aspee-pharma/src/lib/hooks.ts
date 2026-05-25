import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const REPORT_DEPARTMENTS = [
    'Administration',
    'Sales',
    'Stores',
    'Purchasing',
    'Accounts',
    'Production',
    'Quality Assurance',
    'Human Resources',
    'Internal Audit',
] as const;

export type ReportDepartment = typeof REPORT_DEPARTMENTS[number];

// Generic fetch hook
export function useFetch<T>(
    key: string[],
    queryFn: () => Promise<{ data: T | null; error: Error | null }>,
    options?: {
        enabled?: boolean;
        onError?: (error: Error) => void;
    }
) {
    return useQuery({
        queryKey: key,
        queryFn: async () => {
            const { data, error } = await queryFn();
            if (error) throw error;
            return data as T;
        },
        enabled: options?.enabled ?? true,
        meta: {
            onError: options?.onError,
        },
    });
}

// Fetch all records from a table (most common page pattern)
export function useSupabaseQuery<T>(
    table: string,
    options?: {
        columns?: string;
        orderBy?: string;
        ascending?: boolean;
        enabled?: boolean;
    }
) {
    const { columns = '*', orderBy = 'created_at', ascending = false, enabled = true } = options || {};

    return useQuery({
        queryKey: [table, columns, orderBy, ascending],
        queryFn: async () => {
            const { data, error } = await supabase
                .from(table)
                .select(columns)
                .order(orderBy, { ascending });
            if (error) throw error;
            return (data || []) as T[];
        },
        enabled,
    });
}

// Combined create-or-update mutation (handles the id check pattern)
export function useSave<T>(table: string, options?: {
    invalidateKeys?: string[];
    successMessage?: { create?: string; update?: string };
    onSuccess?: (data: T, isUpdate: boolean) => void;
    onError?: (error: Error) => void;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: Record<string, unknown>) => {
            const { id, ...rest } = input;
            if (id) {
                const { data: result, error } = await supabase
                    .from(table)
                    .update(rest)
                    .eq('id', id as string)
                    .select()
                    .single();
                if (error) throw error;
                return { data: result as T, isUpdate: true };
            } else {
                const { data: result, error } = await supabase
                    .from(table)
                    .insert([rest])
                    .select()
                    .single();
                if (error) throw error;
                return { data: result as T, isUpdate: false };
            }
        },
        onSuccess: ({ data, isUpdate }) => {
            queryClient.invalidateQueries({ queryKey: [table] });
            options?.invalidateKeys?.forEach(key =>
                queryClient.invalidateQueries({ queryKey: [key] })
            );
            const msg = isUpdate
                ? (options?.successMessage?.update || 'Updated successfully')
                : (options?.successMessage?.create || 'Created successfully');
            toast.success(msg);
            options?.onSuccess?.(data, isUpdate);
        },
        onError: (error) => {
            toast.error(error.message);
            options?.onError?.(error);
        },
    });
}

// Generic mutation hook for complex multi-step operations
export function useAction<TInput = void, TOutput = void>(options: {
    mutationFn: (input: TInput) => Promise<TOutput>;
    invalidateKeys?: string[];
    successMessage?: string;
    onSuccess?: (data: TOutput) => void;
    onError?: (error: Error) => void;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: options.mutationFn,
        onSuccess: (data) => {
            options.invalidateKeys?.forEach(key =>
                queryClient.invalidateQueries({ queryKey: [key] })
            );
            if (options.successMessage) toast.success(options.successMessage);
            options.onSuccess?.(data);
        },
        onError: (error) => {
            // Also invalidate on error — partial writes (non-transactional)
            // may have changed data even though the overall operation failed
            options.invalidateKeys?.forEach(key =>
                queryClient.invalidateQueries({ queryKey: [key] })
            );
            toast.error(error.message);
            options.onError?.(error);
        },
    });
}

// Table data fetch hook with pagination, search, and sorting
export function useTableData<T>(
    table: string,
    options?: {
        columns?: string;
        filters?: Record<string, unknown>;
        searchColumn?: string | string[];
        searchQuery?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        page?: number;
        pageSize?: number;
        enabled?: boolean;
    }
) {
    const {
        columns = '*',
        filters = {},
        searchColumn,
        searchQuery,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        pageSize = 10,
        enabled = true,
    } = options || {};

    return useQuery({
        queryKey: [table, filters, searchQuery, sortBy, sortOrder, page, pageSize],
        queryFn: async () => {
            let query = supabase.from(table).select(columns, { count: 'exact' });

            // Apply filters
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    if (Array.isArray(value)) {
                        query = query.in(key, value);
                    } else if (typeof value === 'string' && value.includes('%')) {
                        query = query.like(key, value);
                    } else {
                        query = query.eq(key, value);
                    }
                }
            });

            // Apply search
            if (searchColumn && searchQuery) {
                if (Array.isArray(searchColumn)) {
                    const orFilter = searchColumn
                        .map(col => `${col}.ilike.%${searchQuery}%`)
                        .join(',');
                    query = query.or(orFilter);
                } else {
                    query = query.ilike(searchColumn, `%${searchQuery}%`);
                }
            }

            // Apply sorting
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });

            // Apply pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            return {
                data: data as T[],
                total: count || 0,
                page,
                pageSize,
                totalPages: Math.ceil((count || 0) / pageSize),
            };
        },
        enabled,
    });
}

// CRUD Mutations
export function useCreate<T>(table: string, options?: {
    invalidateKeys?: string[];
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<T>) => {
            const { data: result, error } = await supabase
                .from(table)
                .insert([data])
                .select()
                .single();

            if (error) throw error;
            return result as T;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [table] });
            options?.invalidateKeys?.forEach(key =>
                queryClient.invalidateQueries({ queryKey: [key] })
            );
            toast.success('Created successfully');
            options?.onSuccess?.(data);
        },
        onError: (error) => {
            toast.error(error.message);
            options?.onError?.(error);
        },
    });
}

export function useUpdate<T extends { id: string }>(table: string, options?: {
    invalidateKeys?: string[];
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<T>) => {
            const { id, ...updateData } = data;
            const { data: result, error } = await supabase
                .from(table)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return result as T;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [table] });
            options?.invalidateKeys?.forEach(key =>
                queryClient.invalidateQueries({ queryKey: [key] })
            );
            toast.success('Updated successfully');
            options?.onSuccess?.(data);
        },
        onError: (error) => {
            toast.error(error.message);
            options?.onError?.(error);
        },
    });
}

export function useDelete(table: string, options?: {
    invalidateKeys?: string[];
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [table] });
            options?.invalidateKeys?.forEach(key =>
                queryClient.invalidateQueries({ queryKey: [key] })
            );
            toast.success('Deleted successfully');
            options?.onSuccess?.();
        },
        onError: (error) => {
            toast.error(error.message);
            options?.onError?.(error);
        },
    });
}

// Count hook
export function useCount(table: string, filters?: Record<string, unknown>) {
    return useQuery({
        queryKey: ['count', table, filters],
        queryFn: async () => {
            let query = supabase.from(table).select('*', { count: 'exact', head: true });

            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (Array.isArray(value)) {
                            query = query.in(key, value);
                        } else {
                            query = query.eq(key, value);
                        }
                    }
                });
            }

            const { count, error } = await query;
            if (error) throw error;
            return count || 0;
        },
    });
}

// Current user hook
export function useCurrentUser() {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            if (!user) return null;

            const { data: byId } = await supabase
                .from('system_users')
                .select('*')
                .eq('auth_user_id', user.id)
                .maybeSingle();

            if (byId) return byId;

            // Fallback 1: match by email (covers users added before auth_user_id was stored)
            const { data: byEmail } = await supabase
                .from('system_users')
                .select('*')
                .ilike('email', user.email!)
                .maybeSingle();

            if (byEmail) {
                // If found by email, return it (and link it in the background if possible, but here just return)
                return byEmail;
            }

            return null;
        },
    });
}

// Notification hook with Realtime
export function useNotifications() {
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();

    // Fetch notifications
    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications', user?.department],
        queryFn: async () => {
            let query = supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            // Filter by department if available
            if (user?.department) {
                query = query.or(`target_role.eq.${user.department},target_role.is.null`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    // Subscribe to realtime updates
    React.useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => {
                    const newNotif = payload.new;
                    // Check if it's for this user's department or global
                    if (!newNotif.target_role || newNotif.target_role === user.department) {
                        toast.info(newNotif.title, {
                            description: newNotif.message,
                        });
                        queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const markAsRead = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsRead = useMutation({
        mutationFn: async () => {
            const visibleNotificationIds = notifications
                .filter((notification: any) => !notification.is_read)
                .map((notification: any) => notification.id);

            if (visibleNotificationIds.length === 0) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .in('id', visibleNotificationIds);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    return {
        notifications,
        unreadCount: notifications.filter((n: any) => !n.is_read).length,
        isLoading,
        markAsRead,
        markAllAsRead,
    };
}
