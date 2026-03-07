import nodemailer from 'nodemailer';

// =============================================
// Azure AD OAuth2 — ขอ access token สำหรับ SMTP
// =============================================
async function getAzureAccessToken(): Promise<string | null> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) return null;

  try {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://outlook.office365.com/.default',
      grant_type: 'client_credentials',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Email] Azure OAuth2 token error:', res.status, errText);
      return null;
    }

    const data = await res.json();
    return data.access_token || null;
  } catch (error) {
    console.error('[Email] Azure OAuth2 token fetch failed:', error);
    return null;
  }
}

// =============================================
// สร้าง transporter ตามลำดับความสำคัญ
// 1. Azure AD OAuth2 (primary)
// 2. SMTP username/password (fallback)
// =============================================
async function createTransporter(): Promise<nodemailer.Transporter> {
  const smtpUser = process.env.SMTP_USER;

  // ขั้นที่ 1: Azure AD OAuth2
  const accessToken = await getAzureAccessToken();
  if (accessToken && smtpUser) {
    console.log('[Email] Using Azure AD OAuth2 transport');
    return nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        type: 'OAuth2',
        user: smtpUser,
        accessToken,
      },
    } as nodemailer.TransportOptions);
  }

  // ขั้นที่ 2: Fallback SMTP (Outlook 365 / mail server ภายใน)
  console.log('[Email] Using SMTP fallback transport');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: smtpUser,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions): Promise<boolean> {
  try {
    const from = process.env.SMTP_USER;
    if (!from) {
      console.warn('[Email] No SMTP_USER configured, skipping...');
      return false;
    }

    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"ระบบแมสเซ็นเจอร์" <${from}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] ✓ Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('[Email] ✗ Failed:', error);
    return false;
  }
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

export function emailIssueAlert(taskNumber: string, issueType: string, messengerName: string, description: string) {
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
            <tr><td style="padding:6px 0;color:#6b7280;">ประเภท:</td><td style="font-weight:600;color:#dc2626;">${issueType}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">แมสเซ็นเจอร์:</td><td>${messengerName}</td></tr>
            ${description ? `<tr><td style="padding:6px 0;color:#6b7280;">รายละเอียด:</td><td>${description}</td></tr>` : ''}
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">กรุณาตัดสินใจ (คืนเอกสาร / เลื่อนวันส่ง) ที่กระดานจ่ายงาน</p>
        </div>
      </div>
    `,
  };
}

// ★ อัปเดต: เพิ่ม parameter podUrl สำหรับแนบลิงก์รูป POD
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

// ★ ใหม่: แจ้งเมื่อคืนเอกสาร (Round-trip returned)
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
