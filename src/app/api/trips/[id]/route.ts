import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { calculateActualRouteDistance } from '@/lib/distance';
import { logAudit } from '@/lib/audit';

// PATCH - จบรอบวิ่ง + คำนวณระยะทางจริง (Google Maps API)
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

    let totalDistanceKm = body.totalDistanceKm || 0;
    let distanceSource = 'client';

    // ★ คำนวณระยะทางจริงจาก Google Maps API (ตามลำดับที่แมสวิ่งจริง)
    try {
      const officeSettings = await query<{ SettingKey: string; SettingValue: string }[]>(
        `SELECT SettingKey, SettingValue FROM SystemSettings WHERE SettingKey IN ('office_lat', 'office_lng')`
      );
      const officeLat = parseFloat(officeSettings.find(s => s.SettingKey === 'office_lat')?.SettingValue || '0');
      const officeLng = parseFloat(officeSettings.find(s => s.SettingKey === 'office_lng')?.SettingValue || '0');

      if (officeLat && officeLng) {
        const trips = await query<{ StartTime: string }[]>(
          `SELECT StartTime FROM Trips WHERE Id = @tripId AND MessengerId = @userId`,
          { tripId, userId }
        );

        if (trips.length > 0) {
          // ★ ดึงลำดับจริงจาก TaskStatusHistory — เรียงตามเวลาที่กด "ส่งสำเร็จ" / "คืนเอกสาร"
          const actualRoute = await query<{ Latitude: number; Longitude: number; Status: string }[]>(
            `SELECT t.Latitude, t.Longitude, tsh.Status
             FROM TaskStatusHistory tsh
             INNER JOIN Tasks t ON tsh.TaskId = t.Id
             WHERE t.AssignedTo = @userId
               AND tsh.Status IN ('completed', 'returned')
               AND tsh.CreatedAt >= @startTime
               AND t.Latitude IS NOT NULL AND t.Longitude IS NOT NULL
             ORDER BY tsh.CreatedAt ASC`,
            { userId, startTime: trips[0].StartTime }
          );

          if (actualRoute.length > 0) {
            const waypoints = actualRoute.map(t => ({ lat: t.Latitude, lng: t.Longitude }));
            const office = { lat: officeLat, lng: officeLng };

            // ★ Google Routes API: ออฟฟิศ → Task1 → Task2 → ... → ออฟฟิศ
            const result = await calculateActualRouteDistance(office, waypoints, true);
            totalDistanceKm = result.totalDistanceKm;
            distanceSource = result.source;

            console.log(`[Trip] Distance: ${totalDistanceKm} km (${distanceSource}), ${waypoints.length} stops`);
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
    logAudit({ action: 'trip_ended', userId, targetType: 'trip', targetId: tripId, details: `จบรอบวิ่ง — ${totalDistanceKm ? totalDistanceKm.toFixed(1) + ' km (' + distanceSource + ')' : 'ไม่มีระยะทาง'}` });

    return NextResponse.json({
      message: 'ปิดรอบวิ่งแล้ว',
      totalDistanceKm,
      distanceSource,
    });
  } catch (error) {
    console.error('PATCH /api/trips/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
