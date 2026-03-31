import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { to, subject, html, cc } = body;

        if (!to || !subject || !html) {
            return NextResponse.json(
                { error: 'Missing required fields: to, subject, html' },
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

        const mailOptions: nodemailer.SendMailOptions = {
            from: `"Aspee Pharmaceuticals" <${process.env.SMTP_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
            ...(cc && { cc: Array.isArray(cc) ? cc.join(', ') : cc }),
        };

        const info = await transporter.sendMail(mailOptions);

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
