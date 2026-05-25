import { NextRequest, NextResponse } from 'next/server';
import { REPORT_ADMIN_ROLES } from '@/lib/routePermissions';
import { createServiceRoleClient, requireRoles } from '@/lib/serverAuth';

const supabase = createServiceRoleClient();

export async function POST(request: NextRequest) {
    try {
        const { appUser, error: authError } = await requireRoles(REPORT_ADMIN_ROLES);
        if (authError || !appUser) return authError;

        const body = await request.json();
        const { id, action, approvalNotes } = body || {};

        if (!id || !action) {
            return NextResponse.json({ error: 'id and action are required.' }, { status: 400 });
        }

        const reviewerName = appUser.systemUser.name || appUser.systemUser.role || 'Reviewer';
        const updatePayload: Record<string, unknown> = {};
        const now = new Date().toISOString();

        if (action === 'mark-read') {
            updatePayload.read_status = 'Read';
            updatePayload.reviewed_at = now;
            updatePayload.reviewed_by = reviewerName;
        } else if (action === 'approve') {
            updatePayload.read_status = 'Read';
            updatePayload.reviewed_at = now;
            updatePayload.reviewed_by = reviewerName;
            updatePayload.status = 'Approved';
            updatePayload.approved_at = now;
            updatePayload.approved_by = reviewerName;
            updatePayload.approval_notes = approvalNotes || null;
        } else {
            return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('weekly_reports')
            .update(updatePayload)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, report: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update report review status.' }, { status: 500 });
    }
}
