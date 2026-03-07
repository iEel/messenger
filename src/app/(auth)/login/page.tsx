'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { 
  FileText, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        employeeId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Theme Toggle */}
      <button
        id="theme-toggle"
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-50 p-3 rounded-xl glass shadow-lg 
                   hover:scale-110 transition-all duration-300 cursor-pointer
                   dark:text-yellow-400 text-surface-600"
        aria-label="สลับธีม"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 
                       text-white p-12 flex-col justify-between overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-400/30 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-primary-300/20 blur-2xl" />
        </div>

        {/* Logo & Title */}
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center
                            border border-white/20 shadow-lg overflow-hidden">
              <img src="/favicon.png" alt="Messenger" className="w-20 h-20" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Messenger Tracking</h1>
              <p className="text-primary-200 text-sm font-medium">Document Delivery System</p>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="relative z-10 space-y-5 animate-slide-up">
          <h2 className="text-xl font-semibold mb-6 text-primary-100">ระบบบริหารจัดการแมสเซ็นเจอร์</h2>
          
          {[
            { icon: <Truck size={22} />, title: 'จัดการรอบวิ่ง', desc: 'ติดตามแมสเซ็นเจอร์แบบ Real-time' },
            { icon: <MapPin size={22} />, title: 'นำทางอัจฉริยะ', desc: 'เชื่อมต่อ Google Maps โหมดมอเตอร์ไซค์' },
            { icon: <CheckCircle2 size={22} />, title: 'หลักฐานการส่ง', desc: 'ถ่ายรูปและเซ็นรับอิเล็กทรอนิกส์' },
          ].map((feature, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 rounded-2xl bg-white/8 backdrop-blur-sm 
                         border border-white/10 hover:bg-white/12 transition-all duration-300
                         hover:translate-x-1"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0
                              shadow-inner">
                {feature.icon}
              </div>
              <div>
                <p className="font-semibold text-white">{feature.title}</p>
                <p className="text-sm text-primary-200 mt-0.5">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative z-10 text-primary-300 text-sm">
          <p>© 2026 Internal Messenger & Document Tracking System</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12
                       bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-16 h-16 rounded-2xl shadow-lg overflow-hidden">
              <img src="/favicon.png" alt="Messenger" className="w-16 h-16" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-surface-800 dark:text-white">Messenger Tracking</h1>
              <p className="text-xs text-surface-500">Document Delivery System</p>
            </div>
          </div>

          {/* Login Card */}
          <div className="glass rounded-3xl p-8 sm:p-10 shadow-[var(--shadow-glass)]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-surface-800 dark:text-white">
                เข้าสู่ระบบ
              </h2>
              <p className="mt-2 text-surface-500 dark:text-surface-400 text-sm">
                กรอกรหัสพนักงานและรหัสผ่านเพื่อเข้าใช้งาน
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                              flex items-center gap-3 animate-fade-in">
                <AlertCircle size={18} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Employee ID */}
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  รหัสพนักงาน
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={18} className="text-surface-400" />
                  </div>
                  <input
                    id="employeeId"
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="กรอกรหัสพนักงาน"
                    required
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white
                               placeholder:text-surface-400
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={18} className="text-surface-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    required
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-surface-200 dark:border-surface-700
                               bg-white dark:bg-surface-800 text-surface-800 dark:text-white
                               placeholder:text-surface-400
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer
                               text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl font-semibold text-white
                           bg-gradient-to-r from-primary-600 to-primary-700
                           hover:from-primary-700 hover:to-primary-800
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30
                           transform hover:-translate-y-0.5 active:translate-y-0
                           transition-all duration-200 flex items-center justify-center gap-2
                           cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bottom Info */}
          <p className="mt-8 text-center text-xs text-surface-400 dark:text-surface-500">
            ระบบบริหารจัดการแมสเซ็นเจอร์และติดตามเอกสาร v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
