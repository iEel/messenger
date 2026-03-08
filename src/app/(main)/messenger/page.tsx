'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Play,
  Square,
  MapPin,
  Navigation,
  Phone,
  CheckCircle,
  AlertTriangle,
  Package,
  ArrowRightLeft,
  Loader2,
  Bike,
  Timer,
  GripVertical,
  Route,
  Map,
  Sparkles,
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
  RequesterName?: string;
  RequesterPhone?: string | null;
  RequesterDept?: string | null;
  CreatedAt?: string;
}

interface ActiveTrip {
  Id: number;
  StartTime: string;
  TaskCount: number;
}

export default function MessengerPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tripLoading, setTripLoading] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{
    totalDistanceKm: number;
    totalDurationMinutes: number;
    source: string;
  } | null>(null);

  // Drag & Drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const touchMoveY = useRef<number>(0);
  const dragItem = useRef<number | null>(null);

  // Dispatcher ต้อง filter เฉพาะงานที่ assign ให้ตัวเอง
  const userId = session?.user?.id;
  const userRole = session?.user?.role;
  const assignedToParam = (userRole === 'dispatcher' && userId) ? `&assignedTo=${userId}` : '';

  // Office coords for distance calculation
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number } | null>(null);

  const fetchOfficeCoords = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const settings: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((s: { SettingKey: string; SettingValue: string }) => { settings[s.SettingKey] = s.SettingValue; });
      }
      const lat = parseFloat(settings['office_lat']);
      const lng = parseFloat(settings['office_lng']);
      if (lat && lng) setOfficeCoords({ lat, lng });
    } catch { /* ignore */ }
  };

  // Haversine formula
  const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

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
      const allTasksRes = await fetch(`/api/tasks?limit=50${assignedToParam}`);
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
  }, [assignedToParam]);

  // Silent fetch สำหรับ polling (ไม่แสดง loading spinner)
  const fetchDataSilent = useCallback(async () => {
    try {
      const allTasksRes = await fetch(`/api/tasks?limit=50${assignedToParam}`);
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
  }, [assignedToParam]);

  useEffect(() => {
    fetchData();
    fetchOfficeCoords();
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
      setOptimizeResult(null);
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

  // ================================================================
  // Auto-Sort (Route Optimization)
  // 💰 เรียก API ครั้งเดียว → ได้ลำดับที่ดีที่สุด
  // ================================================================
  const handleAutoSort = async () => {
    const taskIds = tasks.filter(t => t.Latitude && t.Longitude).map(t => t.Id);
    if (taskIds.length < 2) {
      alert('ต้องมีงานที่มีพิกัดอย่างน้อย 2 จุดจึงจัดเส้นทางได้');
      return;
    }

    setOptimizing(true);
    try {
      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: tasks.map(t => t.Id) }),
      });
      const data = await res.json();

      if (res.ok && data.optimizedTaskIds) {
        // จัดเรียง tasks ตาม optimized order
        const orderLookup: Record<number, number> = {};
        (data.optimizedTaskIds as number[]).forEach((id: number, idx: number) => { orderLookup[id] = idx; });
        const sorted = [...tasks].sort((a, b) =>
          (orderLookup[a.Id] ?? 999) - (orderLookup[b.Id] ?? 999)
        );
        setTasks(sorted);
        setOptimizeResult({
          totalDistanceKm: data.totalDistanceKm,
          totalDurationMinutes: data.totalDurationMinutes,
          source: data.source,
        });
      } else {
        alert(data.error || 'ไม่สามารถจัดเส้นทางได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการจัดเส้นทาง');
    } finally {
      setOptimizing(false);
    }
  };

  // ================================================================
  // Drag & Drop (HTML5 + Touch support)
  // ================================================================
  const handleDragStart = (index: number) => {
    setDragIndex(index);
    dragItem.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragItem.current === null || dragItem.current === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...tasks];
    const [movedItem] = updated.splice(dragItem.current, 1);
    updated.splice(index, 0, movedItem);
    setTasks(updated);

    setDragIndex(null);
    setDragOverIndex(null);
    dragItem.current = null;
    setOptimizeResult(null); // ล้างผลลัพธ์ optimize เมื่อ manual reorder
  };

  // Touch Drag & Drop
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartY.current = e.touches[0].clientY;
    dragItem.current = index;
    setDragIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragItem.current === null) return;
    touchMoveY.current = e.touches[0].clientY;
    const cards = document.querySelectorAll('[data-task-card]');
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (touchMoveY.current >= rect.top && touchMoveY.current <= rect.bottom) {
        setDragOverIndex(i);
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragItem.current !== null && dragOverIndex !== null && dragItem.current !== dragOverIndex) {
      const updated = [...tasks];
      const [movedItem] = updated.splice(dragItem.current, 1);
      updated.splice(dragOverIndex, 0, movedItem);
      setTasks(updated);
      setOptimizeResult(null);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragItem.current = null;
  };

  // ================================================================
  // Navigate Full Trip
  // สร้าง Google Maps URL จากลำดับปัจจุบัน (สูงสุด 9 waypoints)
  // ================================================================
  const buildFullTripUrl = () => {
    const withCoords = tasks.filter(t => t.Latitude && t.Longitude);
    if (withCoords.length === 0) return null;

    // จุดแรก = จุดหมาย, จุดท้ายสุด = ปลายทาง, จุดกลาง = waypoints
    if (withCoords.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&destination=${withCoords[0].Latitude},${withCoords[0].Longitude}&travelmode=two_wheeler`;
    }

    const lastTask = withCoords[withCoords.length - 1];
    // Google Maps URL supports max 9 waypoints via URL
    const middleTasks = withCoords.slice(0, Math.min(withCoords.length - 1, 9));
    const waypointStr = middleTasks
      .map(t => `${t.Latitude},${t.Longitude}`)
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&destination=${lastTask.Latitude},${lastTask.Longitude}&waypoints=${waypointStr}&travelmode=two_wheeler`;
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
        return { label: 'คืนเอกสาร + ถ่ายรูป', status: 'returned', icon: <CheckCircle size={16} />, color: 'from-teal-500 to-teal-600', isPOD: true };
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

  const fullTripUrl = buildFullTripUrl();

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

      {/* Smart Routing Toolbar */}
      {tasks.length >= 2 && (
        <div className="flex gap-2">
          {/* Auto-Sort Button */}
          <button onClick={handleAutoSort} disabled={optimizing}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white
                       bg-gradient-to-r from-indigo-500 to-purple-600
                       hover:from-indigo-600 hover:to-purple-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-md hover:shadow-lg
                       flex items-center justify-center gap-1.5 transition-all cursor-pointer">
            {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {optimizing ? 'กำลังจัดเส้นทาง...' : '🔀 จัดเส้นทางอัตโนมัติ'}
          </button>

          {/* Navigate Full Trip Button */}
          {fullTripUrl && (
            <a href={fullTripUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white
                         bg-gradient-to-r from-blue-500 to-cyan-600
                         hover:from-blue-600 hover:to-cyan-700
                         shadow-md hover:shadow-lg
                         flex items-center justify-center gap-1.5 transition-all">
              <Map size={14} />
              🗺️ นำทางทั้งรอบ
            </a>
          )}
        </div>
      )}

      {/* Optimize Result */}
      {optimizeResult && (
        <div className="px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800
                        flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Route size={14} />
            <span className="font-medium">
              {optimizeResult.source === 'google' ? '📡 Google Maps' : '📐 ประมาณ'}
            </span>
          </div>
          <div className="text-right text-indigo-600 dark:text-indigo-400 font-semibold">
            {optimizeResult.totalDistanceKm.toFixed(1)} km • ~{optimizeResult.totalDurationMinutes} นาที
          </div>
        </div>
      )}

      {/* Task Cards */}
      <div>
        <h2 className="text-lg font-bold text-surface-800 dark:text-white mb-1">
          📋 งานของฉัน ({tasks.length})
          <span className="ml-2 text-xs font-normal text-surface-400">🔄 {countdown}s</span>
        </h2>
        {tasks.length >= 2 && (
          <p className="text-[10px] text-surface-400 dark:text-surface-500 mb-3 flex items-center gap-1">
            <GripVertical size={10} /> ลากเพื่อสลับลำดับคิวงาน
          </p>
        )}

        {tasks.length === 0 ? (
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-8 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="font-medium text-surface-800 dark:text-white">ไม่มีงานค้าง</p>
            <p className="text-sm text-surface-500 mt-1">รอหัวหน้าแมสเซ็นเจอร์จ่ายงานใหม่</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => {
              const statusConf = STATUS_CONFIG[task.Status];
              const nextAction = getNextAction(task.Status, task.TaskType);
              const isDragging = dragIndex === index;
              const isDragOver = dragOverIndex === index;

              return (
                <div key={task.Id}
                  data-task-card
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  onTouchMove={(e) => handleTouchMove(e)}
                  onTouchEnd={handleTouchEnd}
                  className={`bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                              shadow-[var(--shadow-card)] overflow-hidden transition-all duration-200
                              ${task.Priority === 'urgent' ? 'border-red-300 dark:border-red-700' : ''}
                              ${isDragging ? 'opacity-50 scale-95' : ''}
                              ${isDragOver ? 'border-indigo-400 dark:border-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-800' : ''}`}>
                  {/* Status Bar */}
                  <div className="h-1.5" style={{ backgroundColor: statusConf?.color }} />

                  <div className="p-4">
                    {/* Header with drag handle */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-surface-300 dark:text-surface-600 hover:text-surface-500 touch-none">
                          <GripVertical size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {/* Queue Number */}
                            <span className="w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-[10px] font-bold text-surface-600 dark:text-surface-300">
                              {index + 1}
                            </span>
                            <span className="font-bold text-sm font-mono text-surface-800 dark:text-white">{task.TaskNumber}</span>
                            {task.Priority === 'urgent' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600 animate-pulse">🔴 ด่วน!</span>
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
                    </div>

                    {/* ★ Alert: สถานะ returning (ต้องนำเอกสารคืน) */}
                    {task.Status === 'returning' && (
                      <div className="mx-2 mb-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-center">
                        <p className="text-xs font-bold text-orange-700 dark:text-orange-300">📦 กรุณานำเอกสารกลับมาคืนที่ออฟฟิศ</p>
                        <p className="text-[10px] text-orange-500 mt-0.5">เมื่อคืนแล้ว กดปุ่ม &quot;คืนเอกสาร + ถ่ายรูป&quot; ด้านล่าง</p>
                      </div>
                    )}

                    {/* Details */}
                    <p className="text-sm text-surface-700 dark:text-surface-300 mb-2 ml-8">📄 {task.DocumentDesc}</p>
                    <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400 ml-8">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span>👤 <b>ผู้รับ:</b> {task.RecipientName}</span>
                        {task.RecipientCompany && <span className="text-surface-400">({task.RecipientCompany})</span>}
                        {task.RecipientPhone && (
                          <a href={`tel:${task.RecipientPhone}`}
                            className="flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium">
                            <Phone size={12} /> {task.RecipientPhone}
                          </a>
                        )}
                      </div>
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{task.District ? `${task.District} • ` : ''}{task.Address}</span>
                      </p>
                      {officeCoords && task.Latitude && task.Longitude && (
                        <p className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                          🛣️ {calcDistance(officeCoords.lat, officeCoords.lng, task.Latitude, task.Longitude).toFixed(1)} km จากออฟฟิศ
                        </p>
                      )}
                      {/* ★ ผู้สร้างใบงาน */}
                      {task.RequesterName && (
                        <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-dashed border-surface-200 dark:border-surface-700 mt-1">
                          <span>📝 <b>ผู้ขอส่ง:</b> {task.RequesterName}{task.RequesterDept ? ` (${task.RequesterDept})` : ''}</span>
                          {task.RequesterPhone && (
                            <a href={`tel:${task.RequesterPhone}`}
                              className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                              <Phone size={12} /> {task.RequesterPhone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                      {/* Navigate — ขากลับนำทางไป Office */}
                      {(() => {
                        const isReturnLeg = ['return_picked_up', 'returning'].includes(task.Status);
                        const navLat = isReturnLeg && officeCoords ? officeCoords.lat : task.Latitude;
                        const navLng = isReturnLeg && officeCoords ? officeCoords.lng : task.Longitude;
                        const navLabel = isReturnLeg ? '🏢 นำทางกลับ' : 'นำทาง';
                        return navLat && navLng ? (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}&travelmode=two_wheeler`}
                            target="_blank" rel="noopener noreferrer"
                            className={`flex-1 py-2.5 rounded-xl text-xs font-medium text-center
                                       border ${isReturnLeg ? 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400' : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300'}
                                       hover:bg-surface-100 dark:hover:bg-surface-700
                                       flex items-center justify-center gap-1.5 transition-colors`}>
                            <Navigation size={14} /> {navLabel}
                          </a>
                        ) : null;
                      })()}

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
