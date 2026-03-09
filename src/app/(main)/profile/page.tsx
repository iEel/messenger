'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Building2,
  Lock,
  Save,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  BadgeCheck,
  Calendar,
  Clock,
} from 'lucide-react';

interface ProfileData {
  Id: number;
  EmployeeId: string;
  FullName: string;
  Email: string | null;
  Phone: string | null;
  Department: string | null;
  Role: string;
  CreatedAt: string;
  LastLoginAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  dispatcher: 'หัวหน้าแมสเซ็นเจอร์',
  messenger: 'แมสเซ็นเจอร์',
  requester: 'พนักงาน',
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso.replace('Z', ''));
  return d.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFullName(data.FullName || '');
        setEmail(data.Email || '');
        setPhone(data.Phone || '');
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const body: Record<string, string> = {};
      if (fullName !== profile?.FullName) body.fullName = fullName;
      if (email !== (profile?.Email || '')) body.email = email;
      if (phone !== (profile?.Phone || '')) body.phone = phone;

      if (Object.keys(body).length === 0) {
        setErrorMsg('ไม่มีข้อมูลที่เปลี่ยนแปลง');
        setIsSaving(false);
        return;
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('บันทึกข้อมูลเรียบร้อย');
        fetchProfile();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg('กรุณาระบุรหัสผ่านปัจจุบัน');
      setIsSaving(false);
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      setIsSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('รหัสผ่านใหม่ไม่ตรงกัน');
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('เปลี่ยนรหัสผ่านเรียบร้อย');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <User size={22} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-800 dark:text-white">โปรไฟล์ของฉัน</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            แก้ไขข้อมูลส่วนตัว
          </p>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 animate-fade-in">
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Profile Info Card (read-only) */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6">
        <h2 className="font-bold text-surface-800 dark:text-white flex items-center gap-2 mb-4">
          <BadgeCheck size={18} className="text-primary-500" />
          ข้อมูลบัญชี
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-surface-500 dark:text-surface-400">ชื่อผู้ใช้งาน</span>
            <p className="font-mono font-bold text-surface-800 dark:text-white mt-0.5">{profile?.EmployeeId}</p>
          </div>
          <div>
            <span className="text-surface-500 dark:text-surface-400">ตำแหน่ง</span>
            <p className="font-medium text-surface-800 dark:text-white mt-0.5">
              {ROLE_LABELS[profile?.Role || ''] || profile?.Role}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Calendar size={14} className="text-surface-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-surface-500 dark:text-surface-400">สร้างเมื่อ</span>
              <p className="text-surface-700 dark:text-surface-300 mt-0.5">{formatDate(profile?.CreatedAt || null)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-surface-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-surface-500 dark:text-surface-400">เข้าสู่ระบบล่าสุด</span>
              <p className="text-surface-700 dark:text-surface-300 mt-0.5">{formatDate(profile?.LastLoginAt || null)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Profile */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6">
        <h2 className="font-bold text-surface-800 dark:text-white flex items-center gap-2 mb-5">
          <User size={18} className="text-indigo-500" />
          ข้อมูลส่วนตัว
        </h2>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
              <User size={14} /> ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
              <Mail size={14} /> อีเมล
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
              <Phone size={14} /> เบอร์โทร
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
              className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
              <Building2 size={14} /> แผนก
            </label>
            <input
              type="text"
              value={profile?.Department || '-'}
              disabled
              className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400
                         cursor-not-allowed"
            />
            <p className="text-xs text-surface-400 mt-1">แผนกสามารถเปลี่ยนได้โดย Admin เท่านั้น</p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white
                         bg-gradient-to-r from-primary-600 to-primary-700
                         hover:from-primary-700 hover:to-primary-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-primary-500/25 transition-all duration-200 cursor-pointer"
            >
              <Save size={16} />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-surface-800 dark:text-white flex items-center gap-2">
            <Lock size={18} className="text-amber-500" />
            เปลี่ยนรหัสผ่าน
          </h2>
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
          >
            {showPasswordSection ? 'ยกเลิก' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </div>

        {showPasswordSection && (
          <div className="space-y-4 animate-fade-in">
            <div className="relative">
              <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                รหัสผ่านปัจจุบัน
              </label>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-[38px] text-surface-400 hover:text-surface-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                รหัสผ่านใหม่
              </label>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-[38px] text-surface-400 hover:text-surface-600 cursor-pointer"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white
                         bg-gradient-to-r from-amber-500 to-amber-600
                         hover:from-amber-600 hover:to-amber-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-amber-500/25 transition-all duration-200 cursor-pointer"
            >
              <Lock size={16} />
              {isSaving ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
