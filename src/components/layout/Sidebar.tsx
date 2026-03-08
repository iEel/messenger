'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from '@/components/ThemeProvider';
import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  X,
  UserCircle,
  ClipboardList,
  Bike,
  Shield,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: (NavItem & { exact?: boolean })[] = [
  { label: 'แดชบอร์ด', href: '/dashboard', icon: <LayoutDashboard size={20} />, exact: true },
  { label: 'สร้างใบงาน', href: '/tasks/new', icon: <FileText size={20} />, roles: ['requester', 'admin'] },
  { label: 'งานของฉัน', href: '/tasks', icon: <ClipboardList size={20} />, roles: ['requester', 'admin'], exact: true },
  { label: 'งานวิ่ง', href: '/messenger', icon: <Bike size={20} />, roles: ['messenger', 'dispatcher'], exact: true },
  { label: 'จ่ายงาน', href: '/dispatcher', icon: <Truck size={20} />, roles: ['dispatcher', 'admin'], exact: true },
  { label: 'รายงาน', href: '/dispatcher/analytics', icon: <BarChart3 size={20} />, roles: ['dispatcher', 'admin'] },
  { label: 'จัดการผู้ใช้', href: '/admin/users', icon: <Users size={20} />, roles: ['admin'] },
  { label: 'Audit Trail', href: '/admin/audit', icon: <Shield size={20} />, roles: ['admin'] },
  { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: <Settings size={20} />, roles: ['admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = session?.user?.role || 'requester';

  const filteredNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Messenger" className="w-10 h-10 rounded-xl shadow-lg shrink-0" />
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-sm font-bold text-surface-800 dark:text-white whitespace-nowrap">Messenger</h1>
              <p className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">Tracking System</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                         transition-all duration-200 group relative
                         ${isActive(item)
                           ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                           : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-800 dark:hover:text-white'
                         }`}
          >
            <span className={`shrink-0 ${isActive(item) ? 'text-primary-600 dark:text-primary-400' : ''}`}>
              {item.icon}
            </span>
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            {isActive(item) && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
            )}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-surface-800 dark:bg-surface-700 text-white text-xs 
                              rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
                              whitespace-nowrap z-50 shadow-lg">
                {item.label}
              </div>
            )}
          </Link>
        ))}
      </nav>

      {/* User Info & Actions */}
      <div className="p-3 border-t border-surface-200 dark:border-surface-700 space-y-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                      text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800
                      transition-all duration-200 cursor-pointer`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          {!collapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>

        {/* User */}
        {session?.user && (
          <div className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center shrink-0">
              <UserCircle size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-surface-800 dark:text-white truncate">
                  {session.user.fullName}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                  {session.user.role === 'admin' ? 'ผู้ดูแลระบบ' : 
                   session.user.role === 'dispatcher' ? 'หัวหน้าแมสเซ็นเจอร์' :
                   session.user.role === 'messenger' ? 'แมสเซ็นเจอร์' : 'พนักงาน'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                     text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                     transition-all duration-200 cursor-pointer"
        >
          <LogOut size={20} />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white dark:bg-surface-800 
                       border-b border-surface-200 dark:border-surface-700 flex items-center px-4 gap-3 shadow-sm">
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer">
          <Menu size={22} className="text-surface-600 dark:text-surface-300" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="Messenger" className="w-8 h-8 rounded-lg" />
          <span className="font-semibold text-surface-800 dark:text-white text-sm">Messenger Tracking</span>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-surface-900 shadow-2xl animate-slide-in-right">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
            >
              <X size={20} className="text-surface-500" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30
                     bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700
                     shadow-[var(--shadow-sidebar)] transition-all duration-300
                     ${collapsed ? 'w-[72px]' : 'w-64'}`}
      >
        <SidebarContent />
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-surface-700 
                     border border-surface-200 dark:border-surface-600 shadow-md
                     flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
    </>
  );
}
