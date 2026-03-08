import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET - ดึงรายชื่อแมสเซ็นเจอร์ที่ active
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const messengers = await query<{ Id: number; FullName: string; EmployeeId: string; Phone: string | null }[]>(
      `SELECT Id, FullName, EmployeeId, Phone 
       FROM Users 
       WHERE Role IN ('messenger', 'dispatcher') AND IsActive = 1 
       ORDER BY FullName`
    );

    return NextResponse.json(messengers);
  } catch (error) {
    console.error('GET /api/messengers error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
