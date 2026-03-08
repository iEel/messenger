import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { haversineDistance } from '@/lib/distance';
import { logAudit } from '@/lib/audit';

// PATCH - จบรอบวิ่ง + Loop Closing (คำนวณระยะทางกลับ)
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
    const userId = parseInt(session.user.id);
    const tripId = parseInt(id);

    // คำนวณระยะทางรวมจากงานที่วิ่งในรอบนี้
    let totalDistanceKm = body.totalDistanceKm || 0;

    // ดึงพิกัดออฟฟิศ + งานที่ completed/returned ในรอบนี้ เพื่อคำนวณ Loop Closing
    try {
      const officeSettings = await query<{ SettingKey: string; SettingValue: string }[]>(
        `SELECT SettingKey, SettingValue FROM SystemSettings WHERE SettingKey IN ('office_lat', 'office_lng')`
      );
      const officeLat = parseFloat(officeSettings.find(s => s.SettingKey === 'office_lat')?.SettingValue || '0');
      const officeLng = parseFloat(officeSettings.find(s => s.SettingKey === 'office_lng')?.SettingValue || '0');

      if (officeLat && officeLng) {
        // ดึง Trip start time
        const trips = await query<{ StartTime: string }[]>(
          `SELECT StartTime FROM Trips WHERE Id = @tripId AND MessengerId = @userId`,
          { tripId, userId }
        );

        if (trips.length > 0) {
          // ดึงงานที่สำเร็จระหว่าง trip นี้ (completed/returned ตั้งแต่ StartTime)
          const completedTasks = await query<{ Latitude: number | null; Longitude: number | null }[]>(
            `SELECT t.Latitude, t.Longitude
             FROM Tasks t
             WHERE t.AssignedTo = @userId
               AND t.Status IN ('completed', 'returned')
               AND t.Latitude IS NOT NULL AND t.Longitude IS NOT NULL
               AND t.CompletedAt >= @startTime
             ORDER BY t.CompletedAt ASC`,
            { userId, startTime: trips[0].StartTime }
          );

          if (completedTasks.length > 0) {
            // คำนวณระยะทาง: Office → Task1 → Task2 → ... → TaskN
            let calcKm = 0;
            let prev = { lat: officeLat, lng: officeLng };

            for (const task of completedTasks) {
              if (task.Latitude && task.Longitude) {
                const d = haversineDistance(prev, { lat: task.Latitude, lng: task.Longitude });
                calcKm += d;
                prev = { lat: task.Latitude, lng: task.Longitude };
              }
            }

            // Loop Closing: TaskN → Office (ระยะทางวิ่งกลับ)
            const returnKm = haversineDistance(prev, { lat: officeLat, lng: officeLng });
            calcKm += returnKm;

            // ใช้ค่าที่คำนวณได้ (ถ้า client ไม่ส่งมา หรือส่งมาน้อยกว่า)
            // 💰 ใช้ Haversine ฟรี — ไม่เรียก Google API
            if (calcKm > totalDistanceKm) {
              totalDistanceKm = Math.round(calcKm * 100) / 100;
            }
          }
        }
      }
    } catch (calcError) {
      console.warn('[Trip] Distance calc error (non-critical):', calcError);
      // ไม่ block การปิดรอบวิ่ง
    }

    await query(
      `UPDATE Trips SET 
        Status = 'completed', 
        EndTime = GETDATE(), 
        TotalDistanceKm = @distance,
        Notes = @notes
       WHERE Id = @id AND MessengerId = @userId`,
      {
        id: tripId,
        userId,
        distance: totalDistanceKm || null,
        notes: body.notes || null,
      }
    );

    // ★ Audit log
    logAudit({ action: 'trip_ended', userId, targetType: 'trip', targetId: tripId, details: `จบรอบวิ่ง — ${totalDistanceKm ? totalDistanceKm.toFixed(1) + ' km' : 'ไม่มีระยะทาง'}` });

    return NextResponse.json({
      message: 'ปิดรอบวิ่งแล้ว',
      totalDistanceKm,
    });
  } catch (error) {
    console.error('PATCH /api/trips/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
