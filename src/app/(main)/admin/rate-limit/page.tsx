'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  RefreshCw,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  LogIn,
  Activity,
  Settings,
  Save,
} from 'lucide-react';

interface RateLimitEntry {
  ip: string;
  count: number;
  blocked: boolean;
  blockedAt: string | null;
  firstRequest: string;
  remainingMs: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

interface RateLimitData {
  stats: {
    general: RateLimitEntry[];
    login: RateLimitEntry[];
  };
  config: {
    general: RateLimitConfig;
    login: RateLimitConfig;
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} วินาที`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาที`;
  return `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function RateLimitPage() {
  const [data, setData] = useState<RateLimitData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable config state
  const [generalMax, setGeneralMax] = useState(60);
  const [generalWindowMin, setGeneralWindowMin] = useState(1);
  const [generalBlockMin, setGeneralBlockMin] = useState(5);
  const [loginMax, setLoginMax] = useState(5);
  const [loginWindowMin, setLoginWindowMin] = useState(1);
  const [loginBlockMin, setLoginBlockMin] = useState(15);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/rate-limit');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
        // Sync config to form
        setGeneralMax(json.config.general.maxRequests);
        setGeneralWindowMin(json.config.general.windowMs / 60000);
        setGeneralBlockMin(json.config.general.blockDurationMs / 60000);
        setLoginMax(json.config.login.maxRequests);
        setLoginWindowMin(json.config.login.windowMs / 60000);
        setLoginBlockMin(json.config.login.blockDurationMs / 60000);
      }
    } catch (error) {
      console.error('Fetch rate-limit error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleUnblock = async (ip: string) => {
    if (!confirm(`ปลดบล็อก IP: ${ip}?`)) return;
    try {
      const res = await fetch('/api/rate-limit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Unblock error:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/rate-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general: {
            maxRequests: generalMax,
            windowMs: generalWindowMin * 60000,
            blockDurationMs: generalBlockMin * 60000,
          },
          login: {
            maxRequests: loginMax,
            windowMs: loginWindowMin * 60000,
            blockDurationMs: loginBlockMin * 60000,
          },
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        fetchData();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Save config error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const blockedGeneral = data?.stats.general.filter(e => e.blocked) || [];
  const blockedLogin = data?.stats.login.filter(e => e.blocked) || [];
  const totalBlocked = blockedGeneral.length + blockedLogin.length;
  const activeGeneral = data?.stats.general.filter(e => !e.blocked) || [];
  const activeLogin = data?.stats.login.filter(e => !e.blocked) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Shield size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">Rate Limiting</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              จัดการการจำกัดอัตราการเข้าถึง
            </p>
          </div>
        </div>
        <button
          onClick={() => { setIsLoading(true); fetchData(); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
                     bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600
                     text-surface-700 dark:text-surface-300 transition-all duration-200 cursor-pointer"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Activity size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-surface-500 dark:text-surface-400">Active IPs</span>
          </div>
          <p className="text-2xl font-bold text-surface-800 dark:text-white">
            {(activeGeneral.length + activeLogin.length)}
          </p>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-surface-500 dark:text-surface-400">Blocked</span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalBlocked}</p>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Globe size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-sm text-surface-500 dark:text-surface-400">General Limit</span>
          </div>
          <p className="text-lg font-bold text-surface-800 dark:text-white">
            {data?.config.general.maxRequests || 60}<span className="text-sm font-normal text-surface-400">/นาที</span>
          </p>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <LogIn size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm text-surface-500 dark:text-surface-400">Login Limit</span>
          </div>
          <p className="text-lg font-bold text-surface-800 dark:text-white">
            {data?.config.login.maxRequests || 5}<span className="text-sm font-normal text-surface-400">/นาที</span>
          </p>
        </div>
      </div>

      {/* Blocked IPs */}
      {totalBlocked > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800 p-6">
          <h2 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-4">
            <AlertTriangle size={20} />
            IP ที่ถูกบล็อก ({totalBlocked})
          </h2>
          <div className="space-y-3">
            {[...blockedGeneral.map(e => ({ ...e, type: 'general' })),
              ...blockedLogin.map(e => ({ ...e, type: 'login' }))].map((entry) => (
              <div key={`${entry.type}-${entry.ip}`}
                   className="flex items-center justify-between bg-white dark:bg-surface-800 rounded-xl p-4
                              border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-surface-800 dark:text-white">{entry.ip}</p>
                    <div className="flex items-center gap-3 text-xs text-surface-500 mt-1">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        entry.type === 'login'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      }`}>
                        {entry.type === 'login' ? '🔐 Login' : '🌐 General'}
                      </span>
                      <span>{entry.count} requests</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        เหลือ {formatDuration(entry.remainingMs)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(entry.ip)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                             bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400
                             hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                >
                  <Unlock size={14} />
                  ปลดบล็อก
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Connections */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)]">
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="font-bold text-surface-800 dark:text-white flex items-center gap-2">
            <Activity size={18} />
            Active Connections
          </h2>
          <p className="text-xs text-surface-500 mt-1">
            อัปเดตอัตโนมัติทุก 10 วินาที • อัปเดตล่าสุด: {lastRefresh.toLocaleTimeString('th-TH')}
          </p>
        </div>

        {(activeGeneral.length + activeLogin.length) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-surface-400">
            <CheckCircle size={48} className="mb-3 opacity-30" />
            <p className="font-medium">ไม่มีการเชื่อมต่อที่ active</p>
            <p className="text-sm mt-1">ระบบทำงานปกติ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase">IP Address</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase">ประเภท</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase">Requests</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase">เริ่มต้น</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {[...activeGeneral.map(e => ({ ...e, type: 'general' as const })),
                  ...activeLogin.map(e => ({ ...e, type: 'login' as const }))]
                  .sort((a, b) => b.count - a.count)
                  .map((entry) => {
                    const config = entry.type === 'login' ? data?.config.login : data?.config.general;
                    const usage = config ? (entry.count / config.maxRequests) * 100 : 0;

                    return (
                      <tr key={`${entry.type}-${entry.ip}`}
                          className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-sm text-surface-700 dark:text-surface-300">{entry.ip}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.type === 'login'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                          }`}>
                            {entry.type === 'login' ? <LogIn size={10} /> : <Globe size={10} />}
                            {entry.type === 'login' ? 'Login' : 'General'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-sm font-bold ${
                              usage > 80 ? 'text-red-500' : usage > 50 ? 'text-amber-500' : 'text-surface-700 dark:text-surface-300'
                            }`}>
                              {entry.count}
                            </span>
                            <span className="text-xs text-surface-400">/ {config?.maxRequests}</span>
                          </div>
                          <div className="w-20 h-1.5 bg-surface-200 dark:bg-surface-600 rounded-full mt-1 mx-auto">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usage > 80 ? 'bg-red-500' : usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, usage)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-surface-500">
                          {formatTime(entry.firstRequest)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={12} />
                            ปกติ
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ★ Settings Section */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)]">
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h2 className="font-bold text-surface-800 dark:text-white flex items-center gap-2">
            <Settings size={18} />
            ตั้งค่า Rate Limit
          </h2>
          {saveSuccess && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <CheckCircle size={16} />
              บันทึกเรียบร้อย
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General Config */}
            <div className="space-y-4">
              <h3 className="font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                <Globe size={16} className="text-indigo-500" />
                General Rate Limit
              </h3>
              <div>
                <label className="block text-sm text-surface-500 dark:text-surface-400 mb-1">
                  จำนวน Request สูงสุด (ต่อ window)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={generalMax}
                  onChange={(e) => setGeneralMax(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-surface-500 dark:text-surface-400 mb-1">
                  Window (นาที)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={generalWindowMin}
                  onChange={(e) => setGeneralWindowMin(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-surface-500 dark:text-surface-400 mb-1">
                  ระยะเวลาบล็อก (นาที)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={generalBlockMin}
                  onChange={(e) => setGeneralBlockMin(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Login Config */}
            <div className="space-y-4">
              <h3 className="font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                <LogIn size={16} className="text-amber-500" />
                Login Rate Limit
              </h3>
              <div>
                <label className="block text-sm text-surface-500 dark:text-surface-400 mb-1">
                  จำนวน Login สูงสุด (ต่อ window)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={loginMax}
                  onChange={(e) => setLoginMax(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-surface-500 dark:text-surface-400 mb-1">
                  Window (นาที)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={loginWindowMin}
                  onChange={(e) => setLoginWindowMin(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-surface-500 dark:text-surface-400 mb-1">
                  ระยะเวลาบล็อก (นาที)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={loginBlockMin}
                  onChange={(e) => setLoginBlockMin(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-400">
              ✅ การตั้งค่าจะถูกบันทึกลงฐานข้อมูล มีผลทันทีและคงอยู่แม้ restart server
            </p>
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white
                         bg-gradient-to-r from-primary-600 to-primary-700
                         hover:from-primary-700 hover:to-primary-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-primary-500/25 transition-all duration-200 cursor-pointer"
            >
              <Save size={16} />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
