import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET - ดึง Trip ปัจจุบันหรือประวัติ
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const trips = await query<{
      Id: number; MessengerId: number; StartTime: string; EndTime: string | null;
      TotalDistanceKm: number | null; Status: string; Notes: string | null;
      TaskCount: number;
    }[]>(
      `SELECT t.*, 
       (SELECT COUNT(*) FROM Tasks tk WHERE tk.AssignedTo = t.MessengerId 
        AND tk.Status IN ('assigned','picked_up','in_transit')) AS TaskCount
       FROM Trips t
       WHERE t.MessengerId = @userId AND t.Status = @status
       ORDER BY t.StartTime DESC`,
      { userId: parseInt(session.user.id), status }
    );

    return NextResponse.json(trips);
  } catch (error) {
    console.error('GET /api/trips error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - เริ่มรอบวิ่งใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบว่ามี trip ที่ active อยู่ไหม
    const existing = await query<{ Id: number }[]>(
      `SELECT Id FROM Trips WHERE MessengerId = @userId AND Status = 'active'`,
      { userId: parseInt(session.user.id) }
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'คุณมีรอบวิ่งที่ยังไม่ปิดอยู่', tripId: existing[0].Id },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const result = await query<{ Id: number }[]>(
      `INSERT INTO Trips (MessengerId, StartTime, Status, Notes)
       OUTPUT INSERTED.Id
       VALUES (@userId, GETDATE(), 'active', @notes)`,
      { userId: parseInt(session.user.id), notes: body.notes || null }
    );

    return NextResponse.json(
      { message: 'เริ่มรอบวิ่งแล้ว', tripId: result[0].Id },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/trips error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
