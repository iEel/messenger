'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  User,
  Phone,
  Building,
  MapPin,
  Clock,
  CheckCircle,
  ArrowRightLeft,
  Navigation,
  RotateCcw,
  CalendarClock,
  AlertCircle,
  Loader2,
  Route,
  Timer,
  Pencil,
  XCircle,
} from 'lucide-react';
import { STATUS_CONFIG, type TaskStatus } from '@/lib/types';

interface TaskDetail {
  Id: number;
  TaskNumber: string;
  RecipientName: string;
  RecipientPhone: string | null;
  RecipientCompany: string | null;
  TaskType: string;
  DocumentDesc: string;
  Notes: string | null;
  Address: string;
  District: string | null;
  SubDistrict: string | null;
  Province: string | null;
  PostalCode: string | null;
  Latitude: number | null;
  Longitude: number | null;
  GoogleMapsUrl: string | null;
  Status: TaskStatus;
  Priority: string;
  ScheduledDate: string | null;
  CompletedAt: string | null;
  CreatedAt: string;
  RequesterName: string;
  RequesterEmail: string;
  MessengerName: string | null;
}

interface HistoryEntry {
  Id: number;
  Status: TaskStatus;
  ChangedByName: string;
  Notes: string | null;
  CreatedAt: string;
}

interface DistanceInfo {
  distanceKm: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
  source: 'google' | 'haversine';
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [distance, setDistance] = useState<DistanceInfo | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setTask(data.task);
      setHistory(data.history);

      // Auto-fetch distance if task has coordinates
      if (data.task?.Latitude && data.task?.Longitude) {
        fetchDistance(data.task.Id);
      }
    } catch {
      // task not found
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDistance = async (id: number) => {
    setDistanceLoading(true);
    try {
      const res = await fetch(`/api/distance?taskId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setDistance(data);
      }
    } catch (error) {
      console.error('Distance fetch error:', error);
    } finally {
      setDistanceLoading(false);
    }
  };

  const handleAction = async (action: 'return' | 'reschedule') => {
    setActionLoading(action);
    try {
      const newStatus = action === 'return' ? 'returning' : 'assigned';
      const notes = action === 'return' ? 'พนักงานสั่งให้นำเอกสารคืน' : 'พนักงานสั่งเลื่อนส่งใหม่';
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });

      if (res.ok) {
        fetchTask();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('คุณต้องการยกเลิกใบงานนี้ใช่หรือไม่?\n\nเมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้')) return;

    setActionLoading('cancel');
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', notes: 'ผู้สร้างยกเลิกใบงาน' }),
      });

      if (res.ok) {
        router.push('/tasks');
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-surface-400">
        <FileText size={48} className="mb-3 opacity-30" />
        <p className="font-medium">ไม่พบใบงาน</p>
        <Link href="/tasks" className="mt-4 text-primary-600 hover:underline text-sm">← กลับไปหน้ารายการ</Link>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[task.Status];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tasks" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white font-mono">{task.TaskNumber}</h1>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
              style={{ backgroundColor: statusConf?.bgColor, color: statusConf?.color }}>
              {statusConf?.icon} {statusConf?.labelTh}
            </span>
            {task.TaskType === 'roundtrip' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <ArrowRightLeft size={14} />ไป-กลับ
              </span>
            )}
          </div>
          <p className="text-sm text-surface-500 mt-1">สร้างเมื่อ {new Date(task.CreatedAt).toLocaleString('th-TH')}</p>
        </div>
      </div>

      {/* Edit / Cancel Actions — แสดงเมื่อสถานะ = new */}
      {task.Status === 'new' && (
        <div className="flex items-center gap-3">
          <Link href={`/tasks/${taskId}/edit`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                       text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20
                       border border-amber-200 dark:border-amber-800
                       hover:bg-amber-100 dark:hover:bg-amber-900/30
                       transition-all">
            <Pencil size={16} /> แก้ไขใบงาน
          </Link>
          <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                       text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20
                       border border-red-200 dark:border-red-800
                       hover:bg-red-100 dark:hover:bg-red-900/30
                       disabled:opacity-50 transition-all cursor-pointer">
            {actionLoading === 'cancel' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            ยกเลิกใบงาน
          </button>
        </div>
      )}

      {/* Action Center - แสดงเมื่อสถานะ = issue */}
      {task.Status === 'issue' && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-6 animate-fade-in">
          <h3 className="font-bold text-red-700 dark:text-red-300 flex items-center gap-2 mb-3">
            <AlertCircle size={20} /> ศูนย์จัดการปัญหา
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            แมสเซ็นเจอร์แจ้งปัญหาหน้างาน กรุณาเลือกดำเนินการ:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleAction('return')} disabled={!!actionLoading}
              className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-orange-300 
                         bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300
                         hover:bg-orange-100 transition-all cursor-pointer font-medium disabled:opacity-50">
              {actionLoading === 'return' ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
              นำเอกสารมาคืน
            </button>
            <button onClick={() => handleAction('reschedule')} disabled={!!actionLoading}
              className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-blue-300
                         bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300
                         hover:bg-blue-100 transition-all cursor-pointer font-medium disabled:opacity-50">
              {actionLoading === 'reschedule' ? <Loader2 size={18} className="animate-spin" /> : <CalendarClock size={18} />}
              เลื่อนวันส่งใหม่
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* เอกสาร */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-5">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">📄 รายละเอียดเอกสาร</h3>
            <p className="text-surface-800 dark:text-white">{task.DocumentDesc}</p>
            {task.Notes && <p className="text-sm text-surface-500 mt-2">💬 {task.Notes}</p>}
            {task.ScheduledDate && (
              <p className="text-sm text-surface-500 mt-2">📅 วันนัดส่ง: {new Date(task.ScheduledDate).toLocaleDateString('th-TH')}</p>
            )}
          </div>

          {/* ผู้รับ */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-5">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">👤 ผู้รับเอกสาร</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-surface-800 dark:text-white">
                <User size={16} className="text-surface-400" /> {task.RecipientName}
              </div>
              {task.RecipientPhone && (
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-surface-400" />
                  <a href={`tel:${task.RecipientPhone}`} className="text-primary-600 hover:underline">{task.RecipientPhone}</a>
                </div>
              )}
              {task.RecipientCompany && (
                <div className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                  <Building size={16} className="text-surface-400" /> {task.RecipientCompany}
                </div>
              )}
            </div>
          </div>

          {/* ที่อยู่ + ระยะทาง */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-5">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">📍 ที่อยู่ปลายทาง</h3>
            <p className="text-surface-800 dark:text-white">{task.Address}</p>
            <p className="text-sm text-surface-500 mt-1">
              {[task.SubDistrict, task.District, task.Province, task.PostalCode].filter(Boolean).join(', ')}
            </p>

            {/* Distance Info */}
            {(distance || distanceLoading) && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                {distanceLoading ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 size={14} className="animate-spin" /> คำนวณระยะทาง...
                  </div>
                ) : distance && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-300">
                      <Route size={16} />
                      <span>{distance.distanceText}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
                      <Timer size={14} />
                      <span>~{distance.durationText}</span>
                    </div>
                    <span className="text-[10px] text-blue-400 ml-auto">
                      {distance.source === 'google' ? '📡 Google Maps' : '📐 ประมาณ'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Map Link */}
            <div className="flex gap-2 mt-3">
              {(task.Latitude && task.Longitude) && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${task.Latitude},${task.Longitude}&travelmode=two_wheeler`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 
                             text-primary-600 dark:text-primary-400 text-sm font-medium hover:bg-primary-100 transition-colors">
                  <Navigation size={16} /> นำทาง
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-5">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4">🕐 ไทม์ไลน์</h3>
            <div className="relative space-y-0">
              {history.map((entry, i) => {
                const conf = STATUS_CONFIG[entry.Status];
                const isLast = i === history.length - 1;
                return (
                  <div key={entry.Id} className="relative flex gap-3 pb-5">
                    {/* Line */}
                    {!isLast && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-surface-200 dark:bg-surface-700" />
                    )}
                    {/* Dot */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 z-10 shadow-sm"
                      style={{ backgroundColor: conf?.bgColor, color: conf?.color }}>
                      {conf?.icon}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-surface-800 dark:text-white">{conf?.labelTh}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {new Date(entry.CreatedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                      <p className="text-xs text-surface-400 mt-0.5">โดย {entry.ChangedByName}</p>
                      {entry.Notes && <p className="text-xs text-surface-500 mt-1 italic">💬 {entry.Notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info */}
            <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 space-y-2 text-xs text-surface-500">
              <div className="flex justify-between">
                <span>ผู้สร้าง</span>
                <span className="text-surface-700 dark:text-surface-300">{task.RequesterName}</span>
              </div>
              {task.MessengerName && (
                <div className="flex justify-between">
                  <span>แมสเซ็นเจอร์</span>
                  <span className="text-surface-700 dark:text-surface-300">{task.MessengerName}</span>
                </div>
              )}
              {distance && (
                <div className="flex justify-between">
                  <span>ระยะทาง</span>
                  <span className="text-surface-700 dark:text-surface-300">{distance.distanceText}</span>
                </div>
              )}
              {task.CompletedAt && (
                <div className="flex justify-between">
                  <span>เสร็จเมื่อ</span>
                  <span className="text-surface-700 dark:text-surface-300">{new Date(task.CompletedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
