import nodemailer from 'nodemailer';
import { buildEmailActionUrl } from '@/lib/email-action';

// =============================================
// Azure AD — ขอ access token (Microsoft Graph)
// =============================================
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAzureAccessToken(): Promise<string | null> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) return null;

  // ใช้ cached token ถ้ายังไม่หมดอายุ
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  try {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Email] Azure token error:', res.status, errText);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      // Cache token (ลบ 60 วินาที เพื่อ safety margin)
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };
      return data.access_token;
    }
    return null;
  } catch (error) {
    console.error('[Email] Azure token fetch failed:', error);
    return null;
  }
}

// =============================================
// ส่ง email ผ่าน Microsoft Graph API
// =============================================
async function sendViaGraphAPI(from: string, to: string, subject: string, html: string): Promise<boolean> {
  const token = await getAzureAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${from}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: to.split(',').map(email => ({
            emailAddress: { address: email.trim() },
          })),
        },
      }),
    });

    if (res.status === 202 || res.ok) {
      return true;
    }

    const errText = await res.text();
    console.error('[Email] Graph API error:', res.status, errText);
    return false;
  } catch (error) {
    console.error('[Email] Graph API send failed:', error);
    return false;
  }
}

// =============================================
// Fallback: ส่งผ่าน SMTP (nodemailer)
// =============================================
async function sendViaSMTP(from: string, to: string, subject: string, html: string): Promise<boolean> {
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpPass || smtpPass === 'your-app-password') return false;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: from, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"ระบบแมสเซ็นเจอร์" <${from}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('[Email] SMTP fallback failed:', error);
    return false;
  }
}

// =============================================
// Public API — ส่ง email
// 1. Microsoft Graph API (primary)
// 2. SMTP password (fallback)
// =============================================
interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions): Promise<boolean> {
  const from = process.env.SMTP_USER;
  if (!from) {
    console.warn('[Email] No SMTP_USER configured, skipping...');
    return false;
  }

  // ขั้นที่ 1: Microsoft Graph API
  const graphResult = await sendViaGraphAPI(from, to, subject, html);
  if (graphResult) {
    console.log(`[Email] ✓ Graph API → ${to}: ${subject}`);
    return true;
  }

  // ขั้นที่ 2: SMTP Fallback
  console.log('[Email] Graph API failed, trying SMTP fallback...');
  const smtpResult = await sendViaSMTP(from, to, subject, html);
  if (smtpResult) {
    console.log(`[Email] ✓ SMTP → ${to}: ${subject}`);
    return true;
  }

  console.error(`[Email] ✗ All methods failed for ${to}: ${subject}`);
  return false;
}

// =============================
// Email Templates
// =============================

export function emailNewTask(taskNumber: string, documentDesc: string, recipientName: string, requesterName: string) {
  return {
    subject: `📋 งานใหม่ ${taskNumber} — ${documentDesc}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:20px;border-radius:16px 16px 0 0;color:white;">
          <h2 style="margin:0;">📋 งานใหม่เข้ามา</h2>
          <p style="margin:5px 0 0;opacity:0.9;">${taskNumber}</p>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:6px 0;color:#6b7280;">เอกสาร:</td><td style="font-weight:600;">${documentDesc}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">ผู้รับ:</td><td>${recipientName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">ผู้สร้าง:</td><td>${requesterName}</td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">กรุณาจ่ายงานให้แมสเซ็นเจอร์ในกระดานจ่ายงาน</p>
        </div>
      </div>
    `,
  };
}

export function emailTaskAssigned(taskNumber: string, documentDesc: string, recipientName: string, address: string, messengerName: string) {
  return {
    subject: `🏍️ จ่ายงาน ${taskNumber} ให้คุณ — ${recipientName}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:20px;border-radius:16px 16px 0 0;color:white;">
          <h2 style="margin:0;">🏍️ งานใหม่สำหรับคุณ ${messengerName}</h2>
          <p style="margin:5px 0 0;opacity:0.9;">${taskNumber}</p>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:6px 0;color:#6b7280;">เอกสาร:</td><td style="font-weight:600;">${documentDesc}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">ส่งถึง:</td><td>${recipientName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">ที่อยู่:</td><td>${address}</td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">เปิดแอปเพื่อดูรายละเอียดและเริ่มวิ่งงาน</p>
        </div>
      </div>
    `,
  };
}

export function emailIssueAlert(
  taskNumber: string, issueType: string, messengerName: string, description: string,
  taskId?: number, taskInfo?: { documentDesc: string; recipientName: string; address: string }
) {
  // สร้างปุ่ม action ถ้ามี taskId
  let actionButtons = '';
  if (taskId) {
    const cancelUrl = buildEmailActionUrl(taskId, 'cancel');
    const rescheduleUrl = buildEmailActionUrl(taskId, 'reschedule');
    actionButtons = `
      <div style="margin-top:16px;display:flex;gap:8px;">
        <a href="${rescheduleUrl}" style="flex:1;display:block;padding:12px 0;text-align:center;border-radius:10px;background:#f59e0b;color:white;font-weight:700;font-size:14px;text-decoration:none;">🔄 ส่งกลับเข้าคิว</a>
        <a href="${cancelUrl}" style="flex:1;display:block;padding:12px 0;text-align:center;border-radius:10px;background:#ef4444;color:white;font-weight:700;font-size:14px;text-decoration:none;">✕ ยกเลิกงาน</a>
      </div>
      <p style="margin:8px 0 0;font-size:10px;color:#d1d5db;text-align:center;">ลิงก์มีอายุ 72 ชั่วโมง • เข้ารหัส HMAC-SHA256</p>
    `;
  }

  return {
    subject: `🔴 แจ้งปัญหา ${taskNumber} — ${issueType}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:20px;border-radius:16px 16px 0 0;color:white;">
          <h2 style="margin:0;">🔴 แจ้งปัญหาหน้างาน</h2>
          <p style="margin:5px 0 0;opacity:0.9;">${taskNumber}</p>
        </div>
        <div style="background:#fef2f2;padding:20px;border:1px solid #fecaca;border-top:0;border-radius:0 0 16px 16px;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:6px 0;color:#6b7280;">ประเภทปัญหา:</td><td style="font-weight:600;color:#dc2626;">${issueType}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">แมสเซ็นเจอร์:</td><td>${messengerName}</td></tr>
            ${description ? `<tr><td style="padding:6px 0;color:#6b7280;">รายละเอียด:</td><td>${description}</td></tr>` : ''}
          </table>
          ${taskInfo ? `
          <div style="margin-top:14px;padding:12px;background:white;border-radius:8px;border:1px solid #fecaca;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;">📋 รายละเอียดใบงาน</p>
            <table style="width:100%;font-size:13px;">
              <tr><td style="padding:3px 0;color:#9ca3af;width:70px;">เอกสาร:</td><td style="font-weight:600;">${taskInfo.documentDesc}</td></tr>
              <tr><td style="padding:3px 0;color:#9ca3af;">ส่งถึง:</td><td>${taskInfo.recipientName}</td></tr>
              <tr><td style="padding:3px 0;color:#9ca3af;">ที่อยู่:</td><td>${taskInfo.address}</td></tr>
            </table>
          </div>
          ` : ''}
          <p style="margin:16px 0 0;font-size:13px;color:#6b7280;font-weight:600;">กรุณาตัดสินใจ:</p>
          ${actionButtons}
        </div>
      </div>
    `,
  };
}

export function emailTaskCompleted(taskNumber: string, recipientName: string, requesterName: string, podUrl?: string) {
  const podSection = podUrl ? `
    <tr><td style="padding:6px 0;color:#6b7280;">หลักฐาน:</td><td><a href="${podUrl}" style="color:#16a34a;text-decoration:underline;">📸 ดูรูปหลักฐานการส่ง</a></td></tr>
  ` : '';

  return {
    subject: `✅ ส่งสำเร็จ ${taskNumber} — ${recipientName}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:20px;border-radius:16px 16px 0 0;color:white;">
          <h2 style="margin:0;">✅ ส่งเอกสารสำเร็จ</h2>
          <p style="margin:5px 0 0;opacity:0.9;">${taskNumber}</p>
        </div>
        <div style="background:#f0fdf4;padding:20px;border:1px solid #bbf7d0;border-top:0;border-radius:0 0 16px 16px;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:6px 0;color:#6b7280;">ผู้รับ:</td><td style="font-weight:600;">${recipientName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">เวลา:</td><td>${new Date().toLocaleString('th-TH')}</td></tr>
            ${podSection}
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">คุณ ${requesterName} — เอกสารถึงผู้รับแล้วเรียบร้อย</p>
        </div>
      </div>
    `,
  };
}

export function emailDocumentReturned(taskNumber: string, recipientName: string, requesterName: string, podUrl?: string) {
  const podSection = podUrl ? `
    <tr><td style="padding:6px 0;color:#6b7280;">หลักฐาน:</td><td><a href="${podUrl}" style="color:#0891b2;text-decoration:underline;">📸 ดูรูปเอกสารที่คืน</a></td></tr>
  ` : '';

  return {
    subject: `📦 คืนเอกสารสำเร็จ ${taskNumber} — ${recipientName}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#06b6d4,#0891b2);padding:20px;border-radius:16px 16px 0 0;color:white;">
          <h2 style="margin:0;">📦 คืนเอกสาร/เช็คเรียบร้อย</h2>
          <p style="margin:5px 0 0;opacity:0.9;">${taskNumber}</p>
        </div>
        <div style="background:#ecfeff;padding:20px;border:1px solid #a5f3fc;border-top:0;border-radius:0 0 16px 16px;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:6px 0;color:#6b7280;">ผู้รับเดิม:</td><td style="font-weight:600;">${recipientName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">เวลาคืน:</td><td>${new Date().toLocaleString('th-TH')}</td></tr>
            ${podSection}
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">คุณ ${requesterName} — แมสเซ็นเจอร์นำเอกสาร/เช็คมาวางคืนที่ออฟฟิศแล้ว</p>
        </div>
      </div>
    `,
  };
}
