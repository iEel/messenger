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
  Calendar,
  Fuel,
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

interface MessengerDistanceItem {
  MessengerId: number; FullName: string;
  totalTrips: number; totalDistanceKm: number; avgDurationMinutes: number;
}

const DAY_NAMES: Record<number, string> = {
  0: 'อา', 1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ', 6: 'ส',
};

type DatePreset = 'today' | 'week' | 'month' | 'custom';

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return { from: weekAgo.toISOString().split('T')[0], to: today };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: monthStart.toISOString().split('T')[0], to: today };
    }
    default:
      return { from: today, to: today };
  }
}

function formatDateThai(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                   'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function AnalyticsPage() {
  const [today, setToday] = useState<TodayStats | null>(null);
  const [weekly, setWeekly] = useState<DailyData[]>([]);
  const [topMessengers, setTopMessengers] = useState<TopMessenger[]>([]);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [messengerDistance, setMessengerDistance] = useState<MessengerDistanceItem[]>([]);
  const [fuelRate, setFuelRate] = useState(2.5); // บาท/km default
  const [isLoading, setIsLoading] = useState(true);

  // ★ Date range state
  const [preset, setPreset] = useState<DatePreset>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async (from?: string, to?: string) => {
    setIsLoading(true);
    try {
      let url = '/api/analytics';
      if (from && to) {
        url += `?from=${from}&to=${to}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setToday(data.today);
      setWeekly(data.weekly || []);
      setTopMessengers(data.topMessengers || []);
      setWorkload(data.workload || []);
      setTripStats(data.tripStats || null);
      setMessengerDistance(data.messengerDistance || []);
      setTotalTasks(data.totalTasks || 0);
    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load + react to preset changes
  useEffect(() => {
    if (preset !== 'custom') {
      const { from, to } = getPresetDates(preset);
      setDateFrom(from);
      setDateTo(to);
      if (preset === 'today') {
        fetchData(); // no params = server default (today)
      } else {
        fetchData(from, to);
      }
    }
  }, [preset, fetchData]);

  // Custom date search
  const handleCustomSearch = () => {
    if (dateFrom && dateTo) {
      fetchData(dateFrom, dateTo);
    }
  };

  const completionRate = today && today.total > 0
    ? Math.round((today.completed / today.total) * 100) : 0;

  const maxDaily = Math.max(...weekly.map(d => d.total), 1);

  // ★ Date range label
  const getDateLabel = () => {
    if (preset === 'today') return `📊 สถิติวันนี้ (${formatDateThai(dateFrom)})`;
    if (preset === 'week') return `📊 สถิติ 7 วัน (${formatDateThai(dateFrom)} - ${formatDateThai(dateTo)})`;
    if (preset === 'month') return `📊 สถิติเดือนนี้ (${formatDateThai(dateFrom)} - ${formatDateThai(dateTo)})`;
    return `📊 สถิติ ${formatDateThai(dateFrom)} - ${formatDateThai(dateTo)}`;
  };

  // ★ Export CSV
  const handleExportCSV = useCallback(() => {
    if (!today || workload.length === 0) return;

    const bom = '\uFEFF';
    let csv = bom;

    // Header
    csv += `รายงาน ${formatDateThai(dateFrom)}`;
    if (dateFrom !== dateTo) csv += ` - ${formatDateThai(dateTo)}`;
    csv += `\n\n`;

    // สถิติ
    csv += `สถิติรวม\n`;
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

    // ระยะทางรายบุคคล (ค่าน้ำมัน)
    if (messengerDistance.length > 0) {
      csv += `ระยะทางแมสเซ็นเจอร์ (สำหรับค่าน้ำมัน)\n`;
      csv += `ชื่อ,รอบวิ่ง,ระยะทาง (km),เวลาเฉลี่ย (นาที),ค่าน้ำมันประมาณ (บาท)\n`;
      messengerDistance.forEach(m => {
        const fuel = (m.totalDistanceKm * fuelRate).toFixed(0);
        csv += `${m.FullName},${m.totalTrips},${m.totalDistanceKm.toFixed(1)},${m.avgDurationMinutes},${fuel}\n`;
      });
      csv += `\nอัตราค่าน้ำมัน,${fuelRate} บาท/km\n\n`;
    }

    // Top Messengers
    csv += `แมสเซ็นเจอร์ดีเด่น\n`;
    csv += `อันดับ,ชื่อ,งานสำเร็จ,เวลาเฉลี่ย (นาที)\n`;
    topMessengers.forEach((m, i) => {
      csv += `${i + 1},${m.FullName},${m.completed},${m.avgMinutes || '-'}\n`;
    });

    // รายวัน
    if (weekly.length > 0) {
      csv += `\nรายวัน\n`;
      csv += `วัน,ทั้งหมด,สำเร็จ\n`;
      weekly.forEach(d => {
        csv += `${d.day},${d.total},${d.completed}\n`;
      });
    }

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [today, workload, tripStats, topMessengers, weekly, dateFrom, dateTo]);

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

      {/* ★ Date Range Picker */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
            <Calendar size={16} className="text-primary-500" />
            ช่วงเวลา:
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'today', label: 'วันนี้' },
              { key: 'week', label: 'สัปดาห์นี้' },
              { key: 'month', label: 'เดือนนี้' },
              { key: 'custom', label: 'กำหนดเอง' },
            ] as { key: DatePreset; label: string }[]).map(p => (
              <button key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${preset === p.key
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                  }`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <input type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600
                           bg-white dark:bg-surface-700 text-sm text-surface-800 dark:text-white" />
              <span className="text-surface-400 text-xs">ถึง</span>
              <input type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600
                           bg-white dark:bg-surface-700 text-sm text-surface-800 dark:text-white" />
              <button onClick={handleCustomSearch}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white
                           bg-primary-500 hover:bg-primary-600 cursor-pointer transition-colors">
                ดู
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Header */}
      <div>
        <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">
          {getDateLabel()}
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
            <Bike size={16} className="text-blue-500" /> 🏍️ สรุปรอบวิ่ง
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

      {/* ★ ระยะทางแยกรายบุคคล (ค่าน้ำมัน) */}
      {messengerDistance.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
              <Fuel size={16} className="text-amber-500" /> ⛽ ระยะทางแมสเซ็นเจอร์ (สำหรับค่าน้ำมัน)
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-surface-500">อัตรา:</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={fuelRate}
                onChange={(e) => setFuelRate(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 rounded-lg border border-surface-300 dark:border-surface-600
                           bg-white dark:bg-surface-700 text-sm text-right text-surface-800 dark:text-white"
              />
              <span className="text-xs text-surface-500">บาท/km</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-700">
                  <th className="pb-2 pr-4">ชื่อ</th>
                  <th className="pb-2 px-2 text-center">รอบวิ่ง</th>
                  <th className="pb-2 px-2 text-center">ระยะทาง</th>
                  <th className="pb-2 px-2 text-center">เวลาเฉลี่ย</th>
                  <th className="pb-2 px-2 text-right">ค่าน้ำมัน (ประมาณ)</th>
                </tr>
              </thead>
              <tbody>
                {messengerDistance.map((m) => {
                  const fuelCost = m.totalDistanceKm * fuelRate;
                  return (
                    <tr key={m.MessengerId} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700/50">
                      <td className="py-2.5 pr-4 font-medium text-surface-800 dark:text-white">{m.FullName}</td>
                      <td className="py-2.5 px-2 text-center text-surface-600 dark:text-surface-300">{m.totalTrips}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-bold text-emerald-600">{m.totalDistanceKm.toFixed(1)}</span>
                        <span className="text-xs text-surface-400 ml-1">km</span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-surface-600 dark:text-surface-300">
                        {m.avgDurationMinutes > 0 ? `${m.avgDurationMinutes} นาที` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className="font-bold text-amber-600">฿{fuelCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="border-t-2 border-surface-300 dark:border-surface-600 font-bold">
                  <td className="py-2.5 pr-4 text-surface-800 dark:text-white">รวมทั้งหมด</td>
                  <td className="py-2.5 px-2 text-center text-surface-700 dark:text-surface-200">
                    {messengerDistance.reduce((s, m) => s + m.totalTrips, 0)}
                  </td>
                  <td className="py-2.5 px-2 text-center text-emerald-700 dark:text-emerald-400">
                    {messengerDistance.reduce((s, m) => s + m.totalDistanceKm, 0).toFixed(1)} km
                  </td>
                  <td className="py-2.5 px-2 text-center">-</td>
                  <td className="py-2.5 px-2 text-right text-amber-700 dark:text-amber-400">
                    ฿{(messengerDistance.reduce((s, m) => s + m.totalDistanceKm, 0) * fuelRate).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-surface-400 mt-3">
            * ระยะทางคำนวณจาก Google Maps (ถนนจริง) — Haversine fallback หากไม่มี API Key
          </p>
        </div>
      )}

      {/* ★ Workload รายวัน — แมสเซ็นเจอร์แต่ละคน */}
      {workload.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4 flex items-center gap-2">
            <Users size={16} className="text-indigo-500" /> 📋 Workload แมสเซ็นเจอร์
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

      {/* Completion Rate + Daily Chart (side-by-side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Completion Rate */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">🎯 อัตราสำเร็จ</h3>
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

        {/* Daily Bar Chart */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">📈 รายวัน</h3>
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
          <Trophy size={16} className="text-amber-500" /> แมสเซ็นเจอร์ดีเด่น
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
