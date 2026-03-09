import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { trackApiRequest } from '@/lib/api-rate-limit';

// GET — ดึงข้อมูลโปรไฟล์ตัวเอง
export async function GET(request: NextRequest) {
  try {
    trackApiRequest(request);
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await query<{
      Id: number; EmployeeId: string; FullName: string; Email: string | null;
      Phone: string | null; Department: string | null; Role: string;
      CreatedAt: string; LastLoginAt: string | null;
    }[]>(
      `SELECT Id, EmployeeId, FullName, Email, Phone, Department, Role, CreatedAt, LastLoginAt
       FROM Users WHERE Id = @id`,
      { id: parseInt(session.user.id) }
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
    }

    return NextResponse.json(users[0]);
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH — แก้ไขข้อมูลโปรไฟล์ตัวเอง
export async function PATCH(request: NextRequest) {
  try {
    trackApiRequest(request);
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, email, phone, currentPassword, newPassword } = body;
    const userId = parseInt(session.user.id);

    const updates: string[] = [];
    const sqlParams: Record<string, unknown> = { id: userId };

    // ข้อมูลพื้นฐาน
    if (fullName !== undefined && fullName.trim()) {
      updates.push('FullName = @fullName');
      sqlParams.fullName = fullName.trim();
    }
    if (email !== undefined) {
      updates.push('Email = @email');
      sqlParams.email = email?.trim() || null;
    }
    if (phone !== undefined) {
      updates.push('Phone = @phone');
      sqlParams.phone = phone?.trim() || null;
    }

    // เปลี่ยนรหัสผ่าน — ต้องมี currentPassword
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'กรุณาระบุรหัสผ่านปัจจุบัน' }, { status: 400 });
      }

      // ตรวจสอบรหัสผ่านปัจจุบัน
      const user = await query<{ PasswordHash: string }[]>(
        'SELECT PasswordHash FROM Users WHERE Id = @id',
        { id: userId }
      );

      if (!user[0]?.PasswordHash || user[0].PasswordHash === 'AD_USER_NO_LOCAL_PASSWORD') {
        return NextResponse.json({ error: 'ผู้ใช้ AD ไม่สามารถเปลี่ยนรหัสผ่านที่นี่ได้' }, { status: 400 });
      }

      const isValid = await bcrypt.compare(currentPassword, user[0].PasswordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      updates.push('PasswordHash = @passwordHash');
      sqlParams.passwordHash = hash;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
    }

    updates.push('UpdatedAt = GETDATE()');

    await query(
      `UPDATE Users SET ${updates.join(', ')} WHERE Id = @id`,
      sqlParams
    );

    // Audit log
    const changes = Object.keys(body).filter(k => !k.includes('assword')).join(', ');
    logAudit({
      action: 'user_updated',
      userId,
      targetType: 'user',
      targetId: userId,
      details: `แก้ไขโปรไฟล์ตัวเอง: ${changes || 'เปลี่ยนรหัสผ่าน'}`,
    });

    return NextResponse.json({ message: 'แก้ไขโปรไฟล์สำเร็จ' });
  } catch (error) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไข' }, { status: 500 });
  }
}
