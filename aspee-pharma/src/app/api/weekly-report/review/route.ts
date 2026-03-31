import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, reviewer, approvalNotes } = body || {};

        if (!id || !action) {
            return NextResponse.json({ error: 'id and action are required.' }, { status: 400 });
        }

        const updatePayload: Record<string, unknown> = {};
        const now = new Date().toISOString();

        if (action === 'mark-read') {
            updatePayload.read_status = 'Read';
            updatePayload.reviewed_at = now;
            updatePayload.reviewed_by = reviewer || 'Managing Director';
        } else if (action === 'approve') {
            updatePayload.read_status = 'Read';
            updatePayload.reviewed_at = now;
            updatePayload.reviewed_by = reviewer || 'Managing Director';
            updatePayload.status = 'Approved';
            updatePayload.approved_at = now;
            updatePayload.approved_by = reviewer || 'Managing Director';
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
