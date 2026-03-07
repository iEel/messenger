import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { Task, TaskStatusHistoryEntry } from '@/lib/types';
import { sendMail, emailTaskAssigned, emailIssueAlert, emailTaskCompleted } from '@/lib/email';

// GET - ดึงรายละเอียด Task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const tasks = await query<(Task & { RequesterName: string; RequesterEmail: string; MessengerName: string | null })[]>(
      `SELECT t.*, 
              u1.FullName AS RequesterName, u1.Email AS RequesterEmail,
              u2.FullName AS MessengerName
       FROM Tasks t
       LEFT JOIN Users u1 ON t.RequesterId = u1.Id
       LEFT JOIN Users u2 ON t.AssignedTo = u2.Id
       WHERE t.Id = @id`,
      { id: parseInt(id) }
    );

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'ไม่พบใบงาน' }, { status: 404 });
    }

    // ดึงประวัติสถานะ
    const history = await query<(TaskStatusHistoryEntry & { ChangedByName: string })[]>(
      `SELECT tsh.*, u.FullName AS ChangedByName
       FROM TaskStatusHistory tsh
       LEFT JOIN Users u ON tsh.ChangedBy = u.Id
       WHERE tsh.TaskId = @id
       ORDER BY tsh.CreatedAt ASC`,
      { id: parseInt(id) }
    );

    // ดึงหลักฐานการส่ง (POD)
    const pod = await query<{ Id: number; Type: string; FilePath: string; FileName: string; CreatedAt: string }[]>(
      `SELECT Id, Type, FilePath, FileName, CreatedAt
       FROM ProofOfDelivery
       WHERE TaskId = @id
       ORDER BY CreatedAt ASC`,
      { id: parseInt(id) }
    );

    return NextResponse.json({
      task: tasks[0],
      history,
      pod,
    });
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH - แก้ไข Task (assign, update status, roundtrip)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, assignedTo, notes, latitude, longitude } = body;

    const updates: string[] = [];
    const sqlParams: Record<string, unknown> = { id: parseInt(id) };

    if (status) {
      updates.push('Status = @status');
      sqlParams.status = status;

      if (status === 'completed' || status === 'returned') {
        updates.push('CompletedAt = GETDATE()');
      }
    }

    if (assignedTo !== undefined) {
      updates.push('AssignedTo = @assignedTo');
      sqlParams.assignedTo = assignedTo;
    }

    if (updates.length > 0) {
      updates.push('UpdatedAt = GETDATE()');
      await query(
        `UPDATE Tasks SET ${updates.join(', ')} WHERE Id = @id`,
        sqlParams
      );
    }

    // บันทึกประวัติถ้ามีการเปลี่ยนสถานะ
    if (status) {
      await query(
        `INSERT INTO TaskStatusHistory (TaskId, Status, ChangedBy, Notes, Latitude, Longitude)
         VALUES (@taskId, @status, @userId, @notes, @lat, @lng)`,
        {
          taskId: parseInt(id),
          status,
          userId: parseInt(session.user.id),
          notes: notes || null,
          lat: latitude || null,
          lng: longitude || null,
        }
      );
    }

    // ส่งอีเมลแจ้งเตือนตามสถานะ (async, ไม่ block response)
    if (status) {
      sendEmailNotification(parseInt(id), status, notes).catch(err =>
        console.error('[Email] Background send failed:', err)
      );
    }

    return NextResponse.json({ message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - แก้ไขข้อมูลใบงาน (เฉพาะสถานะ new)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // ตรวจสอบสถานะ — แก้ไขได้เฉพาะสถานะ new
    const existing = await query<{ Status: string; RequesterId: number }[]>(
      `SELECT Status, RequesterId FROM Tasks WHERE Id = @id`,
      { id: parseInt(id) }
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'ไม่พบใบงาน' }, { status: 404 });
    }

    // เฉพาะเจ้าของงานหรือ admin เท่านั้น
    const isOwner = existing[0].RequesterId === parseInt(session.user.id);
    const isAdmin = session.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขใบงานนี้' }, { status: 403 });
    }

    if (existing[0].Status !== 'new') {
      return NextResponse.json({ error: 'แก้ไขได้เฉพาะใบงานที่ยังไม่ถูกจ่ายงาน (สถานะ: รอจ่ายงาน)' }, { status: 400 });
    }

    const body = await request.json();
    const {
      recipientName, recipientPhone, recipientCompany,
      taskType, documentDesc, notes,
      address, district, subDistrict, province, postalCode,
      latitude, longitude, googleMapsUrl,
      priority, scheduledDate,
    } = body;

    await query(
      `UPDATE Tasks SET
        RecipientName = @recipientName,
        RecipientPhone = @recipientPhone,
        RecipientCompany = @recipientCompany,
        TaskType = @taskType,
        DocumentDesc = @documentDesc,
        Notes = @notes,
        Address = @address,
        District = @district,
        SubDistrict = @subDistrict,
        Province = @province,
        PostalCode = @postalCode,
        Latitude = @latitude,
        Longitude = @longitude,
        GoogleMapsUrl = @googleMapsUrl,
        Priority = @priority,
        ScheduledDate = @scheduledDate,
        UpdatedAt = GETDATE()
      WHERE Id = @id`,
      {
        id: parseInt(id),
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

    return NextResponse.json({ message: 'แก้ไขใบงานสำเร็จ' });
  } catch (error) {
    console.error('PUT /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// Background email notification
async function sendEmailNotification(taskId: number, newStatus: string, notes?: string) {
  try {
    const tasks = await query<{
      TaskNumber: string; DocumentDesc: string; RecipientName: string;
      Address: string; RequesterEmail: string; RequesterName: string;
      MessengerEmail: string | null; MessengerName: string | null;
      DispatcherEmails: string;
    }[]>(`
      SELECT t.TaskNumber, t.DocumentDesc, t.RecipientName, t.Address,
             u1.Email AS RequesterEmail, u1.FullName AS RequesterName,
             u2.Email AS MessengerEmail, u2.FullName AS MessengerName,
             STUFF((SELECT ',' + Email FROM Users WHERE Role = 'dispatcher' AND IsActive = 1 AND Email IS NOT NULL FOR XML PATH('')), 1, 1, '') AS DispatcherEmails
      FROM Tasks t
      LEFT JOIN Users u1 ON t.RequesterId = u1.Id
      LEFT JOIN Users u2 ON t.AssignedTo = u2.Id
      WHERE t.Id = @id
    `, { id: taskId });

    if (tasks.length === 0) return;
    const t = tasks[0];

    switch (newStatus) {
      case 'assigned': {
        if (t.MessengerEmail) {
          const mail = emailTaskAssigned(t.TaskNumber, t.DocumentDesc, t.RecipientName, t.Address, t.MessengerName || '');
          await sendMail({ to: t.MessengerEmail, ...mail });
        }
        break;
      }
      case 'issue': {
        const mail = emailIssueAlert(t.TaskNumber, notes || 'ไม่ระบุ', t.MessengerName || '-', notes || '', taskId, {
          documentDesc: t.DocumentDesc, recipientName: t.RecipientName, address: t.Address,
        });
        // ส่งให้หัวหน้าแมสเซ็นเจอร์
        if (t.DispatcherEmails) {
          await sendMail({ to: t.DispatcherEmails, ...mail });
        }
        // ★ ส่งให้เจ้าของงาน (requester) ด้วย
        if (t.RequesterEmail) {
          await sendMail({ to: t.RequesterEmail, ...mail });
        }
        break;
      }
      case 'completed':
      case 'returned': {
        if (t.RequesterEmail) {
          const mail = emailTaskCompleted(t.TaskNumber, t.RecipientName, t.RequesterName);
          await sendMail({ to: t.RequesterEmail, ...mail });
        }
        break;
      }
    }
  } catch (error) {
    console.error('[Email] sendEmailNotification error:', error);
  }
}
