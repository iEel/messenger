import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyEmailActionToken } from '@/lib/email-action';

// POST — ดำเนินการจาก email action (ไม่ต้อง login)
export async function POST(request: NextRequest) {
  try {
    const { token, confirm } = await request.json();

    // ตรวจสอบ token (HMAC + expiry)
    const payload = verifyEmailActionToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' }, { status: 403 });
    }

    const { taskId, action, userId } = payload;

    // ดึงข้อมูล task
    const tasks = await query<{ Id: number; TaskNumber: string; Status: string; DocumentDesc: string; RecipientName: string }[]>(
      `SELECT Id, TaskNumber, Status, DocumentDesc, RecipientName FROM Tasks WHERE Id = @id`,
      { id: taskId }
    );

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'ไม่พบใบงาน' }, { status: 404 });
    }

    const task = tasks[0];

    // ถ้า confirm = false → ส่งข้อมูล task กลับให้แสดงหน้ายืนยัน
    if (!confirm) {
      return NextResponse.json({
        task: {
          TaskNumber: task.TaskNumber,
          DocumentDesc: task.DocumentDesc,
          RecipientName: task.RecipientName,
          Status: task.Status,
        },
        action,
      });
    }

    // ดำเนินการตาม action
    switch (action) {
      case 'cancel': {
        if (!['new', 'assigned', 'issue'].includes(task.Status)) {
          return NextResponse.json({ error: `ไม่สามารถดำเนินการในสถานะ "${task.Status}" ได้` }, { status: 400 });
        }
        await query(`UPDATE Tasks SET Status = 'returning', UpdatedAt = GETDATE() WHERE Id = @id`, { id: taskId });
        await query(
          `INSERT INTO TaskStatusHistory (TaskId, Status, ChangedBy, Notes) VALUES (@taskId, 'returning', @userId, @notes)`,
          { taskId, userId, notes: 'สั่งนำเอกสารมาคืน (จาก email action)' }
        );
        return NextResponse.json({ message: `สั่งนำเอกสาร ${task.TaskNumber} กลับมาคืนเรียบร้อย`, action: 'returning' });
      }

      case 'reschedule': {
        // เปลี่ยนกลับเป็น new เพื่อให้จ่ายงานใหม่ได้
        if (!['assigned', 'issue'].includes(task.Status)) {
          return NextResponse.json({ error: `ไม่สามารถเลื่อนส่งงานในสถานะ "${task.Status}" ได้` }, { status: 400 });
        }
        await query(`UPDATE Tasks SET Status = 'new', AssignedTo = NULL, UpdatedAt = GETDATE() WHERE Id = @id`, { id: taskId });
        await query(
          `INSERT INTO TaskStatusHistory (TaskId, Status, ChangedBy, Notes) VALUES (@taskId, 'new', @userId, @notes)`,
          { taskId, userId, notes: 'เลื่อนวันส่งใหม่ (จาก email action)' }
        );
        return NextResponse.json({ message: `เลื่อนวันส่ง ${task.TaskNumber} เรียบร้อย`, action: 'rescheduled' });
      }

      default:
        return NextResponse.json({ error: 'ไม่รู้จัก action นี้' }, { status: 400 });
    }
  } catch (error) {
    console.error('POST /api/email-action error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
