import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { calculateRoute, formatDistance, formatDuration } from '@/lib/distance';

// GET /api/distance?taskId=123
// GET /api/distance?fromLat=...&fromLng=...&toLat=...&toLng=...
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    let fromLat: number, fromLng: number, toLat: number, toLng: number;

    if (taskId) {
      // คำนวณระยะทางจาก office ไปที่ task
      const officeSettings = await query<{ SettingKey: string; SettingValue: string }[]>(
        `SELECT SettingKey, SettingValue FROM SystemSettings WHERE SettingKey IN ('office_lat', 'office_lng')`
      );

      const officeLat = officeSettings.find(s => s.SettingKey === 'office_lat');
      const officeLng = officeSettings.find(s => s.SettingKey === 'office_lng');

      if (!officeLat || !officeLng) {
        return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่าพิกัดออฟฟิศ' }, { status: 400 });
      }

      const tasks = await query<{ Latitude: number | null; Longitude: number | null }[]>(
        `SELECT Latitude, Longitude FROM Tasks WHERE Id = @id`,
        { id: parseInt(taskId) }
      );

      if (tasks.length === 0 || !tasks[0].Latitude || !tasks[0].Longitude) {
        return NextResponse.json({ error: 'ใบงานไม่มีพิกัด' }, { status: 400 });
      }

      fromLat = parseFloat(officeLat.SettingValue);
      fromLng = parseFloat(officeLng.SettingValue);
      toLat = tasks[0].Latitude;
      toLng = tasks[0].Longitude;
    } else {
      // คำนวณจากพิกัดที่ส่งมา
      fromLat = parseFloat(searchParams.get('fromLat') || '0');
      fromLng = parseFloat(searchParams.get('fromLng') || '0');
      toLat = parseFloat(searchParams.get('toLat') || '0');
      toLng = parseFloat(searchParams.get('toLng') || '0');

      if (!fromLat || !fromLng || !toLat || !toLng) {
        return NextResponse.json({ error: 'กรุณาระบุพิกัดต้นทาง-ปลายทาง' }, { status: 400 });
      }
    }

    const result = await calculateRoute(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng }
    );

    return NextResponse.json({
      ...result,
      distanceText: formatDistance(result.distanceKm),
      durationText: formatDuration(result.durationMinutes),
    });
  } catch (error) {
    console.error('GET /api/distance error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
