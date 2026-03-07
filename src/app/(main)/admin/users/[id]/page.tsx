'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  Building,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit3,
} from 'lucide-react';
import type { User as UserType } from '@/lib/types';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'requester',
    department: '',
    isActive: true,
  });
  const [originalUser, setOriginalUser] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (!res.ok) throw new Error('ไม่พบผู้ใช้');
        const user: UserType = await res.json();
        setOriginalUser(user);
        setForm({
          fullName: user.FullName,
          email: user.Email || '',
          phone: user.Phone || '',
          password: '',
          confirmPassword: '',
          role: user.Role,
          department: user.Department || '',
          isActive: user.IsActive,
        });
      } catch {
        setError('ไม่พบข้อมูลผู้ใช้');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password && form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (form.password && form.password !== form.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        department: form.department,
        isActive: form.isActive,
      };

      if (form.password) {
        body.password = form.password;
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setSuccess('บันทึกข้อมูลสำเร็จ!');
      setTimeout(() => router.push('/admin/users'), 1500);
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Edit3 size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">แก้ไขผู้ใช้</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {originalUser?.EmployeeId} — {originalUser?.FullName}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                          flex items-center gap-3 animate-fade-in">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800
                          flex items-center gap-3 animate-fade-in">
            <CheckCircle size={18} className="text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ข้อมูลพื้นฐาน */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">ข้อมูลพื้นฐาน</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">รหัสพนักงาน</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><User size={16} /></div>
                  <input value={originalUser?.EmployeeId || ''} disabled
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 text-sm cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  ชื่อ-สกุล <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><User size={16} /></div>
                  <input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* ข้อมูลติดต่อ */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">ข้อมูลติดต่อ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">อีเมล</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Mail size={16} /></div>
                  <input id="email" name="email" type="email" value={form.email} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">เบอร์โทร</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Phone size={16} /></div>
                  <input id="phone" name="phone" value={form.phone} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* บทบาทและแผนก */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">บทบาทและแผนก</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">บทบาท</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Shield size={16} /></div>
                  <select id="role" name="role" value={form.role} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               appearance-none cursor-pointer transition-all">
                    <option value="requester">พนักงาน (Requester)</option>
                    <option value="dispatcher">หัวหน้าแมสเซ็นเจอร์ (Dispatcher)</option>
                    <option value="messenger">แมสเซ็นเจอร์ (Messenger)</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">แผนก</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Building size={16} /></div>
                  <input id="department" name="department" value={form.department} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* สถานะ */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">สถานะ</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange}
                className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
              <span className="text-sm text-surface-700 dark:text-surface-300">เปิดใช้งานบัญชี</span>
            </label>
          </div>

          {/* เปลี่ยนรหัสผ่าน */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              เปลี่ยนรหัสผ่าน <span className="font-normal normal-case">(เว้นว่างถ้าไม่ต้องการเปลี่ยน)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">รหัสผ่านใหม่</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Lock size={16} /></div>
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="w-full pl-11 pr-12 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-surface-400">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ยืนยันรหัสผ่าน</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Lock size={16} /></div>
                  <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
            <Link href="/admin/users"
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400
                         hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
              ยกเลิก
            </Link>
            <button id="submit-edit-user" type="submit" disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-gradient-to-r from-primary-600 to-primary-700
                         hover:from-primary-700 hover:to-primary-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-primary-500/25 hover:shadow-xl
                         transition-all duration-200 flex items-center gap-2 cursor-pointer">
              {isSaving ? (
                <><Loader2 size={16} className="animate-spin" />กำลังบันทึก...</>
              ) : (
                <><Save size={16} />บันทึกข้อมูล</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
