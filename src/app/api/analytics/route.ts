import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ★ Date range params (defaults to today)
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to');     // YYYY-MM-DD

    // Build date condition
    const dateParams: Record<string, unknown> = {};
    let dateCondition: string;
    if (from && to) {
      dateCondition = `CAST(t.CreatedAt AS DATE) BETWEEN @from AND @to`;
      dateParams.from = from;
      dateParams.to = to;
    } else if (from) {
      dateCondition = `CAST(t.CreatedAt AS DATE) >= @from`;
      dateParams.from = from;
    } else {
      dateCondition = `CAST(t.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)`;
    }

    // สถิติตามช่วงเวลา (นับ returned เป็น completed ด้วย)
    const todayStats = await query<{
      total: number; pending: number; assigned: number;
      in_transit: number; completed: number; issue: number;
    }[]>(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN Status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN Status = 'assigned' THEN 1 ELSE 0 END) AS assigned,
        SUM(CASE WHEN Status IN ('picked_up','in_transit') THEN 1 ELSE 0 END) AS in_transit,
        SUM(CASE WHEN Status IN ('completed','returned') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN Status = 'issue' THEN 1 ELSE 0 END) AS issue
      FROM Tasks t
      WHERE ${dateCondition}
    `, dateParams);

    // สถิติรายวันในช่วงที่เลือก (หรือ 7 วันย้อนหลัง)
    let weeklyCondition: string;
    const weeklyParams: Record<string, unknown> = {};
    if (from && to) {
      weeklyCondition = `CreatedAt >= @from AND CAST(CreatedAt AS DATE) <= @to`;
      weeklyParams.from = from;
      weeklyParams.to = to;
    } else {
      weeklyCondition = `CreatedAt >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))`;
    }

    const weeklyStats = await query<{
      day: string; total: number; completed: number;
    }[]>(`
      SELECT 
        FORMAT(CAST(CreatedAt AS DATE), 'yyyy-MM-dd') AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN Status IN ('completed','returned') THEN 1 ELSE 0 END) AS completed
      FROM Tasks
      WHERE ${weeklyCondition}
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY day
    `, weeklyParams);

    // Top 5 Messengers (ตามช่วงเวลาที่เลือก หรือเดือนนี้)
    let topDateCondition: string;
    const topParams: Record<string, unknown> = {};
    if (from && to) {
      topDateCondition = `t.CreatedAt >= @from AND CAST(t.CreatedAt AS DATE) <= @to`;
      topParams.from = from;
      topParams.to = to;
    } else {
      topDateCondition = `t.CreatedAt >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)`;
    }

    const topMessengers = await query<{
      FullName: string; completed: number; avgMinutes: number;
    }[]>(`
      SELECT TOP 5
        u.FullName,
        COUNT(*) AS completed,
        AVG(completionMinutes.mins) AS avgMinutes
      FROM Tasks t
      JOIN Users u ON t.AssignedTo = u.Id
      CROSS APPLY (
        SELECT TOP 1 DATEDIFF(MINUTE, t.CreatedAt, sh.CreatedAt) AS mins
        FROM TaskStatusHistory sh
        WHERE sh.TaskId = t.Id AND sh.Status IN ('completed','returned')
        ORDER BY sh.CreatedAt DESC
      ) completionMinutes
      WHERE t.Status IN ('completed','returned')
        AND ${topDateCondition}
      GROUP BY u.FullName
      ORDER BY completed DESC
    `, topParams);

    // ★ Workload รายวัน — แมสเซ็นเจอร์แต่ละคน
    const workload = await query<{
      UserId: number; FullName: string;
      total: number; completed: number; in_progress: number; issue: number;
    }[]>(`
      SELECT 
        u.Id AS UserId,
        u.FullName,
        COUNT(*) AS total,
        SUM(CASE WHEN t.Status IN ('completed','returned') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN t.Status IN ('assigned','picked_up','in_transit','return_picked_up','returning') THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN t.Status = 'issue' THEN 1 ELSE 0 END) AS issue
      FROM Tasks t
      JOIN Users u ON t.AssignedTo = u.Id
      WHERE ${dateCondition}
        AND u.Role = 'messenger'
      GROUP BY u.Id, u.FullName
      ORDER BY total DESC
    `, dateParams);

    // ★ ระยะทางรวม + เวลาเฉลี่ย
    let tripDateCondition: string;
    const tripParams: Record<string, unknown> = {};
    if (from && to) {
      tripDateCondition = `CAST(StartTime AS DATE) BETWEEN @from AND @to`;
      tripParams.from = from;
      tripParams.to = to;
    } else {
      tripDateCondition = `CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)`;
    }

    const tripStats = await query<{
      totalTrips: number;
      totalDistanceKm: number;
      avgDurationMinutes: number;
    }[]>(`
      SELECT 
        COUNT(*) AS totalTrips,
        ISNULL(SUM(TotalDistanceKm), 0) AS totalDistanceKm,
        ISNULL(AVG(DATEDIFF(MINUTE, StartTime, EndTime)), 0) AS avgDurationMinutes
      FROM Trips
      WHERE ${tripDateCondition}
        AND Status = 'completed'
    `, tripParams);

    // จำนวน Tasks ทั้งหมด
    const totalAll = await query<{ total: number }[]>(`SELECT COUNT(*) AS total FROM Tasks`);

    return NextResponse.json({
      today: todayStats[0] || { total: 0, pending: 0, assigned: 0, in_transit: 0, completed: 0, issue: 0 },
      weekly: weeklyStats,
      topMessengers,
      workload,
      tripStats: tripStats[0] || { totalTrips: 0, totalDistanceKm: 0, avgDurationMinutes: 0 },
      totalTasks: totalAll[0]?.total || 0,
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
