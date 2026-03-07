import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { calculateOptimizedRoute, haversineDistance } from '@/lib/distance';

// POST /api/routes/optimize
// Body: { taskIds: number[] }
// Response: { optimizedOrder: number[], totalDistanceKm, totalDurationMinutes, source }
//
// 💰 เรียก Routes API v2 ครั้งเดียว → ได้ลำดับที่ดีที่สุดทั้งรอบ
// งาน priority=urgent จะถูกล็อคไว้ลำดับ 1 เสมอ
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { taskIds } = body as { taskIds: number[] };

    if (!taskIds || taskIds.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุ taskIds' }, { status: 400 });
    }

    // ดึงพิกัดออฟฟิศ
    const officeSettings = await query<{ SettingKey: string; SettingValue: string }[]>(
      `SELECT SettingKey, SettingValue FROM SystemSettings WHERE SettingKey IN ('office_lat', 'office_lng')`
    );
    const officeLat = parseFloat(officeSettings.find(s => s.SettingKey === 'office_lat')?.SettingValue || '0');
    const officeLng = parseFloat(officeSettings.find(s => s.SettingKey === 'office_lng')?.SettingValue || '0');

    if (!officeLat || !officeLng) {
      return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่าพิกัดออฟฟิศ' }, { status: 400 });
    }

    // ดึงข้อมูล tasks
    const placeholders = taskIds.map((_, i) => `@id${i}`).join(',');
    const params: Record<string, number> = {};
    taskIds.forEach((id, i) => { params[`id${i}`] = id; });

    const tasks = await query<{
      Id: number; Latitude: number | null; Longitude: number | null; Priority: string;
    }[]>(
      `SELECT Id, Latitude, Longitude, Priority FROM Tasks WHERE Id IN (${placeholders})`,
      params,
    );

    // แยกงานที่มีพิกัด vs ไม่มี
    const withCoords = tasks.filter(t => t.Latitude && t.Longitude);
    const withoutCoords = tasks.filter(t => !t.Latitude || !t.Longitude);

    if (withCoords.length === 0) {
      return NextResponse.json({
        error: 'ไม่มีใบงานที่มีพิกัด',
        optimizedTaskIds: taskIds,
      }, { status: 400 });
    }

    // แยกงานด่วนออกมา — ล็อคเป็นลำดับ 1
    const urgentTasks = withCoords.filter(t => t.Priority === 'urgent');
    const normalTasks = withCoords.filter(t => t.Priority !== 'urgent');

    const origin = { lat: officeLat, lng: officeLng };
    // ปลายทาง = ออฟฟิศ (กลับที่เดิม) เพื่อให้คำนวณรอบเต็ม
    const destination = { lat: officeLat, lng: officeLng };

    let optimizedTaskIds: number[];
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;
    let source: 'google' | 'haversine' = 'haversine';

    if (urgentTasks.length > 0 && normalTasks.length > 0) {
      // มีงานด่วน → ล็อค urgent เป็นลำดับ 1, optimize เฉพาะ normal tasks
      // Origin → Urgent tasks (ตามลำดับ) → optimize normal tasks → Office

      // คำนวณ urgent leg (fixed order)
      let urgentDistKm = 0;
      let lastPoint = origin;
      for (const ut of urgentTasks) {
        const d = haversineDistance(lastPoint, { lat: ut.Latitude!, lng: ut.Longitude! });
        urgentDistKm += d;
        lastPoint = { lat: ut.Latitude!, lng: ut.Longitude! };
      }

      // Optimize normal tasks (start from last urgent task)
      const normalWaypoints = normalTasks.map(t => ({
        lat: t.Latitude!, lng: t.Longitude!,
      }));

      const result = await calculateOptimizedRoute(
        lastPoint, // start from last urgent task
        destination,
        normalWaypoints,
      );

      // สร้างลำดับ: urgent tasks (fixed) + normal tasks (optimized)
      const normalOptimizedIds = result.optimizedOrder.map(i => normalTasks[i].Id);
      optimizedTaskIds = [
        ...urgentTasks.map(t => t.Id),
        ...normalOptimizedIds,
      ];

      totalDistanceKm = Math.round((urgentDistKm + result.totalDistanceKm) * 100) / 100;
      totalDurationMinutes = Math.round((urgentDistKm / 25) * 60) + result.totalDurationMinutes;
      source = result.source;
    } else {
      // ไม่มีงานด่วน หรือมีแต่งานด่วน → optimize ทั้งหมด
      const allTasks = urgentTasks.length > 0 ? urgentTasks : normalTasks;
      const waypoints = allTasks.map(t => ({
        lat: t.Latitude!, lng: t.Longitude!,
      }));

      const result = await calculateOptimizedRoute(origin, destination, waypoints);

      optimizedTaskIds = result.optimizedOrder.map(i => allTasks[i].Id);
      totalDistanceKm = result.totalDistanceKm;
      totalDurationMinutes = result.totalDurationMinutes;
      source = result.source;
    }

    // เพิ่มงานที่ไม่มีพิกัดต่อท้าย
    optimizedTaskIds = [...optimizedTaskIds, ...withoutCoords.map(t => t.Id)];

    return NextResponse.json({
      optimizedTaskIds,
      totalDistanceKm,
      totalDurationMinutes,
      source,
      urgentCount: urgentTasks.length,
      noCoordCount: withoutCoords.length,
    });
  } catch (error) {
    console.error('POST /api/routes/optimize error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
