'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  FileText,
  Truck,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Trophy,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { formatDateFull } from '@/lib/date-utils';

interface TodayStats {
  total: number;
  pending: number;
  assigned: number;
  in_transit: number;
  completed: number;
  issue: number;
}

interface WeeklyDay {
  day: string;
  total: number;
  completed: number;
}

interface TopMessenger {
  FullName: string;
  completed: number;
  avgMinutes: number | null;
}

interface AnalyticsData {
  today: TodayStats;
  weekly: WeeklyDay[];
  topMessengers: TopMessenger[];
  totalTasks: number;
}

const THAI_DAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Analytics fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const today = data?.today || { total: 0, pending: 0, assigned: 0, in_transit: 0, completed: 0, issue: 0 };

  const stats = [
    { label: 'งานวันนี้', value: today.total, icon: <FileText size={22} />, color: 'from-blue-500 to-blue-600' },
    { label: 'กำลังจัดส่ง', value: today.assigned + today.in_transit, icon: <Truck size={22} />, color: 'from-indigo-500 to-indigo-600' },
    { label: 'สำเร็จวันนี้', value: today.completed, icon: <CheckCircle2 size={22} />, color: 'from-emerald-500 to-emerald-600' },
    { label: 'มีปัญหา', value: today.issue, icon: <AlertTriangle size={22} />, color: 'from-red-500 to-red-600' },
  ];

  // Weekly chart — max value for scaling bars
  const weekly = data?.weekly || [];
  const maxTotal = Math.max(...weekly.map(d => d.total), 1);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-800 dark:text-white">
            สวัสดี, {session?.user?.fullName || 'ผู้ใช้งาน'} 👋
          </h1>
          <p className="mt-1 text-surface-500 dark:text-surface-400">
            ยินดีต้อนรับเข้าสู่ระบบ Messenger Tracking System
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
          <Clock size={16} />
          <span>{formatDateFull(new Date())}</span>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="relative overflow-hidden bg-white dark:bg-surface-800 rounded-2xl p-5
                         border border-surface-200 dark:border-surface-700
                         shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                         transition-all duration-300 group hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-surface-800 dark:text-white mt-2">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color}
                                flex items-center justify-center text-white shadow-lg
                                group-hover:scale-110 transition-transform duration-300`}>
                  {stat.icon}
                </div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color}
                              opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            </div>
          ))}
        </div>
      )}

      {/* Weekly Chart + Top Messengers */}
      {!isLoading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Bar Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                          shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-primary-500" />
              <h3 className="font-semibold text-surface-800 dark:text-white">สถิติ 7 วันย้อนหลัง</h3>
            </div>
            {weekly.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-8">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="flex items-end gap-2 h-44">
                {weekly.map((day, i) => {
                  const d = new Date(day.day + 'T00:00:00');
                  const dayLabel = THAI_DAY_SHORT[d.getDay()];
                  const dateLabel = d.getDate().toString();
                  const barH = (day.total / maxTotal) * 100;
                  const completedH = day.total > 0 ? (day.completed / day.total) * barH : 0;
                  const isToday = i === weekly.length - 1;

                  return (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-surface-500 font-medium">{day.total}</span>
                      <div className="w-full flex flex-col justify-end relative" style={{ height: '120px' }}>
                        {/* Total bar */}
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500
                                      ${isToday ? 'bg-primary-200 dark:bg-primary-900/40' : 'bg-surface-100 dark:bg-surface-700'}`}
                          style={{ height: `${barH}%`, minHeight: day.total > 0 ? '4px' : '0' }}
                        >
                          {/* Completed overlay */}
                          <div
                            className={`w-full rounded-t-lg absolute bottom-0
                                        ${isToday ? 'bg-primary-500' : 'bg-emerald-400 dark:bg-emerald-500'}`}
                            style={{ height: `${completedH}%`, minHeight: day.completed > 0 ? '4px' : '0' }}
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className={`text-[10px] font-semibold ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-surface-500'}`}>
                          {dayLabel}
                        </p>
                        <p className="text-[10px] text-surface-400">{dateLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 text-[10px] text-surface-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-surface-200 dark:bg-surface-600" /> ทั้งหมด</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> สำเร็จ</span>
              <span className="ml-auto">รวมทั้งหมด: {data.totalTasks} ใบงาน</span>
            </div>
          </div>

          {/* Top Messengers */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                          shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-amber-500" />
              <h3 className="font-semibold text-surface-800 dark:text-white">Top แมส (เดือนนี้)</h3>
            </div>
            {data.topMessengers.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-8">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {data.topMessengers.map((m, i) => {
                  const medals = ['🥇', '🥈', '🥉', '4', '5'];
                  return (
                    <div key={m.FullName}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <span className="text-lg w-7 text-center">{medals[i] || i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 dark:text-white truncate">{m.FullName}</p>
                        <p className="text-[10px] text-surface-400">
                          {m.avgMinutes != null ? `เฉลี่ย ${m.avgMinutes} นาที/งาน` : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{m.completed}</p>
                        <p className="text-[10px] text-surface-400">งาน</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(session?.user?.role === 'admin' || session?.user?.role === 'dispatcher') && (
          <Link href="/dispatcher" className="group">
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700
                            shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                            transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Truck size={22} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <ArrowUpRight size={18} className="text-surface-400 group-hover:text-primary-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-surface-800 dark:text-white">กระดานจ่ายงาน</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                มอบหมายและติดตามสถานะงาน
              </p>
            </div>
          </Link>
        )}

        {session?.user?.role === 'admin' && (
          <Link href="/admin/users" className="group">
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700
                            shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                            transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Users size={22} className="text-violet-600 dark:text-violet-400" />
                </div>
                <ArrowUpRight size={18} className="text-surface-400 group-hover:text-primary-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-surface-800 dark:text-white">จัดการผู้ใช้</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                สร้าง แก้ไข หรือจัดการบัญชีผู้ใช้งาน
              </p>
            </div>
          </Link>
        )}

        <Link href="/tasks/new" className="group">
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700
                          shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                          transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileText size={22} className="text-blue-600 dark:text-blue-400" />
              </div>
              <ArrowUpRight size={18} className="text-surface-400 group-hover:text-primary-500 transition-colors" />
            </div>
            <h3 className="font-semibold text-surface-800 dark:text-white">สร้างใบงานใหม่</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              สร้างใบงานส่งเอกสารใหม่
            </p>
          </div>
        </Link>

        <Link href="/tasks" className="group">
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-200 dark:border-surface-700
                          shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                          transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <ArrowUpRight size={18} className="text-surface-400 group-hover:text-primary-500 transition-colors" />
            </div>
            <h3 className="font-semibold text-surface-800 dark:text-white">ติดตามงาน</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              ดูสถานะและติดตามใบงานทั้งหมด
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
