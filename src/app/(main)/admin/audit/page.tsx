'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Search,
  Calendar,
  Filter,
  Loader2,
  FileText,
  UserCheck,
  Truck,
  AlertTriangle,
  Settings,
  LogIn,
  Camera,
  ChevronLeft,
  ChevronRight,
  Ban,
  Bike,
  UserPlus,
  ArrowRightLeft,
} from 'lucide-react';

interface AuditEntry {
  Id: number;
  Action: string;
  UserId: number;
  UserName: string;
  TargetType: string | null;
  TargetId: number | null;
  Details: string | null;
  IpAddress: string | null;
  CreatedAt: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  task_created:        { label: 'สร้างใบงาน', icon: <FileText size={14} />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  task_assigned:       { label: 'จ่ายงาน', icon: <Truck size={14} />, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  task_reassigned:     { label: 'เปลี่ยนแมส', icon: <ArrowRightLeft size={14} />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  task_unassigned:     { label: 'ดึงงานกลับ', icon: <ArrowRightLeft size={14} />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  task_status_changed: { label: 'เปลี่ยนสถานะ', icon: <UserCheck size={14} />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  task_cancelled:      { label: 'ยกเลิกใบงาน', icon: <Ban size={14} />, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  trip_started:        { label: 'เริ่มรอบวิ่ง', icon: <Bike size={14} />, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  trip_ended:          { label: 'จบรอบวิ่ง', icon: <Bike size={14} />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  user_login:          { label: 'เข้าสู่ระบบ', icon: <LogIn size={14} />, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400' },
  user_created:        { label: 'สร้างผู้ใช้', icon: <UserPlus size={14} />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  user_updated:        { label: 'แก้ไขผู้ใช้', icon: <Settings size={14} />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  settings_updated:    { label: 'แก้ไขตั้งค่า', icon: <Settings size={14} />, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  pod_uploaded:        { label: 'อัปโหลดหลักฐาน', icon: <Camera size={14} />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                   'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} ${time}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const limit = 30;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (actionFilter) params.set('action', actionFilter);
      if (searchQuery) params.set('search', searchQuery);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Audit fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  if (isLoading && logs.length === 0) {
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
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Shield size={22} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">Audit Trail</h1>
            <p className="text-sm text-surface-500">ประวัติกิจกรรมทั้งหมดในระบบ • {total} รายการ</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ใช้ หรือรายละเอียด..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600
                         bg-white dark:bg-surface-700 text-sm text-surface-800 dark:text-white
                         focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="pl-9 pr-8 py-2 rounded-lg border border-surface-300 dark:border-surface-600
                         bg-white dark:bg-surface-700 text-sm text-surface-800 dark:text-white
                         focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
            >
              <option value="">ทุกกิจกรรม</option>
              {Object.entries(ACTION_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-surface-400 shrink-0" />
            <input type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="px-2 py-2 rounded-lg border border-surface-300 dark:border-surface-600
                         bg-white dark:bg-surface-700 text-xs text-surface-800 dark:text-white" />
            <span className="text-surface-400 text-xs">ถึง</span>
            <input type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="px-2 py-2 rounded-lg border border-surface-300 dark:border-surface-600
                         bg-white dark:bg-surface-700 text-xs text-surface-800 dark:text-white" />
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Shield size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-surface-500">ยังไม่มีประวัติกิจกรรม</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
            {logs.map((log) => {
              const config = ACTION_CONFIG[log.Action] || {
                label: log.Action,
                icon: <AlertTriangle size={14} />,
                color: 'bg-gray-100 text-gray-600'
              };
              return (
                <div key={log.Id} className="px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.color}`}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-surface-800 dark:text-white">
                          {log.UserName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {log.TargetType && log.TargetId && (
                          <span className="text-xs text-surface-400">
                            {log.TargetType} #{log.TargetId}
                          </span>
                        )}
                      </div>
                      {log.Details && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                          {log.Details}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-surface-400" title={formatDateTime(log.CreatedAt)}>
                        {timeAgo(log.CreatedAt)}
                      </p>
                      <p className="text-[10px] text-surface-300 dark:text-surface-600">
                        {formatDateTime(log.CreatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <p className="text-xs text-surface-500">
              หน้า {page} / {totalPages} ({total} รายการ)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700
                           disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700
                           disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
