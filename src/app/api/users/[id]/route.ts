import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import type { User } from '@/lib/types';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET - ดึงข้อมูล User ตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const users = await query<User[]>(
      `SELECT Id, EmployeeId, FullName, Email, Phone, Role, Department, IsActive, CreatedAt, UpdatedAt, LastLoginAt 
       FROM Users WHERE Id = @id`,
      { id: parseInt(id) }
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    return NextResponse.json(users[0]);
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH - แก้ไข User
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fullName, email, phone, password, role, department, isActive } = body;

    const updates: string[] = [];
    const sqlParams: Record<string, unknown> = { id: parseInt(id) };

    if (fullName !== undefined) { updates.push('FullName = @fullName'); sqlParams.fullName = fullName; }
    if (email !== undefined) { updates.push('Email = @email'); sqlParams.email = email || null; }
    if (phone !== undefined) { updates.push('Phone = @phone'); sqlParams.phone = phone || null; }
    if (role !== undefined) { updates.push('Role = @role'); sqlParams.role = role; }
    if (department !== undefined) { updates.push('Department = @department'); sqlParams.department = department || null; }
    if (isActive !== undefined) { updates.push('IsActive = @isActive'); sqlParams.isActive = isActive ? 1 : 0; }
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push('PasswordHash = @passwordHash');
      sqlParams.passwordHash = passwordHash;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
    }

    updates.push('UpdatedAt = GETDATE()');

    await query(
      `UPDATE Users SET ${updates.join(', ')} WHERE Id = @id`,
      sqlParams
    );

    // ★ Audit log
    const session = await auth();
    const changes = Object.keys(body).filter(k => k !== 'password').join(', ');
    if (session?.user) {
      logAudit({ action: 'user_updated', userId: parseInt(session.user.id), targetType: 'user', targetId: parseInt(id), details: `แก้ไข: ${changes}` });
    }

    return NextResponse.json({ message: 'แก้ไขผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไข' }, { status: 500 });
  }
}

// DELETE - ลบ User (Soft Delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query(
      'UPDATE Users SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @id',
      { id: parseInt(id) }
    );

    // ★ Audit log
    const session = await auth();
    if (session?.user) {
      logAudit({ action: 'user_updated', userId: parseInt(session.user.id), targetType: 'user', targetId: parseInt(id), details: 'ปิดการใช้งานผู้ใช้' });
    }

    return NextResponse.json({ message: 'ปิดการใช้งานผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
