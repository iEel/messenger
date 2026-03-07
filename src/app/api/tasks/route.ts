import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { Task } from '@/lib/types';

// สร้างเลขที่ใบงานอัตโนมัติ
async function generateTaskNumber(): Promise<string> {
  const prefix = 'MSG';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // หาเลขล่าสุดของเดือนนี้
  const result = await query<{ MaxNum: string | null }[]>(
    `SELECT TOP 1 TaskNumber AS MaxNum FROM Tasks 
     WHERE TaskNumber LIKE @pattern 
     ORDER BY TaskNumber DESC`,
    { pattern: `${prefix}-${yearMonth}-%` }
  );

  let seq = 1;
  if (result.length > 0 && result[0].MaxNum) {
    const lastNum = result[0].MaxNum;
    const parts = lastNum.split('-');
    const lastSeq = parts.length >= 3 ? parseInt(parts[2]) || 0 : 0;
    seq = lastSeq + 1;
  }

  return `${prefix}-${yearMonth}-${String(seq).padStart(4, '0')}`;
}

// GET - ดึงรายการ Task
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const assignedTo = searchParams.get('assignedTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const role = session.user.role;

    let whereClause = 'WHERE 1=1';
    const params: Record<string, unknown> = {};

    // Requester เห็นเฉพาะงานตัวเอง
    if (role === 'requester') {
      whereClause += ' AND t.RequesterId = @userId';
      params.userId = parseInt(session.user.id);
    }

    // Messenger เห็นเฉพาะงานที่ได้รับมอบหมาย
    if (role === 'messenger') {
      whereClause += ' AND t.AssignedTo = @userId';
      params.userId = parseInt(session.user.id);
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        // ★ แสดงเฉพาะงานที่ยังไม่จบ (ไม่รวม completed/returned/cancelled)
        whereClause += " AND t.Status NOT IN ('completed','returned','cancelled')";
      } else {
        whereClause += ' AND t.Status = @status';
        params.status = status;
      }
    }

    if (search) {
      whereClause += ' AND (t.TaskNumber LIKE @search OR t.RecipientName LIKE @search OR t.DocumentDesc LIKE @search)';
      params.search = `%${search}%`;
    }

    if (assignedTo) {
      whereClause += ' AND t.AssignedTo = @assignedTo';
      params.assignedTo = parseInt(assignedTo);
    }

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM Tasks t ${whereClause}`,
      params
    );

    const tasks = await query<(Task & { RequesterName: string; MessengerName: string | null })[]>(
      `SELECT t.*, 
              u1.FullName AS RequesterName, 
              u2.FullName AS MessengerName
       FROM Tasks t
       LEFT JOIN Users u1 ON t.RequesterId = u1.Id
       LEFT JOIN Users u2 ON t.AssignedTo = u2.Id
       ${whereClause}
       ORDER BY 
         CASE WHEN t.Status = 'issue' THEN 0 ELSE 1 END,
         t.CreatedAt DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit }
    );

    return NextResponse.json({
      tasks,
      total: countResult[0]?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง Task ใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      recipientName, recipientPhone, recipientCompany,
      taskType, documentDesc, notes,
      address, district, subDistrict, province, postalCode,
      latitude, longitude, googleMapsUrl,
      priority, scheduledDate,
    } = body;

    if (!recipientName || !documentDesc || !address) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลที่จำเป็น: ชื่อผู้รับ, รายละเอียดเอกสาร, ที่อยู่' },
        { status: 400 }
      );
    }

    const taskNumber = await generateTaskNumber();

    const result = await query<{ Id: number }[]>(
      `INSERT INTO Tasks (
        TaskNumber, RequesterId, RecipientName, RecipientPhone, RecipientCompany,
        TaskType, DocumentDesc, Notes,
        Address, District, SubDistrict, Province, PostalCode,
        Latitude, Longitude, GoogleMapsUrl,
        Priority, ScheduledDate, Status
      )
      OUTPUT INSERTED.Id
      VALUES (
        @taskNumber, @requesterId, @recipientName, @recipientPhone, @recipientCompany,
        @taskType, @documentDesc, @notes,
        @address, @district, @subDistrict, @province, @postalCode,
        @latitude, @longitude, @googleMapsUrl,
        @priority, @scheduledDate, 'new'
      )`,
      {
        taskNumber,
        requesterId: parseInt(session.user.id),
        recipientName,
        recipientPhone: recipientPhone || null,
        recipientCompany: recipientCompany || null,
        taskType: taskType || 'oneway',
        documentDesc,
        notes: notes || null,
        address,
        district: district || null,
        subDistrict: subDistrict || null,
        province: province || null,
        postalCode: postalCode || null,
        latitude: latitude || null,
        longitude: longitude || null,
        googleMapsUrl: googleMapsUrl || null,
        priority: priority || 'normal',
        scheduledDate: scheduledDate || null,
      }
    );

    // บันทึกประวัติสถานะ
    await query(
      `INSERT INTO TaskStatusHistory (TaskId, Status, ChangedBy, Notes)
       VALUES (@taskId, 'new', @userId, N'สร้างใบงานใหม่')`,
      { taskId: result[0].Id, userId: parseInt(session.user.id) }
    );

    return NextResponse.json(
      { message: 'สร้างใบงานสำเร็จ', taskId: result[0].Id, taskNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างใบงาน' }, { status: 500 });
  }
}
