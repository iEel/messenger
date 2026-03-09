'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Copy,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  FileText,
  Users,
  User,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Search,
  Globe,
  Lock,
} from 'lucide-react';
import { useToast } from '@/components/toast';

interface Template {
  Id: number;
  Name: string;
  CreatedBy: number;
  CreatorName: string;
  RecipientName: string;
  RecipientCompany: string | null;
  TaskType: string;
  DocumentDesc: string | null;
  Address: string | null;
  District: string | null;
  Province: string | null;
  Priority: string;
  IsShared: boolean;
  CreatedAt: string;
}

export default function TemplatesPage() {
  const { data: session } = useSession();
  const { confirm } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const userId = session?.user?.id ? parseInt(session.user.id) : 0;
  const userRole = session?.user?.role || '';
  const canShare = ['admin', 'dispatcher'].includes(userRole);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/task-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Fetch templates error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (template: Template) => {
    const ok = await confirm({
      title: 'ลบ Template',
      message: `ยืนยันลบ "${template.Name}"?`,
      confirmText: 'ยืนยันลบ',
      cancelText: 'ไม่ใช่',
      type: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/task-templates/${template.Id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('ลบ Template สำเร็จ');
        fetchTemplates();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filtered = templates.filter(t =>
    !search || t.Name.toLowerCase().includes(search.toLowerCase()) ||
    t.RecipientName?.toLowerCase().includes(search.toLowerCase()) ||
    t.Address?.toLowerCase().includes(search.toLowerCase())
  );

  const myTemplates = filtered.filter(t => t.CreatedBy === userId);
  const sharedTemplates = filtered.filter(t => t.IsShared && t.CreatedBy !== userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const TemplateCard = ({ t }: { t: Template }) => (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                    shadow-[var(--shadow-card)] p-5 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-surface-800 dark:text-white truncate">{t.Name}</h3>
            {t.IsShared ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                <Globe size={10} /> แชร์
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400 shrink-0">
                <Lock size={10} /> ส่วนตัว
              </span>
            )}
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            {t.CreatedBy === userId ? 'สร้างโดยคุณ' : `สร้างโดย ${t.CreatorName}`}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold
          ${t.TaskType === 'roundtrip' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
          {t.TaskType === 'roundtrip' ? 'ไป-กลับ' : 'ส่งอย่างเดียว'}
        </span>
      </div>

      <div className="space-y-1.5 text-sm mb-4">
        <div className="flex items-center gap-2 text-surface-600 dark:text-surface-300">
          <User size={14} className="text-surface-400 shrink-0" />
          <span className="truncate">{t.RecipientName || '-'}</span>
          {t.RecipientCompany && (
            <span className="text-xs text-surface-400 truncate">({t.RecipientCompany})</span>
          )}
        </div>
        {t.Address && (
          <div className="flex items-start gap-2 text-surface-500 dark:text-surface-400">
            <MapPin size={14} className="text-surface-400 shrink-0 mt-0.5" />
            <span className="text-xs line-clamp-2">{t.Address}{t.District ? `, ${t.District}` : ''}{t.Province ? `, ${t.Province}` : ''}</span>
          </div>
        )}
        {t.DocumentDesc && (
          <div className="flex items-center gap-2 text-surface-500 dark:text-surface-400">
            <FileText size={14} className="text-surface-400 shrink-0" />
            <span className="text-xs truncate">{t.DocumentDesc}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-surface-100 dark:border-surface-700">
        <Link
          href={`/tasks/new?template=${t.Id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white
                     bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800
                     shadow-sm transition-all cursor-pointer"
        >
          <Copy size={13} /> สร้างใบงาน
        </Link>
        {(t.CreatedBy === userId || userRole === 'admin') && (
          <>
            <Link
              href={`/tasks/templates/${t.Id}/edit`}
              className="p-2 rounded-xl text-surface-400 hover:text-primary-600 hover:bg-primary-50
                         dark:hover:bg-primary-900/20 transition-colors cursor-pointer"
            >
              <Pencil size={15} />
            </Link>
            <button
              onClick={() => handleDelete(t)}
              className="p-2 rounded-xl text-surface-400 hover:text-red-600 hover:bg-red-50
                         dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tasks" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <ArrowLeft size={20} className="text-surface-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Copy size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-800 dark:text-white">ต้นแบบใบงาน</h1>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {templates.length} Template{canShare ? ' • สร้างแชร์ได้' : ''}
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/tasks/templates/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white
                     bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800
                     shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
        >
          <Plus size={16} /> สร้าง Template
        </Link>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
          <CheckCircle size={18} /><span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา Template..."
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                     bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                     focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
      </div>

      {/* My Templates */}
      {myTemplates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Lock size={14} /> ของฉัน ({myTemplates.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myTemplates.map(t => <TemplateCard key={t.Id} t={t} />)}
          </div>
        </div>
      )}

      {/* Shared Templates */}
      {sharedTemplates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe size={14} /> แชร์สาธารณะ ({sharedTemplates.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sharedTemplates.map(t => <TemplateCard key={t.Id} t={t} />)}
          </div>
        </div>
      )}

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-12 text-center">
          <Copy size={40} className="mx-auto text-surface-300 mb-3" />
          <p className="font-medium text-surface-700 dark:text-surface-300">ยังไม่มี Template</p>
          <p className="text-sm text-surface-500 mt-1">สร้าง Template เพื่อใช้ข้อมูลปลายทางซ้ำได้รวดเร็ว</p>
          <Link
            href="/tasks/templates/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white
                       bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus size={14} /> สร้าง Template แรก
          </Link>
        </div>
      )}
    </div>
  );
}
