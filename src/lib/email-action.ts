import crypto from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || 'email-action-secret';

export interface EmailActionPayload {
  taskId: number;
  action: 'cancel' | 'reschedule' | 'view';
  expiresAt: number; // Unix timestamp
}

// สร้าง action token (ใช้ได้ 72 ชม.)
export function createEmailActionToken(taskId: number, action: EmailActionPayload['action']): string {
  const payload: EmailActionPayload = {
    taskId,
    action,
    expiresAt: Date.now() + 72 * 60 * 60 * 1000, // 72 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// ตรวจสอบ token
export function verifyEmailActionToken(token: string): EmailActionPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload: EmailActionPayload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

// สร้าง URL สำหรับปุ่มใน email
export function buildEmailActionUrl(taskId: number, action: EmailActionPayload['action']): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const token = createEmailActionToken(taskId, action);
  return `${baseUrl}/email-action?token=${token}`;
}
