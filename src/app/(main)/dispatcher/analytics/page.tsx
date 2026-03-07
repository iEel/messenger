'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle,
  Truck,
  TrendingUp,
  Loader2,
  Trophy,
  Users,
  Bike,
  Download,
} from 'lucide-react';

interface TodayStats {
  total: number; pending: number; assigned: number;
  in_transit: number; completed: number; issue: number;
}

interface DailyData { day: string; total: number; completed: number; }

interface TopMessenger { FullName: string; completed: number; avgMinutes: number; }

interface WorkloadItem {
  UserId: number; FullName: string;
  total: number; completed: number; in_progress: number; issue: number;
}

interface TripStats {
  totalTrips: number; totalDistanceKm: number; avgDurationMinutes: number;
}

const DAY_NAMES: Record<number, string> = {
  0: 'อา', 1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ', 6: 'ส',
};

export default function AnalyticsPage() {
  const [today, setToday] = useState<TodayStats | null>(null);
  const [weekly, setWeekly] = useState<DailyData[]>([]);
  const [topMessengers, setTopMessengers] = useState<TopMessenger[]>([]);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/analytics');
        const data = await res.json();
        setToday(data.today);
        setWeekly(data.weekly || []);
        setTopMessengers(data.topMessengers || []);
        setWorkload(data.workload || []);
        setTripStats(data.tripStats || null);
        setTotalTasks(data.totalTasks || 0);
      } catch (error) {
        console.error('Analytics fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const completionRate = today && today.total > 0
    ? Math.round((today.completed / today.total) * 100) : 0;

  const maxDaily = Math.max(...weekly.map(d => d.total), 1);

  // ★ Export CSV
  const handleExportCSV = useCallback(() => {
    if (!today || workload.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const bom = '\uFEFF'; // UTF-8 BOM สำหรับ Excel ไทย
    let csv = bom;

    // Header
    csv += `รายงานประจำวัน ${todayStr}\n\n`;

    // สถิติวันนี้
    csv += `สถิติวันนี้\n`;
    csv += `ทั้งหมด,รอจ่าย,จ่ายแล้ว,กำลังส่ง,สำเร็จ,มีปัญหา\n`;
    csv += `${today.total},${today.pending},${today.assigned},${today.in_transit},${today.completed},${today.issue}\n\n`;

    // Workload
    csv += `Workload แมสเซ็นเจอร์\n`;
    csv += `ชื่อ,งานทั้งหมด,สำเร็จ,กำลังทำ,มีปัญหา\n`;
    workload.forEach(w => {
      csv += `${w.FullName},${w.total},${w.completed},${w.in_progress},${w.issue}\n`;
    });
    csv += '\n';

    // ระยะทาง
    if (tripStats) {
      csv += `สรุปรอบวิ่ง\n`;
      csv += `จำนวนรอบ,ระยะทางรวม (km),เวลาเฉลี่ย (นาที)\n`;
      csv += `${tripStats.totalTrips},${tripStats.totalDistanceKm},${tripStats.avgDurationMinutes}\n\n`;
    }

    // Top Messengers
    csv += `แมสเซ็นเจอร์ดีเด่น (เดือนนี้)\n`;
    csv += `อันดับ,ชื่อ,งานสำเร็จ,เวลาเฉลี่ย (นาที)\n`;
    topMessengers.forEach((m, i) => {
      csv += `${i + 1},${m.FullName},${m.completed},${m.avgMinutes || '-'}\n`;
    });

    // 7 วันย้อนหลัง
    csv += `\n7 วันย้อนหลัง\n`;
    csv += `วัน,ทั้งหมด,สำเร็จ\n`;
    weekly.forEach(d => {
      csv += `${d.day},${d.total},${d.completed}\n`;
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [today, workload, tripStats, topMessengers, weekly]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary-500" />
          <p className="text-sm text-surface-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dispatcher" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <ArrowLeft size={20} className="text-surface-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <BarChart3 size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-800 dark:text-white">รายงาน & สถิติ</h1>
              <p className="text-sm text-surface-500">ข้อมูลจากฐานข้อมูลจริง • ทั้งหมด {totalTasks} ใบงาน</p>
            </div>
          </div>
        </div>

        {/* ★ Export CSV Button */}
        <button onClick={handleExportCSV}
          disabled={!today || workload.length === 0}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white
                     bg-gradient-to-r from-emerald-500 to-emerald-600
                     hover:from-emerald-600 hover:to-emerald-700
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-md hover:shadow-lg
                     flex items-center gap-1.5 transition-all cursor-pointer">
          <Download size={14} />
          📥 Export CSV
        </button>
      </div>

      {/* Today Stats */}
      <div>
        <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">
          📊 สถิติวันนี้
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'ทั้งหมด', value: today?.total || 0, icon: <ClipboardList size={18} />, gradient: 'from-slate-500 to-slate-600' },
            { label: 'รอจ่ายงาน', value: today?.pending || 0, icon: <Clock size={18} />, gradient: 'from-amber-500 to-amber-600' },
            { label: 'จ่ายแล้ว', value: today?.assigned || 0, icon: <Truck size={18} />, gradient: 'from-blue-500 to-blue-600' },
            { label: 'กำลังส่ง', value: today?.in_transit || 0, icon: <TrendingUp size={18} />, gradient: 'from-purple-500 to-purple-600' },
            { label: 'สำเร็จ', value: today?.completed || 0, icon: <CheckCircle size={18} />, gradient: 'from-emerald-500 to-emerald-600' },
            { label: 'มีปัญหา', value: today?.issue || 0, icon: <AlertTriangle size={18} />, gradient: 'from-red-500 to-red-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                                     shadow-[var(--shadow-card)] p-4 text-center">
              <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${stat.gradient} 
                               flex items-center justify-center text-white mb-2`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-surface-800 dark:text-white">{stat.value}</p>
              <p className="text-xs text-surface-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ★ Trip Distance & Duration Stats */}
      {tripStats && tripStats.totalTrips > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4 flex items-center gap-2">
            <Bike size={16} className="text-blue-500" /> 🏍️ สรุปรอบวิ่งวันนี้
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{tripStats.totalTrips}</p>
              <p className="text-xs text-surface-500 mt-1">รอบวิ่ง</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {tripStats.totalDistanceKm > 0 ? tripStats.totalDistanceKm.toFixed(1) : '0'} <span className="text-sm font-normal">km</span>
              </p>
              <p className="text-xs text-surface-500 mt-1">ระยะทางรวม</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {tripStats.avgDurationMinutes > 0 ? tripStats.avgDurationMinutes : '-'} <span className="text-sm font-normal">นาที</span>
              </p>
              <p className="text-xs text-surface-500 mt-1">เฉลี่ย/รอบ</p>
            </div>
          </div>
        </div>
      )}

      {/* ★ Workload รายวัน — แมสเซ็นเจอร์แต่ละคน */}
      {workload.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4 flex items-center gap-2">
            <Users size={16} className="text-indigo-500" /> 📋 Workload แมสเซ็นเจอร์วันนี้
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-700">
                  <th className="pb-2 pr-4">ชื่อ</th>
                  <th className="pb-2 px-2 text-center">ทั้งหมด</th>
                  <th className="pb-2 px-2 text-center">✅ สำเร็จ</th>
                  <th className="pb-2 px-2 text-center">🔄 กำลังทำ</th>
                  <th className="pb-2 px-2 text-center">⚠️ ปัญหา</th>
                  <th className="pb-2 pl-2 text-right">ความคืบหน้า</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((w) => {
                  const pct = w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0;
                  return (
                    <tr key={w.UserId} className="border-b border-surface-100 dark:border-surface-700/50 last:border-0">
                      <td className="py-3 pr-4 font-medium text-surface-800 dark:text-white">{w.FullName}</td>
                      <td className="py-3 px-2 text-center font-bold">{w.total}</td>
                      <td className="py-3 px-2 text-center text-emerald-600 font-semibold">{w.completed}</td>
                      <td className="py-3 px-2 text-center text-blue-600">{w.in_progress}</td>
                      <td className="py-3 px-2 text-center text-red-500">{w.issue > 0 ? w.issue : '-'}</td>
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-mono text-surface-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completion Rate + Weekly Chart (side-by-side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Completion Rate */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">🎯 อัตราสำเร็จวันนี้</h3>
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor"
                  className="text-surface-100 dark:text-surface-700" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                  className="text-emerald-500"
                  strokeDasharray={`${completionRate * 2.64} 264`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-surface-800 dark:text-white">{completionRate}%</span>
              </div>
            </div>
            <div className="text-sm text-surface-600 dark:text-surface-400 space-y-1">
              <p>✅ สำเร็จ: <b className="text-emerald-600">{today?.completed || 0}</b></p>
              <p>📋 ทั้งหมด: <b>{today?.total || 0}</b></p>
              <p>⚠️ มีปัญหา: <b className="text-red-500">{today?.issue || 0}</b></p>
            </div>
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">📈 7 วันย้อนหลัง</h3>
          {weekly.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {weekly.map((day, i) => {
                const dayDate = new Date(day.day);
                const dayName = DAY_NAMES[dayDate.getDay()];
                const barHeight = Math.max((day.total / maxDaily) * 100, 4);
                const completedHeight = day.total > 0 ? (day.completed / day.total) * barHeight : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[10px] text-surface-500 font-medium">{day.total}</p>
                    <div className="w-full relative rounded-t-lg overflow-hidden bg-surface-100 dark:bg-surface-700"
                      style={{ height: `${barHeight}%` }}>
                      <div className="absolute bottom-0 w-full bg-emerald-500 rounded-t-sm transition-all"
                        style={{ height: `${completedHeight}%` }} />
                    </div>
                    <p className="text-[10px] text-surface-400">{dayName}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-8">ยังไม่มีข้อมูล</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-[10px] text-surface-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface-100 dark:bg-surface-700 inline-block" /> ทั้งหมด</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> สำเร็จ</span>
          </div>
        </div>
      </div>

      {/* Top Messengers */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-6">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4 flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" /> แมสเซ็นเจอร์ดีเด่น (เดือนนี้)
        </h3>
        {topMessengers.length > 0 ? (
          <div className="space-y-3">
            {topMessengers.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white
                  ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-surface-400'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 dark:text-white truncate">{m.FullName}</p>
                  <p className="text-xs text-surface-500">เฉลี่ย {m.avgMinutes ? `${m.avgMinutes} นาที/งาน` : '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-600">{m.completed}</p>
                  <p className="text-[10px] text-surface-400">งานสำเร็จ</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-400 text-center py-4">ยังไม่มีข้อมูล</p>
        )}
      </div>
    </div>
  );
}
