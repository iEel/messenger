'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Truck,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

// Mock analytics data (จะเชื่อมต่อ API จริงในภายหลัง)
const mockAnalytics = {
  today: { total: 44, completed: 24, inTransit: 8, issues: 2, newTasks: 12 },
  weekly: { total: 180, completed: 142, avgDeliveryTime: '2.3 ชม.' },
};

export default function DispatcherAnalyticsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dispatcher" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <BarChart3 size={22} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">รายงานและสถิติ</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">ภาพรวมการจัดส่งเอกสาร</p>
          </div>
        </div>
      </div>

      {/* Today Stats */}
      <div>
        <h2 className="text-lg font-semibold text-surface-800 dark:text-white mb-4">📊 สรุปวันนี้</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'ทั้งหมด', value: mockAnalytics.today.total, icon: <FileText size={20} />, color: 'from-blue-500 to-blue-600' },
            { label: 'งานใหม่', value: mockAnalytics.today.newTasks, icon: <Clock size={20} />, color: 'from-yellow-500 to-yellow-600' },
            { label: 'กำลังส่ง', value: mockAnalytics.today.inTransit, icon: <Truck size={20} />, color: 'from-indigo-500 to-indigo-600' },
            { label: 'สำเร็จ', value: mockAnalytics.today.completed, icon: <CheckCircle size={20} />, color: 'from-emerald-500 to-emerald-600' },
            { label: 'มีปัญหา', value: mockAnalytics.today.issues, icon: <AlertTriangle size={20} />, color: 'from-red-500 to-red-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-md`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-surface-800 dark:text-white">{stat.value}</p>
              <p className="text-sm text-surface-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-2">งานสัปดาห์นี้</h3>
          <p className="text-3xl font-bold text-surface-800 dark:text-white">{mockAnalytics.weekly.total}</p>
          <p className="text-sm text-surface-500 mt-2">เสร็จแล้ว {mockAnalytics.weekly.completed} รายการ</p>
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((mockAnalytics.weekly.completed / mockAnalytics.weekly.total) * 100)}%` }} />
          </div>
          <p className="text-xs text-surface-400 mt-2">
            {Math.round((mockAnalytics.weekly.completed / mockAnalytics.weekly.total) * 100)}% อัตราสำเร็จ
          </p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-2">เวลาส่งเฉลี่ย</h3>
          <p className="text-3xl font-bold text-surface-800 dark:text-white">{mockAnalytics.weekly.avgDeliveryTime}</p>
          <p className="text-sm text-surface-500 mt-2">ต่อใบงาน (สัปดาห์นี้)</p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-2">ข้อมูลเพิ่มเติม</h3>
          <div className="space-y-3 mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">งานด่วน</span>
              <span className="font-medium text-red-500">5 รายการ</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">งานไป-กลับ</span>
              <span className="font-medium text-purple-500">12 รายการ</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">ปัญหาสัปดาห์นี้</span>
              <span className="font-medium text-orange-500">3 รายการ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder for chart */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-8 shadow-[var(--shadow-card)] text-center">
        <BarChart3 size={48} className="text-surface-300 mx-auto mb-3" />
        <p className="text-surface-500 font-medium">กราฟและรายงานเชิงลึก</p>
        <p className="text-sm text-surface-400 mt-1">จะพร้อมใช้งานใน Phase 5 (หลังเชื่อมต่อข้อมูลจริงครบถ้วน)</p>
      </div>
    </div>
  );
}
