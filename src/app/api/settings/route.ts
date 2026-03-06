import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET - ดึงค่า settings ทั้งหมด
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await query<{ Id: number; SettingKey: string; SettingValue: string; Description: string | null; UpdatedAt: string }[]>(
      `SELECT Id, SettingKey, SettingValue, Description, UpdatedAt FROM SystemSettings ORDER BY SettingKey`
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH - อัปเดตค่า settings (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body as { settings: { key: string; value: string }[] };

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    for (const s of settings) {
      await query(
        `MERGE SystemSettings AS target
         USING (SELECT @key AS SettingKey) AS source
         ON target.SettingKey = source.SettingKey
         WHEN MATCHED THEN UPDATE SET SettingValue = @value, UpdatedAt = GETDATE()
         WHEN NOT MATCHED THEN INSERT (SettingKey, SettingValue) VALUES (@key, @value);`,
        { key: s.key, value: s.value }
      );
    }

    return NextResponse.json({ message: 'บันทึกสำเร็จ' });
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
