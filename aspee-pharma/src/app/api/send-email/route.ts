import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { USER_ADMIN_ROLES } from '@/lib/routePermissions';
import { createServiceRoleClient, requireRoles } from '@/lib/serverAuth';
import { readJsonBody } from '@/lib/requestLimits';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
    try {
        const { appUser, error: authError } = await requireRoles(USER_ADMIN_ROLES);
        if (authError || !appUser) return authError;

        const rateLimitError = await enforceRateLimit('send-email', [
            { keyType: 'user', keyValue: appUser.authUser.id, max: 30, windowMinutes: 15 },
            { keyType: 'ip', keyValue: getClientIp(request), max: 60, windowMinutes: 15 },
        ]);
        if (rateLimitError) return rateLimitError;

        const { body, error: bodyError } = await readJsonBody<any>(request, 512 * 1024);
        if (bodyError) return bodyError;
        const { to, subject, html, cc } = body || {};

        if (!to || !subject || !html) {
            return NextResponse.json(
                { error: 'Missing required fields: to, subject, html' },
                { status: 400 }
            );
        }

        const recipients = (Array.isArray(to) ? to : [to]).map((entry) => String(entry).trim().toLowerCase());
        const ccRecipients = (Array.isArray(cc) ? cc : cc ? [cc] : []).map((entry) => String(entry).trim().toLowerCase());

        if (recipients.length === 0 || recipients.length > 100 || ccRecipients.length > 25) {
            return NextResponse.json({ error: 'Recipient count is out of allowed range.' }, { status: 400 });
        }

        const supabaseAdmin = createServiceRoleClient();
        const { data: activeUsers, error: userError } = await supabaseAdmin
            .from('system_users')
            .select('email')
            .eq('status', 'Active');

        if (userError) {
            return NextResponse.json({ error: 'Unable to validate recipients.' }, { status: 500 });
        }

        const allowedEmails = new Set(
            (activeUsers || [])
                .map((user: { email?: string | null }) => user.email?.toLowerCase())
                .filter(Boolean)
        );

        const invalidRecipient = [...recipients, ...ccRecipients].find((email) => !allowedEmails.has(email));
        if (invalidRecipient) {
            return NextResponse.json(
                { error: `Recipient ${invalidRecipient} is not an active system user.` },
                { status: 400 }
            );
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: `"Aspee Pharmaceuticals" <${process.env.SMTP_USER}>`,
            to: recipients.join(', '),
            subject,
            html,
            ...(ccRecipients.length > 0 && { cc: ccRecipients.join(', ') }),
        });

        return NextResponse.json({
            success: true,
            messageId: info.messageId,
        });
    } catch (error: any) {
        console.error('Email send error:', error);
        return NextResponse.json(
            { error: 'Failed to send email: ' + error.message },
            { status: 500 }
        );
    }
}
