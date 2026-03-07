'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  Building,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ⚠️ ต้องประกาศข้างนอก component หลัก เพื่อไม่ให้ React สร้างใหม่ทุก render
function InputField({
  icon,
  label,
  name,
  type = 'text',
  placeholder,
  required = false,
  value,
  onChange,
  showPassword,
  onTogglePassword,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}) {
  const isPasswordField = name === 'password' || name === 'confirmPassword';
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400">
          {icon}
        </div>
        <input
          id={name}
          type={isPasswordField ? (showPassword ? 'text' : 'password') : type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                     bg-white dark:bg-surface-800 text-surface-800 dark:text-white
                     placeholder:text-surface-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-all duration-200"
        />
        {isPasswordField && onTogglePassword && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-surface-400 
                       hover:text-surface-600 dark:hover:text-surface-300"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'requester',
    department: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate
    if (!form.employeeId || !form.fullName || !form.password || !form.role) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
      return;
    }

    if (form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: form.role,
          department: form.department,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setSuccess('สร้างผู้ใช้สำเร็จ! กำลังกลับไปหน้ารายการ...');
      setTimeout(() => router.push('/admin/users'), 1500);
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <UserPlus size={22} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">สร้างผู้ใช้ใหม่</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">เพิ่มบัญชีผู้ใช้งานในระบบ</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-6 sm:p-8">
        {/* Messages */}
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
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              ข้อมูลพื้นฐาน
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField icon={<User size={16} />} label="รหัสพนักงาน" name="employeeId" placeholder="เช่น EMP001" required value={form.employeeId} onChange={handleChange} />
              <InputField icon={<User size={16} />} label="ชื่อ-สกุล" name="fullName" placeholder="ชื่อ นามสกุล" required value={form.fullName} onChange={handleChange} />
            </div>
          </div>

          {/* ข้อมูลติดต่อ */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              ข้อมูลติดต่อ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField icon={<Mail size={16} />} label="อีเมล" name="email" type="email" placeholder="email@company.com" value={form.email} onChange={handleChange} />
              <InputField icon={<Phone size={16} />} label="เบอร์โทร" name="phone" placeholder="08x-xxx-xxxx" value={form.phone} onChange={handleChange} />
            </div>
          </div>

          {/* บทบาทและแผนก */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              บทบาทและแผนก
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  บทบาท <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400">
                    <Shield size={16} />
                  </div>
                  <select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="requester">พนักงาน (Requester)</option>
                    <option value="dispatcher">หัวหน้าแมสเซ็นเจอร์ (Dispatcher)</option>
                    <option value="messenger">แมสเซ็นเจอร์ (Messenger)</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>
              </div>
              <InputField icon={<Building size={16} />} label="แผนก" name="department" placeholder="เช่น บัญชี, การเงิน" value={form.department} onChange={handleChange} />
            </div>
          </div>

          {/* รหัสผ่าน */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              รหัสผ่าน
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField icon={<Lock size={16} />} label="รหัสผ่าน" name="password" placeholder="อย่างน้อย 6 ตัวอักษร" required value={form.password} onChange={handleChange} showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)} />
              <InputField icon={<Lock size={16} />} label="ยืนยันรหัสผ่าน" name="confirmPassword" placeholder="กรอกรหัสผ่านอีกครั้ง" required value={form.confirmPassword} onChange={handleChange} showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)} />
            </div>
            <p className="mt-2 text-xs text-surface-400">
              🔒 รหัสผ่านจะถูกเข้ารหัสด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
            <Link
              href="/admin/users"
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400
                         hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              ยกเลิก
            </Link>
            <button
              id="submit-create-user"
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-gradient-to-r from-primary-600 to-primary-700
                         hover:from-primary-700 hover:to-primary-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-primary-500/25 hover:shadow-xl
                         transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  สร้างผู้ใช้
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
