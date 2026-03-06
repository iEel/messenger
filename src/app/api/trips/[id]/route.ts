import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

// PATCH - จบรอบวิ่ง
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
    const body = await request.json().catch(() => ({}));

    await query(
      `UPDATE Trips SET 
        Status = 'completed', 
        EndTime = GETDATE(), 
        TotalDistanceKm = @distance,
        Notes = @notes
       WHERE Id = @id AND MessengerId = @userId`,
      {
        id: parseInt(id),
        userId: parseInt(session.user.id),
        distance: body.totalDistanceKm || null,
        notes: body.notes || null,
      }
    );

    return NextResponse.json({ message: 'ปิดรอบวิ่งแล้ว' });
  } catch (error) {
    console.error('PATCH /api/trips/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
