import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { Task, TaskStatusHistoryEntry } from '@/lib/types';

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

    return NextResponse.json({
      task: tasks[0],
      history,
    });
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH - แก้ไข Task (assign, update status)
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

    return NextResponse.json({ message: 'อัปเดตสำเร็จ' });
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
