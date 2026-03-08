'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Shield,
} from 'lucide-react';
import { ROLE_CONFIG, type User, type UserRole } from '@/lib/types';
import { formatDateTimeShort } from '@/lib/date-utils';

export default function UsersListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionMenu, setActionMenu] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ★ Click outside → close dropdown
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenu(null);
      }
    };
    if (actionMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionMenu]);

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    if (!confirm(currentActive ? 'ต้องการปิดการใช้งานผู้ใช้นี้?' : 'ต้องการเปิดการใช้งานผู้ใช้นี้?')) return;
    
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error('Toggle active error:', error);
    }
    setActionMenu(null);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Users size={22} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">จัดการผู้ใช้</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">{total} ผู้ใช้ทั้งหมด</p>
          </div>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white
                     bg-gradient-to-r from-primary-600 to-primary-700 
                     hover:from-primary-700 hover:to-primary-800
                     shadow-lg shadow-primary-500/25 hover:shadow-xl
                     transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus size={18} />
          <span>สร้างผู้ใช้ใหม่</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            id="search-users"
            type="text"
            placeholder="ค้นหาชื่อ, รหัสพนักงาน, อีเมล..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white
                       placeholder:text-surface-400 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       transition-all duration-200"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="pl-10 pr-8 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       transition-all duration-200 appearance-none cursor-pointer"
          >
            <option value="all">ทุกบทบาท</option>
            <option value="admin">ผู้ดูแลระบบ</option>
            <option value="requester">พนักงาน</option>
            <option value="dispatcher">หัวหน้าแมสเซ็นเจอร์</option>
            <option value="messenger">แมสเซ็นเจอร์</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-sm text-surface-500">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-surface-400">
            <Users size={48} className="mb-3 opacity-30" />
            <p className="font-medium">ไม่พบข้อมูลผู้ใช้</p>
            <p className="text-sm mt-1">ลองเปลี่ยนเงื่อนไขการค้นหา หรือสร้างผู้ใช้ใหม่</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">ผู้ใช้</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">รหัส</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">บทบาท</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">แผนก</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">สถานะ</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">เข้าใช้ล่าสุด</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {users.map((user) => {
                  const roleConf = ROLE_CONFIG[user.Role as UserRole];
                  return (
                    <tr key={user.Id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                            <UserCircle size={20} className="text-primary-600 dark:text-primary-400" />
                          </div>
                          <div>
                            <p className="font-medium text-surface-800 dark:text-white text-sm">{user.FullName}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">{user.Email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-surface-600 dark:text-surface-300 font-mono">{user.EmployeeId}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: roleConf?.bgColor, color: roleConf?.color }}
                        >
                          <Shield size={12} />
                          {roleConf?.labelTh || user.Role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-surface-600 dark:text-surface-400">
                        {user.Department || '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {user.IsActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={14} />
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                            <XCircle size={14} />
                            ปิดใช้งาน
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-surface-500 dark:text-surface-400">
                        {user.LastLoginAt
                          ? formatDateTimeShort(user.LastLoginAt)
                          : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="relative inline-block" ref={actionMenu === user.Id ? menuRef : undefined}>
                          <button
                            onClick={() => setActionMenu(actionMenu === user.Id ? null : user.Id)}
                            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                          >
                            <MoreVertical size={16} className="text-surface-400" />
                          </button>
                          {actionMenu === user.Id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-surface-800 
                                            rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 
                                            z-20 py-1 animate-fade-in">
                              <Link
                                href={`/admin/users/${user.Id}`}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300
                                           hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                onClick={() => setActionMenu(null)}
                              >
                                <Edit size={15} />
                                แก้ไข
                              </Link>
                              <button
                                onClick={() => handleToggleActive(user.Id, user.IsActive)}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm cursor-pointer
                                           hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors
                                           text-left"
                                style={{ color: user.IsActive ? '#EF4444' : '#22C55E' }}
                              >
                                {user.IsActive ? <XCircle size={15} /> : <CheckCircle size={15} />}
                                {user.IsActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-surface-200 dark:border-surface-700">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              หน้า {page} จาก {totalPages} ({total} รายการ)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30
                           transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30
                           transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
