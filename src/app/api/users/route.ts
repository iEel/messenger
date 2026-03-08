import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, sql } from '@/lib/db';
import type { User } from '@/lib/types';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET - ดึงรายชื่อ User ทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: Record<string, unknown> = {};

    if (role && role !== 'all') {
      whereClause += ' AND Role = @role';
      params.role = role;
    }

    if (search) {
      whereClause += ' AND (FullName LIKE @search OR EmployeeId LIKE @search OR Email LIKE @search)';
      params.search = `%${search}%`;
    }

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM Users ${whereClause}`,
      params
    );

    const users = await query<User[]>(
      `SELECT Id, EmployeeId, FullName, Email, Phone, Role, Department, IsActive, CreatedAt, UpdatedAt, LastLoginAt
       FROM Users ${whereClause}
       ORDER BY CreatedAt DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit }
    );

    return NextResponse.json({
      users,
      total: countResult[0]?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 });
  }
}

// POST - สร้าง User ใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, fullName, email, phone, password, role, department } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!employeeId || !fullName || !password || !role) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบ: รหัสพนักงาน, ชื่อ-สกุล, รหัสผ่าน, บทบาท' },
        { status: 400 }
      );
    }

    // ตรวจสอบรหัสพนักงานซ้ำ
    const existing = await query<User[]>(
      'SELECT Id FROM Users WHERE EmployeeId = @employeeId',
      { employeeId }
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'รหัสพนักงานนี้มีในระบบแล้ว' },
        { status: 409 }
      );
    }

    // เข้ารหัสรหัสผ่าน
    const passwordHash = await bcrypt.hash(password, 12);

    // สร้าง User
    const result = await query<{ Id: number }[]>(
      `INSERT INTO Users (EmployeeId, FullName, Email, Phone, PasswordHash, Role, Department)
       OUTPUT INSERTED.Id
       VALUES (@employeeId, @fullName, @email, @phone, @passwordHash, @role, @department)`,
      { employeeId, fullName, email: email || null, phone: phone || null, passwordHash, role, department: department || null }
    );

    // ★ Audit log
    const session = await auth();
    if (session?.user) {
      logAudit({ action: 'user_created', userId: parseInt(session.user.id), targetType: 'user', targetId: result[0].Id, details: `สร้างผู้ใช้: ${fullName} (${employeeId}) - ${role}` });
    }

    return NextResponse.json(
      { message: 'สร้างผู้ใช้สำเร็จ', userId: result[0].Id },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' }, { status: 500 });
  }
}
