import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendMail } from '@/lib/email';

// POST — ส่ง test email เพื่อตรวจสอบว่า email ทำงานหรือไม่  
export async function POST(request: NextRequest) {
  try {

    const { to } = await request.json();
    const targetEmail = to || 'veerapon.l@sonic.co.th';

    const result = await sendMail({
      to: targetEmail,
      subject: '🧪 ทดสอบระบบอีเมล — Messenger Tracking System',
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:20px;border-radius:16px 16px 0 0;color:white;">
            <h2 style="margin:0;">🧪 ทดสอบระบบอีเมล</h2>
            <p style="margin:5px 0 0;opacity:0.9;">Messenger Tracking System</p>
          </div>
          <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;">
            <p style="font-size:14px;">ถ้าคุณเห็นอีเมลนี้ แสดงว่าระบบส่งอีเมลทำงานถูกต้อง ✅</p>
            <table style="width:100%;font-size:14px;margin-top:12px;">
              <tr><td style="padding:6px 0;color:#6b7280;">ส่งไป:</td><td style="font-weight:600;">${targetEmail}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">เวลา:</td><td>${new Date().toLocaleString('th-TH')}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Transport:</td><td>Azure AD OAuth2 / SMTP Fallback</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ 
      success: result, 
      to: targetEmail,
      message: result ? 'ส่งอีเมลสำเร็จ!' : 'ส่งอีเมลไม่สำเร็จ — ดู server log',
    });
  } catch (error) {
    console.error('POST /api/test-email error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
