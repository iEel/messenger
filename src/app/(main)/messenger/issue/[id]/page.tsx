'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  PhoneOff,
  DoorClosed,
  MapPinOff,
  HelpCircle,
  Send,
  Loader2,
  CheckCircle,
} from 'lucide-react';

const ISSUE_TYPES = [
  { value: 'contact_failed', label: 'โทรติดต่อไม่ได้', icon: <PhoneOff size={22} />, desc: 'ผู้รับไม่รับสาย/เบอร์ไม่ถูกต้อง' },
  { value: 'office_closed', label: 'สำนักงานปิด', icon: <DoorClosed size={22} />, desc: 'สถานที่ปลายทางปิดทำการ' },
  { value: 'wrong_address', label: 'ที่อยู่ไม่ถูกต้อง', icon: <MapPinOff size={22} />, desc: 'ไม่พบสถานที่ตามที่ระบุ' },
  { value: 'other', label: 'อื่นๆ', icon: <HelpCircle size={22} />, desc: 'ปัญหาอื่นที่ไม่อยู่ในรายการ' },
];

export default function ReportIssuePage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!issueType) return;
    setIsLoading(true);

    try {
      // 1. บันทึก Issue
      // (ในทำจริงจะมี API /api/issues แยก — ตอนนี้ใช้ task status update)
      const notes = `${ISSUE_TYPES.find(t => t.value === issueType)?.label}: ${description || '-'}`;
      
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'issue', notes }),
      });

      setSuccess(true);
      setTimeout(() => router.push('/messenger'), 2000);
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <CheckCircle size={64} className="text-emerald-500 mb-4" />
        <h2 className="text-xl font-bold text-surface-800 dark:text-white">แจ้งปัญหาเรียบร้อย</h2>
        <p className="text-sm text-surface-500 mt-2">หัวหน้าแมสเซ็นเจอร์จะตรวจสอบและแจ้งกลับ</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/messenger" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800 dark:text-white">แจ้งปัญหาหน้างาน</h1>
            <p className="text-xs text-surface-500">ใบงานจะถูกส่งให้หัวหน้าแมสเซ็นเจอร์ตรวจสอบ</p>
          </div>
        </div>
      </div>

      {/* Issue Types */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-surface-700 dark:text-surface-300">ประเภทปัญหา <span className="text-red-500">*</span></p>
        <div className="grid grid-cols-1 gap-2">
          {ISSUE_TYPES.map((type) => (
            <button key={type.value}
              onClick={() => setIssueType(type.value)}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer
                ${issueType === type.value
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                ${issueType === type.value
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-600'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                {type.icon}
              </div>
              <div>
                <p className="font-medium text-surface-800 dark:text-white text-sm">{type.label}</p>
                <p className="text-xs text-surface-500 mt-0.5">{type.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="desc" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          รายละเอียดเพิ่มเติม
        </label>
        <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)}
          rows={3} placeholder="อธิบายปัญหาเพิ่มเติม (ถ้ามี)"
          className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                     bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                     focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none" />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!issueType || isLoading}
        className="w-full py-3.5 rounded-xl text-sm font-semibold text-white
                   bg-gradient-to-r from-red-500 to-red-600
                   hover:from-red-600 hover:to-red-700
                   disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-lg shadow-red-500/25 hover:shadow-xl
                   flex items-center justify-center gap-2 transition-all cursor-pointer">
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        ส่งแจ้งปัญหา
      </button>
    </div>
  );
}
