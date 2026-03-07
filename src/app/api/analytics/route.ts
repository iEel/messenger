import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // สถิติวันนี้ (นับ returned เป็น completed ด้วย)
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
      FROM Tasks
      WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // สถิติ 7 วันย้อนหลัง (นับ returned เป็น completed)
    const weeklyStats = await query<{
      day: string; total: number; completed: number;
    }[]>(`
      SELECT 
        FORMAT(CAST(CreatedAt AS DATE), 'yyyy-MM-dd') AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN Status IN ('completed','returned') THEN 1 ELSE 0 END) AS completed
      FROM Tasks
      WHERE CreatedAt >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY day
    `);

    // Top 5 Messengers (เดือนนี้ — นับ returned ด้วย)
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
        AND t.CreatedAt >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
      GROUP BY u.FullName
      ORDER BY completed DESC
    `);

    // ★ Workload รายวัน — แมสเซ็นเจอร์แต่ละคนวันนี้
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
      WHERE CAST(t.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
        AND u.Role = 'messenger'
      GROUP BY u.Id, u.FullName
      ORDER BY total DESC
    `);

    // ★ ระยะทางรวม + เวลาเฉลี่ยต่อรอบ — วันนี้
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
      WHERE CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
        AND Status = 'completed'
    `);

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
