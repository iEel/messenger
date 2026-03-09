import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET - สถิติส่วนตัวของแมสเซ็นเจอร์ (เดือนนี้)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM, default = current month

    // Build month condition
    let monthCondition: string;
    const params: Record<string, unknown> = { userId };

    if (month) {
      monthCondition = `FORMAT(t.CreatedAt, 'yyyy-MM') = @month`;
      params.month = month;
    } else {
      monthCondition = `FORMAT(t.CreatedAt, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM')`;
    }

    // ★ งานเดือนนี้ (ทั้งหมดที่ assign ให้)
    const taskStats = await query<{
      totalAssigned: number;
      completed: number;
      returned: number;
      issue: number;
      inProgress: number;
    }[]>(`
      SELECT
        COUNT(*) AS totalAssigned,
        SUM(CASE WHEN Status IN ('completed', 'returned') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN Status = 'returned' THEN 1 ELSE 0 END) AS returned,
        SUM(CASE WHEN Status = 'issue' THEN 1 ELSE 0 END) AS issue,
        SUM(CASE WHEN Status IN ('assigned', 'picked_up', 'in_transit', 'return_picked_up', 'returning') THEN 1 ELSE 0 END) AS inProgress
      FROM Tasks t
      WHERE t.AssignedTo = @userId
        AND ${monthCondition}
    `, params);

    // ★ ระยะทางรวม + จำนวนรอบวิ่ง
    const tripParams: Record<string, unknown> = { userId };
    let tripMonthCond: string;
    if (month) {
      tripMonthCond = `FORMAT(tr.StartTime, 'yyyy-MM') = @month`;
      tripParams.month = month;
    } else {
      tripMonthCond = `FORMAT(tr.StartTime, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM')`;
    }

    const tripStats = await query<{
      totalTrips: number;
      totalDistanceKm: number;
      totalDurationMinutes: number;
    }[]>(`
      SELECT
        COUNT(*) AS totalTrips,
        ISNULL(SUM(TotalDistanceKm), 0) AS totalDistanceKm,
        ISNULL(SUM(DATEDIFF(MINUTE, tr.StartTime, tr.EndTime)), 0) AS totalDurationMinutes
      FROM Trips tr
      WHERE tr.MessengerId = @userId
        AND tr.Status = 'completed'
        AND ${tripMonthCond}
    `, tripParams);

    // ★ วันนี้
    const todayStats = await query<{
      todayCompleted: number;
      todayTotal: number;
    }[]>(`
      SELECT
        SUM(CASE WHEN Status IN ('completed', 'returned') THEN 1 ELSE 0 END) AS todayCompleted,
        COUNT(*) AS todayTotal
      FROM Tasks
      WHERE AssignedTo = @userId
        AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
    `, { userId });

    const ts = taskStats[0] || { totalAssigned: 0, completed: 0, returned: 0, issue: 0, inProgress: 0 };
    const tr = tripStats[0] || { totalTrips: 0, totalDistanceKm: 0, totalDurationMinutes: 0 };
    const td = todayStats[0] || { todayCompleted: 0, todayTotal: 0 };

    const successRate = ts.totalAssigned > 0
      ? Math.round((ts.completed / ts.totalAssigned) * 100)
      : 0;

    return NextResponse.json({
      month: month || new Date().toISOString().slice(0, 7),
      // เดือนนี้
      totalAssigned: ts.totalAssigned,
      completed: ts.completed,
      issue: ts.issue,
      inProgress: ts.inProgress,
      successRate,
      // ระยะทาง
      totalTrips: tr.totalTrips,
      totalDistanceKm: Math.round(tr.totalDistanceKm * 10) / 10,
      totalDurationMinutes: tr.totalDurationMinutes,
      // วันนี้
      todayCompleted: td.todayCompleted,
      todayTotal: td.todayTotal,
    });
  } catch (error) {
    console.error('GET /api/messenger-stats error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
