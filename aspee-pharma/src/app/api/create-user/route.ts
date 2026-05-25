import { randomInt } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { USER_ADMIN_ROLES } from '@/lib/routePermissions';
import { createServiceRoleClient, requireRoles } from '@/lib/serverAuth';

const supabaseAdmin = createServiceRoleClient();

function generatePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const special = '@#!$%&*?';
    const all = upper + lower + digits + special;

    const rand = (set: string) => set[randomInt(0, set.length)];
    const parts = [rand(upper), rand(lower), rand(digits), rand(special)];

    while (parts.length < 18) {
        parts.push(rand(all));
    }

    for (let i = parts.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i + 1);
        [parts[i], parts[j]] = [parts[j], parts[i]];
    }

    return parts.join('');
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function welcomeEmailHtml(name: string, email: string, password: string, role: string) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#0891b2,#0d9488);border-radius:16px 16px 0 0;padding:32px 36px;text-align:center;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#ffffff;">Welcome to Aspee Pharma</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Your account has been created by an administrator</p>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:36px;">
        <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
        <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
          An account has been created for you on the <strong>Aspee Pharmaceuticals Factory Management System</strong>.
          You have been assigned the role of <strong>${role}</strong>. Use the credentials below to sign in.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">Your Login Credentials</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;width:100px;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:700;color:#0f172a;font-family:monospace;">${email}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:#64748b;">Password</td>
              <td style="padding:10px 0;font-size:15px;font-weight:800;color:#0891b2;font-family:monospace;letter-spacing:0.05em;">${password}</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="https://aspee-pharma.vercel.app/login"
             style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0891b2,#0d9488);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.02em;">
            Sign In to Your Account
          </a>
        </div>
        <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
            <strong>Important:</strong> Please change your password immediately after your first login by going to <strong>Settings → Profile → Security</strong>.
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 20px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
          If you did not expect this email, please contact your system administrator.<br>
          © ${new Date().getFullYear()} Aspee Pharmaceuticals Limited
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
    try {
        const { error: authError } = await requireRoles(USER_ADMIN_ROLES);
        if (authError) return authError;

        const body = await req.json();
        const { name, email, phone, role, department, status, mfa_enabled } = body;

        if (!email || !name || !role) {
            return NextResponse.json({ error: 'name, email, and role are required.' }, { status: 400 });
        }

        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if (!smtpUser || !smtpPass) {
            return NextResponse.json(
                { error: 'SMTP must be configured before creating users.' },
                { status: 500 }
            );
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedName = String(name).trim();
        const normalizedRole = String(role).trim();
        const tempPassword = generatePassword();

        let createdAuthUserId: string | null = null;
        let createdSystemUserId: string | null = null;

        const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: normalizedName },
        });

        if (createAuthError || !authData.user?.id) {
            return NextResponse.json(
                { error: createAuthError?.message || 'Failed to create auth user.' },
                { status: 400 }
            );
        }

        createdAuthUserId = authData.user.id;

        const { data: newUser, error: dbError } = await supabaseAdmin
            .from('system_users')
            .insert([{
                name: normalizedName,
                email: normalizedEmail,
                phone,
                role: normalizedRole,
                department,
                status,
                mfa_enabled,
                auth_user_id: createdAuthUserId,
            }])
            .select()
            .single();

        if (dbError) {
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            return NextResponse.json({ error: dbError.message }, { status: 400 });
        }

        createdSystemUserId = newUser.id;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: smtpUser, pass: smtpPass },
        });

        try {
            await transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Aspee Pharma System'}" <${smtpUser}>`,
                to: normalizedEmail,
                subject: 'Your Aspee Pharma Account — Login Credentials',
                html: welcomeEmailHtml(
                    escapeHtml(normalizedName),
                    escapeHtml(normalizedEmail),
                    tempPassword,
                    escapeHtml(normalizedRole)
                ),
            });
        } catch (mailErr: any) {
            if (createdSystemUserId) {
                await supabaseAdmin.from('system_users').delete().eq('id', createdSystemUserId);
            }
            if (createdAuthUserId) {
                await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            }
            return NextResponse.json(
                { error: `Failed to send welcome email: ${mailErr.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, user: newUser, emailSent: true });
    } catch (err: any) {
        console.error('[create-user]', err);
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
    }
}
