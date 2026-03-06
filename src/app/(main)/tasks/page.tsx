'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowRightLeft,
  ArrowRight,
} from 'lucide-react';
import { STATUS_CONFIG, type TaskStatus } from '@/lib/types';

interface TaskItem {
  Id: number;
  TaskNumber: string;
  RecipientName: string;
  RecipientCompany: string | null;
  TaskType: string;
  DocumentDesc: string;
  District: string | null;
  Status: TaskStatus;
  Priority: string;
  ScheduledDate: string | null;
  CreatedAt: string;
  RequesterName: string;
  MessengerName: string | null;
}

export default function TasksListPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Fetch tasks error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <ClipboardList size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">งานของฉัน</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">{total} รายการ</p>
          </div>
        </div>
        <Link href="/tasks/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white
                     bg-gradient-to-r from-primary-600 to-primary-700
                     hover:from-primary-700 hover:to-primary-800
                     shadow-lg shadow-primary-500/25 hover:shadow-xl
                     transition-all duration-200 hover:-translate-y-0.5">
          <Plus size={18} /><span>สร้างใบงานใหม่</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" placeholder="ค้นหาเลขใบงาน, ผู้รับ, เอกสาร..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white placeholder:text-surface-400 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <select value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-10 pr-8 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer transition-all">
            <option value="all">ทุกสถานะ</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.labelTh}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-surface-500">กำลังโหลด...</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-surface-400">
          <FileText size={48} className="mb-3 opacity-30" />
          <p className="font-medium">ยังไม่มีใบงาน</p>
          <p className="text-sm mt-1">สร้างใบงานใหม่เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const statusConf = STATUS_CONFIG[task.Status];
            return (
              <Link key={task.Id} href={`/tasks/${task.Id}`}>
                <div className={`bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                                 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                                 transition-all duration-200 hover:-translate-y-0.5 p-5
                                 ${task.Status === 'issue' ? 'issue-flash border-red-300 dark:border-red-700' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Status Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: statusConf?.bgColor }}>
                        {statusConf?.icon}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-surface-800 dark:text-white text-sm font-mono">{task.TaskNumber}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                            style={{ backgroundColor: statusConf?.bgColor, color: statusConf?.color }}>
                            {statusConf?.labelTh}
                          </span>
                          {task.TaskType === 'roundtrip' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              <ArrowRightLeft size={12} />ไป-กลับ
                            </span>
                          )}
                          {task.Priority === 'urgent' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              ด่วน
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-300 mt-1 truncate">
                          📄 {task.DocumentDesc}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 dark:text-surface-400">
                          <span>👤 {task.RecipientName}</span>
                          {task.RecipientCompany && <span>🏢 {task.RecipientCompany}</span>}
                          {task.District && <span>📍 {task.District}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <span className="text-xs text-surface-400">
                        {new Date(task.CreatedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                      {task.MessengerName && (
                        <span className="text-xs text-surface-500 dark:text-surface-400">🏍️ {task.MessengerName}</span>
                      )}
                      <Eye size={16} className="text-surface-400 hidden sm:block" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-500">หน้า {page} จาก {totalPages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
