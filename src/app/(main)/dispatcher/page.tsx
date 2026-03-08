'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Truck,
  Search,
  UserCheck,
  Eye,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRightLeft,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Layers,
  Ban,
  List,
  Navigation,
  Route,
  CheckSquare,
  Square,
} from 'lucide-react';
import { STATUS_CONFIG, type TaskStatus } from '@/lib/types';
import { formatDateTimeShort } from '@/lib/date-utils';

interface TaskItem {
  Id: number;
  TaskNumber: string;
  RecipientName: string;
  RecipientCompany: string | null;
  TaskType: string;
  DocumentDesc: string;
  District: string | null;
  Address: string;
  Status: TaskStatus;
  Priority: string;
  ScheduledDate: string | null;
  CreatedAt: string;
  RequesterName: string;
  RequesterPhone: string | null;
  RequesterDept: string | null;
  MessengerName: string | null;
  AssignedTo: number | null;
  Latitude: number | null;
  Longitude: number | null;
  GoogleMapsUrl: string | null;
}

interface Messenger {
  Id: number;
  FullName: string;
  EmployeeId: string;
  Phone: string | null;
}

export default function DispatcherPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [messengers, setMessengers] = useState<Messenger[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<TaskItem | null>(null);
  const [selectedMessenger, setSelectedMessenger] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  // ★ Bulk assign
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [quickAssigning, setQuickAssigning] = useState<number | null>(null);
  const [groupByZone, setGroupByZone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dispatcher_groupByZone') === 'true';
    }
    return false;
  });

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
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

  // Silent fetch (ไม่แสดง loading spinner) สำหรับ polling
  const fetchTasksSilent = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Silent fetch error:', error);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchTasks();
    fetchMessengers();
    fetchOfficeCoords();
  }, [fetchTasks]);

  // Auto-refresh polling (30 วินาที) — หยุดเมื่อ Modal เปิดอยู่
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // เคลียร์ interval เดิมก่อน
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!assignModal) {
      // รีเซ็ต countdown
      setCountdown(30);

      // Countdown ทุก 1 วินาที
      countdownRef.current = setInterval(() => {
        setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
      }, 1000);

      // Fetch ทุก 30 วินาที
      intervalRef.current = setInterval(() => {
        fetchTasksSilent();
      }, 30000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [assignModal, fetchTasksSilent]);

  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number } | null>(null);

  const fetchOfficeCoords = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      // API returns array: [{SettingKey, SettingValue}, ...]
      const settings: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((s: { SettingKey: string; SettingValue: string }) => { settings[s.SettingKey] = s.SettingValue; });
      }
      const lat = parseFloat(settings['office_lat']);
      const lng = parseFloat(settings['office_lng']);
      if (lat && lng) setOfficeCoords({ lat, lng });
    } catch { /* ignore */ }
  };

  // Haversine formula for quick distance calculation
  const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchMessengers = async () => {
    try {
      const res = await fetch('/api/messengers');
      const data = await res.json();
      setMessengers(data);
    } catch (error) {
      console.error('Fetch messengers error:', error);
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedMessenger) return;
    setAssigning(true);
    try {
      const taskIds = assignModal.Id === -1 ? Array.from(selectedTasks) : [assignModal.Id];
      const messengerName = messengers.find(m => m.Id === selectedMessenger)?.FullName;
      
      await Promise.all(taskIds.map(id =>
        fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignedTo: selectedMessenger,
            status: 'assigned',
            notes: `จ่ายงานให้ ${messengerName}`,
          }),
        })
      ));
      setAssignModal(null);
      setSelectedMessenger(null);
      setSelectedTasks(new Set());
      setBulkMode(false);
      fetchTasks();
    } finally {
      setAssigning(false);
    }
  };

  // ★ Quick Assign — เลือกจาก dropdown บน card
  const handleQuickAssign = async (taskId: number, messengerId: number) => {
    setQuickAssigning(taskId);
    try {
      const messengerName = messengers.find(m => m.Id === messengerId)?.FullName;
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTo: messengerId,
          status: 'assigned',
          notes: `จ่ายงานให้ ${messengerName}`,
        }),
      });
      fetchTasks();
    } finally {
      setQuickAssigning(null);
    }
  };

  // ★ Toggle task selection
  const toggleTaskSelection = (taskId: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAllNewTasks = () => {
    const newTaskIds = tasks.filter(t => t.Status === 'new').map(t => t.Id);
    if (newTaskIds.every(id => selectedTasks.has(id))) {
      // deselect all
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(newTaskIds));
    }
  };

  // ★ ยกเลิกใบงาน
  const handleCancelTask = async (task: TaskItem) => {
    const confirmed = window.confirm(`ยืนยันยกเลิกใบงาน ${task.TaskNumber}?\nเอกสาร: ${task.DocumentDesc}\nผู้รับ: ${task.RecipientName}`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/tasks/${task.Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', notes: 'ยกเลิกโดยหัวหน้าแมสเซ็นเจอร์' }),
      });
      if (res.ok) fetchTasks();
    } catch (error) {
      console.error('Cancel error:', error);
    }
  };

  // นับงานแต่ละสถานะ
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.Status] = (acc[task.Status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // จัดกลุ่มตามเขต (Zone Clustering)
  const zoneGroups = groupByZone
    ? tasks.reduce((acc, task) => {
        const zone = task.District || 'ไม่ระบุเขต';
        if (!acc[zone]) acc[zone] = [];
        acc[zone].push(task);
        return acc;
      }, {} as Record<string, TaskItem[]>)
    : {};

  const sortedZones = Object.keys(zoneGroups).sort((a, b) => {
    if (a === 'ไม่ระบุเขต') return 1;
    if (b === 'ไม่ระบุเขต') return -1;
    return zoneGroups[b].length - zoneGroups[a].length;
  });

  const totalPages = Math.ceil(total / 50);

  // Render a single task card
  const renderTaskCard = (task: TaskItem) => {
    const statusConf = STATUS_CONFIG[task.Status];
    const isSelected = selectedTasks.has(task.Id);
    const isQuickAssigning = quickAssigning === task.Id;
    return (
      <div key={task.Id}
        className={`bg-white dark:bg-surface-800 rounded-2xl border-2 transition-all duration-200 overflow-hidden
                    shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                    ${isSelected ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800' : 'border-surface-200 dark:border-surface-700'}
                    ${task.Status === 'issue' ? 'issue-flash border-red-300 dark:border-red-700' : ''}`}>
        <div className="h-1.5" style={{ backgroundColor: statusConf?.color }} />
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-2">
              {/* ★ Checkbox สำหรับ Bulk Assign */}
              {task.Status === 'new' && (
                <button onClick={() => { if (!bulkMode) setBulkMode(true); toggleTaskSelection(task.Id); }}
                  className="mt-0.5 shrink-0 cursor-pointer text-surface-400 hover:text-primary-500 transition-colors">
                  {isSelected ? <CheckSquare size={18} className="text-primary-500" /> : <Square size={18} />}
                </button>
              )}
              <div>
                <span className="font-bold text-sm font-mono text-surface-800 dark:text-white">{task.TaskNumber}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ backgroundColor: statusConf?.bgColor, color: statusConf?.color }}>
                    {statusConf?.icon} {statusConf?.labelTh}
                  </span>
                  {task.Priority === 'urgent' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">
                      <AlertTriangle size={10} /> ด่วน
                    </span>
                  )}
                  {task.TaskType === 'roundtrip' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700">
                      <ArrowRightLeft size={10} />
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {task.Latitude && task.Longitude && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${task.Latitude},${task.Longitude}&travelmode=two_wheeler`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-surface-400 hover:text-blue-500 transition-colors"
                  title="ดูแผนที่">
                  <Navigation size={16} />
                </a>
              )}
              <Link href={`/tasks/${task.Id}`}
                className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-primary-500 transition-colors">
                <Eye size={16} />
              </Link>
            </div>
          </div>

          <p className="text-sm text-surface-700 dark:text-surface-300 line-clamp-2 mb-2">{task.DocumentDesc}</p>
          <div className="space-y-1 text-xs text-surface-500 dark:text-surface-400">
            <p className="flex items-center gap-1.5">
              <UserCheck size={13} /> <span className="font-semibold text-surface-600 dark:text-surface-300">ผู้รับ:</span> {task.RecipientName}
              {task.RecipientCompany && <span className="text-surface-400">({task.RecipientCompany})</span>}
            </p>
            <p className="flex items-center gap-1.5 truncate">
              <MapPin size={13} /> {task.District || task.Address}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock size={13} /> {formatDateTimeShort(task.CreatedAt)}
            </p>
            {officeCoords && task.Latitude && task.Longitude && (
              <p className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                <Route size={13} /> {calcDistance(officeCoords.lat, officeCoords.lng, task.Latitude, task.Longitude).toFixed(1)} km
              </p>
            )}
            {/* ★ ผู้สร้างใบงาน */}
            <p className="flex items-center gap-1.5">
              📝 <span className="font-semibold text-surface-600 dark:text-surface-300">ผู้ขอส่ง:</span> {task.RequesterName}{task.RequesterDept ? ` (${task.RequesterDept})` : ''}
              {task.RequesterPhone && (
                <a href={`tel:${task.RequesterPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1 text-orange-600 dark:text-orange-400 font-medium hover:underline">📞 {task.RequesterPhone}</a>
              )}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
            {task.MessengerName ? (
              <p className="text-xs text-surface-500 flex items-center gap-1.5">
                🏍️ <span className="font-medium text-surface-700 dark:text-surface-300">{task.MessengerName}</span>
              </p>
            ) : task.Status === 'new' ? (
              /* ★ Quick Assign Dropdown */
              <div className="relative">
                {isQuickAssigning ? (
                  <div className="w-full py-2 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-primary-500" /></div>
                ) : (
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) handleQuickAssign(task.Id, parseInt(e.target.value)); }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400
                               bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100
                               border border-primary-200 dark:border-primary-800
                               transition-colors cursor-pointer appearance-none
                               focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="" disabled>🏍️ เลือกแมสเซ็นเจอร์...</option>
                    {messengers.map(m => (
                      <option key={m.Id} value={m.Id}>{m.FullName} ({m.EmployeeId})</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <p className="text-xs text-surface-400">ยังไม่มีแมสเซ็นเจอร์</p>
            )}
          </div>

          {/* ★ ปุ่มยกเลิก (ทุกสถานะยกเว้น completed/returned/cancelled) */}
          {!['completed', 'returned', 'cancelled'].includes(task.Status) && (
            <div className="mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleCancelTask(task); }}
                className="w-full py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20
                           transition-colors cursor-pointer flex items-center justify-center gap-1">
                <Ban size={12} /> ยกเลิกใบงาน
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Truck size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">กระดานจ่ายงาน</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {total} ใบงานทั้งหมด
              <span className="ml-2 text-xs text-surface-400">
                {assignModal ? '⏸ หยุดรีเฟรช' : `🔄 ${countdown}s`}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Select All */}
          {tasks.some(t => t.Status === 'new') && (
            <button onClick={selectAllNewTasks}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                           border transition-all cursor-pointer
                           ${selectedTasks.size > 0
                             ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                             : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                           }`}>
              <CheckSquare size={16} />
              {selectedTasks.size > 0 ? `เลือก ${selectedTasks.size} ใบ` : 'เลือกทั้งหมด'}
            </button>
          )}
          {/* Zone Toggle */}
          <button onClick={() => { const next = !groupByZone; setGroupByZone(next); localStorage.setItem('dispatcher_groupByZone', String(next)); }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                         border transition-all cursor-pointer
                         ${groupByZone
                           ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                           : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                         }`}>
            {groupByZone ? <Layers size={16} /> : <List size={16} />}
            {groupByZone ? 'จัดตามเขต' : 'แสดงทั้งหมด'}
          </button>
          <Link href="/dispatcher/analytics"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700
                       hover:bg-surface-100 dark:hover:bg-surface-800 transition-all">
            <BarChart3 size={16} /> รายงาน
          </Link>
        </div>
      </div>

      {/* Status Summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, conf]) => (
          <button key={key}
            onClick={() => { setStatusFilter(statusFilter === key ? 'active' : key); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium 
                         transition-all duration-200 cursor-pointer border
                         ${statusFilter === key
                           ? 'shadow-sm scale-105'
                           : 'opacity-70 hover:opacity-100'}`}
            style={{
              backgroundColor: statusFilter === key ? conf.bgColor : 'transparent',
              color: conf.color,
              borderColor: conf.bgColor,
            }}>
            {conf.icon} {conf.labelTh}
            {statusCounts[key] > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: conf.color, color: '#fff' }}>
                {statusCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" placeholder="ค้นหาเลขใบงาน, ผู้รับ, ที่อยู่..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white placeholder:text-surface-400 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
        </div>
      </div>

      {/* Tasks */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-surface-500">กำลังโหลด...</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-surface-400">
          <Truck size={48} className="mb-3 opacity-30" />
          <p className="font-medium">ไม่มีใบงาน</p>
        </div>
      ) : groupByZone ? (
        /* Zone Grouped View */
        <div className="space-y-6">
          {sortedZones.map(zone => (
            <div key={zone}>
              <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 bg-surface-50 dark:bg-surface-900 py-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <MapPin size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-surface-800 dark:text-white">{zone}</h3>
                  <p className="text-[10px] text-surface-500">{zoneGroups[zone].length} ใบงาน</p>
                </div>
                <div className="flex-1 border-b border-surface-200 dark:border-surface-700 ml-2" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {zoneGroups[zone].map(task => renderTaskCard(task))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map(task => renderTaskCard(task))}
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

      {/* ★ Floating Bulk Assign Bar */}
      {selectedTasks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40
                        bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700
                        px-6 py-3 flex items-center gap-4 animate-fade-in">
          <p className="text-sm font-bold text-surface-800 dark:text-white">
            ✅ เลือก {selectedTasks.size} ใบงาน
          </p>
          <button
            onClick={() => { setAssignModal({ Id: -1 } as TaskItem); setSelectedMessenger(null); }}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white
                       bg-gradient-to-r from-primary-600 to-primary-700
                       hover:from-primary-700 hover:to-primary-800
                       shadow-lg shadow-primary-500/25 transition-all cursor-pointer
                       flex items-center gap-2">
            <UserCheck size={16} /> จ่ายงานทั้งหมด
          </button>
          <button
            onClick={() => { setSelectedTasks(new Set()); setBulkMode(false); }}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer">
            <X size={16} className="text-surface-400" />
          </button>
        </div>
      )}

      {/* Assign Modal (single + bulk) */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAssignModal(null)} />
          <div className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in">
            <button onClick={() => setAssignModal(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer">
              <X size={18} className="text-surface-400" />
            </button>

            <h3 className="text-lg font-bold text-surface-800 dark:text-white mb-1">
              {assignModal.Id === -1 ? `จ่ายงาน ${selectedTasks.size} ใบ` : 'จ่ายงาน'}
            </h3>
            <p className="text-sm text-surface-500 mb-4">
              {assignModal.Id === -1
                ? `เลือก ${selectedTasks.size} ใบงานที่จะจ่ายพร้อมกัน`
                : `${assignModal.TaskNumber} → ${assignModal.RecipientName}`}
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {messengers.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">ไม่มีแมสเซ็นเจอร์ในระบบ</p>
              ) : (
                messengers.map((m) => (
                  <button key={m.Id}
                    onClick={() => setSelectedMessenger(m.Id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-left
                      ${selectedMessenger === m.Id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'}`}>
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      🏍️
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800 dark:text-white">{m.FullName}</p>
                      <p className="text-xs text-surface-500">{m.EmployeeId}{m.Phone ? ` • ${m.Phone}` : ''}</p>
                    </div>
                    {selectedMessenger === m.Id && (
                      <CheckCircle size={18} className="ml-auto text-primary-500" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
              <button onClick={() => setAssignModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400
                           hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer">
                ยกเลิก
              </button>
              <button onClick={handleAssign} disabled={!selectedMessenger || assigning}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                           bg-gradient-to-r from-primary-600 to-primary-700
                           hover:from-primary-700 hover:to-primary-800
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-primary-500/25 transition-all cursor-pointer
                           flex items-center justify-center gap-2">
                {assigning ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                {assignModal.Id === -1 ? `จ่าย ${selectedTasks.size} ใบ` : 'จ่ายงาน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
