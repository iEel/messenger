'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Square,
  MapPin,
  Navigation,
  Phone,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package,
  ArrowRightLeft,
  Loader2,
  Bike,
  Timer,
} from 'lucide-react';
import { STATUS_CONFIG, type TaskStatus } from '@/lib/types';

interface AssignedTask {
  Id: number;
  TaskNumber: string;
  RecipientName: string;
  RecipientPhone: string | null;
  RecipientCompany: string | null;
  TaskType: string;
  DocumentDesc: string;
  Address: string;
  District: string | null;
  Latitude: number | null;
  Longitude: number | null;
  Status: TaskStatus;
  Priority: string;
}

interface ActiveTrip {
  Id: number;
  StartTime: string;
  TaskCount: number;
}

export default function MessengerPage() {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tripLoading, setTripLoading] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, tripsRes] = await Promise.all([
        fetch('/api/tasks?status=assigned&limit=50'),
        fetch('/api/trips?status=active'),
      ]);
      const tasksData = await tasksRes.json();
      const tripsData = await tripsRes.json();

      // รวมงาน assigned, picked_up, in_transit + roundtrip statuses
      const allTasksRes = await fetch('/api/tasks?limit=50');
      const allData = await allTasksRes.json();
      const myTasks = (allData.tasks || []).filter((t: AssignedTask) =>
        ['assigned', 'picked_up', 'in_transit', 'return_picked_up', 'returning'].includes(t.Status)
      );
      setTasks(myTasks);
      setActiveTrip(tripsData.length > 0 ? tripsData[0] : null);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Silent fetch สำหรับ polling (ไม่แสดง loading spinner)
  const fetchDataSilent = useCallback(async () => {
    try {
      const allTasksRes = await fetch('/api/tasks?limit=50');
      const allData = await allTasksRes.json();
      const myTasks = (allData.tasks || []).filter((t: AssignedTask) =>
        ['assigned', 'picked_up', 'in_transit', 'return_picked_up', 'returning'].includes(t.Status)
      );

      const tripsRes = await fetch('/api/trips?status=active');
      const tripsData = await tripsRes.json();

      setTasks(myTasks);
      setActiveTrip(tripsData.length > 0 ? tripsData[0] : null);
    } catch (error) {
      console.error('Silent fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh polling ทุก 30 วินาที
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    intervalRef.current = setInterval(() => {
      fetchDataSilent();
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchDataSilent]);

  // Timer
  useEffect(() => {
    if (!activeTrip) return;
    const interval = setInterval(() => {
      const start = new Date(activeTrip.StartTime).getTime();
      const diff = Date.now() - start;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTrip]);

  const handleStartTrip = async () => {
    setTripLoading(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) fetchData();
    } finally {
      setTripLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip || !confirm('ต้องการปิดรอบวิ่ง?')) return;
    setTripLoading(true);
    try {
      await fetch(`/api/trips/${activeTrip.Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'จบรอบวิ่ง' }),
      });
      fetchData();
    } finally {
      setTripLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: number, newStatus: string, notes: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      fetchData();
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const getNextAction = (status: TaskStatus, taskType?: string) => {
    switch (status) {
      case 'assigned':
        return { label: 'รับเอกสาร', status: 'picked_up', icon: <Package size={16} />, color: 'from-purple-500 to-purple-600', isPOD: false };
      case 'picked_up':
        return { label: 'ออกเดินทาง', status: 'in_transit', icon: <Bike size={16} />, color: 'from-blue-500 to-blue-600', isPOD: false };
      case 'in_transit':
        return { label: 'ส่งสำเร็จ', status: 'completed', icon: <CheckCircle size={16} />, color: 'from-emerald-500 to-emerald-600', isPOD: true };
      case 'return_picked_up':
        return { label: 'ออกเดินทางกลับ', status: 'returning', icon: <Bike size={16} />, color: 'from-cyan-500 to-cyan-600', isPOD: false };
      case 'returning':
        return { label: 'คืนเอกสารสำเร็จ', status: 'returned', icon: <CheckCircle size={16} />, color: 'from-teal-500 to-teal-600', isPOD: false };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fade-in pb-8">
      {/* Trip Control */}
      <div className={`rounded-2xl p-5 shadow-[var(--shadow-card)] border transition-all duration-300
                       ${activeTrip
                         ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-400'
                         : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700'}`}>
        {activeTrip ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="font-semibold text-sm">กำลังวิ่งงาน</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full">
                <Timer size={14} />
                <span className="font-mono text-sm font-bold">{elapsed}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-90">
                <p>📋 งานที่เหลือ: <b>{tasks.length}</b> ใบ</p>
              </div>
              <button onClick={handleEndTrip} disabled={tripLoading}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/20 hover:bg-white/30
                           flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50">
                {tripLoading ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                จบรอบวิ่ง
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Bike size={40} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
            <p className="font-medium text-surface-800 dark:text-white">ยังไม่ได้เริ่มรอบวิ่ง</p>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">กดปุ่มด้านล่างเพื่อเริ่มวิ่งงาน</p>
            <button onClick={handleStartTrip} disabled={tripLoading}
              className="mt-4 w-full py-3 rounded-xl text-sm font-semibold text-white
                         bg-gradient-to-r from-emerald-500 to-emerald-600
                         hover:from-emerald-600 hover:to-emerald-700
                         shadow-lg shadow-emerald-500/25 hover:shadow-xl
                         flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50">
              {tripLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              เริ่มรอบวิ่ง
            </button>
          </div>
        )}
      </div>

      {/* Task Cards */}
      <div>
        <h2 className="text-lg font-bold text-surface-800 dark:text-white mb-3">
          📋 งานของฉัน ({tasks.length})
          <span className="ml-2 text-xs font-normal text-surface-400">🔄 {countdown}s</span>
        </h2>

        {tasks.length === 0 ? (
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-8 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="font-medium text-surface-800 dark:text-white">ไม่มีงานค้าง</p>
            <p className="text-sm text-surface-500 mt-1">รอหัวหน้าแมสจ่ายงานใหม่</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const statusConf = STATUS_CONFIG[task.Status];
              const nextAction = getNextAction(task.Status, task.TaskType);

              return (
                <div key={task.Id}
                  className={`bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                              shadow-[var(--shadow-card)] overflow-hidden
                              ${task.Priority === 'urgent' ? 'border-red-300 dark:border-red-700' : ''}`}>
                  {/* Status Bar */}
                  <div className="h-1.5" style={{ backgroundColor: statusConf?.color }} />

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm font-mono text-surface-800 dark:text-white">{task.TaskNumber}</span>
                          {task.Priority === 'urgent' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600">ด่วน!</span>
                          )}
                          {task.TaskType === 'roundtrip' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-100 text-purple-600 flex items-center gap-1">
                              <ArrowRightLeft size={10} />ไป-กลับ
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: statusConf?.bgColor, color: statusConf?.color }}>
                          {statusConf?.icon} {statusConf?.labelTh}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <p className="text-sm text-surface-700 dark:text-surface-300 mb-2">📄 {task.DocumentDesc}</p>
                    <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400">
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="shrink-0" /> 
                        <span className="truncate">{task.Address}</span>
                      </p>
                      <div className="flex items-center gap-4">
                        <span>👤 {task.RecipientName}</span>
                        {task.RecipientPhone && (
                          <a href={`tel:${task.RecipientPhone}`}
                            className="flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium">
                            <Phone size={12} /> โทร
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                      {/* Navigate */}
                      {task.Latitude && task.Longitude && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${task.Latitude},${task.Longitude}&travelmode=two_wheeler`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center
                                     border border-surface-200 dark:border-surface-700
                                     text-surface-700 dark:text-surface-300
                                     hover:bg-surface-100 dark:hover:bg-surface-700
                                     flex items-center justify-center gap-1.5 transition-colors">
                          <Navigation size={14} /> นำทาง
                        </a>
                      )}

                      {/* Next Action */}
                      {nextAction && (
                        nextAction.isPOD ? (
                          <Link href={`/messenger/deliver/${task.Id}`}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white
                                        bg-gradient-to-r ${nextAction.color}
                                        shadow-md hover:shadow-lg
                                        flex items-center justify-center gap-1.5 transition-all`}>
                            {nextAction.icon} {nextAction.label}
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(task.Id, nextAction.status, nextAction.label)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white
                                        bg-gradient-to-r ${nextAction.color}
                                        shadow-md hover:shadow-lg
                                        flex items-center justify-center gap-1.5 transition-all cursor-pointer`}>
                            {nextAction.icon} {nextAction.label}
                          </button>
                        )
                      )}

                      {/* Report Issue */}
                      {task.Status === 'in_transit' && (
                        <Link href={`/messenger/issue/${task.Id}`}
                          className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center
                                     border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400
                                     hover:bg-red-50 dark:hover:bg-red-900/20
                                     flex items-center justify-center gap-1.5 transition-colors">
                          <AlertTriangle size={14} /> แจ้งปัญหา
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
