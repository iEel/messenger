'use client';

import { useSession } from 'next-auth/react';
import {
  FileText,
  Truck,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// สถิติจำลอง (จะเชื่อมต่อ API จริงใน Phase ถัดไป)
const mockStats = [
  { label: 'งานใหม่วันนี้', value: '12', icon: <FileText size={22} />, color: 'from-blue-500 to-blue-600', change: '+3' },
  { label: 'กำลังจัดส่ง', value: '8', icon: <Truck size={22} />, color: 'from-indigo-500 to-indigo-600', change: '+2' },
  { label: 'สำเร็จวันนี้', value: '24', icon: <CheckCircle2 size={22} />, color: 'from-emerald-500 to-emerald-600', change: '+5' },
  { label: 'มีปัญหา', value: '2', icon: <AlertTriangle size={22} />, color: 'from-red-500 to-red-600', change: '-1' },
];

export default function DashboardPage() {
  const { data: session } = useSession();

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
          <span>{new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {mockStats.map((stat, i) => (
          <div
            key={i}
            className="relative overflow-hidden bg-white dark:bg-surface-800 rounded-2xl p-5 
                       border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                       transition-all duration-300 group hover:-translate-y-1"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-surface-800 dark:text-white mt-2">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-500">{stat.change} วันนี้</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} 
                              flex items-center justify-center text-white shadow-lg
                              group-hover:scale-110 transition-transform duration-300`}>
                {stat.icon}
              </div>
            </div>
            {/* Decorative gradient */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} 
                            opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
