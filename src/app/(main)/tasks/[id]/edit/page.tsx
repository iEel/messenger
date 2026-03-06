'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  User,
  Phone,
  Building,
  MapPin,
  FileEdit,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Map,
  ArrowLeftRight,
  ArrowRight as ArrowRightIcon,
  Calendar,
  AlertTriangle,
  Info,
} from 'lucide-react';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import PhoneInput from '@/components/ui/PhoneInput';

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [form, setForm] = useState({
    recipientName: '',
    recipientPhone: '',
    recipientCompany: '',
    taskType: 'oneway',
    documentDesc: '',
    notes: '',
    address: '',
    district: '',
    subDistrict: '',
    province: '',
    postalCode: '',
    googleMapsUrl: '',
    latitude: '',
    longitude: '',
    priority: 'normal',
    scheduledDate: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [taskNumber, setTaskNumber] = useState('');

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      const t = data.task;

      if (t.Status !== 'new') {
        setError('แก้ไขได้เฉพาะใบงานที่ยังไม่ถูกจ่ายงาน');
        return;
      }

      setTaskNumber(t.TaskNumber);
      setForm({
        recipientName: t.RecipientName || '',
        recipientPhone: t.RecipientPhone || '',
        recipientCompany: t.RecipientCompany || '',
        taskType: t.TaskType || 'oneway',
        documentDesc: t.DocumentDesc || '',
        notes: t.Notes || '',
        address: t.Address || '',
        district: t.District || '',
        subDistrict: t.SubDistrict || '',
        province: t.Province || '',
        postalCode: t.PostalCode || '',
        googleMapsUrl: t.GoogleMapsUrl || '',
        latitude: t.Latitude ? String(t.Latitude) : '',
        longitude: t.Longitude ? String(t.Longitude) : '',
        priority: t.Priority || 'normal',
        scheduledDate: t.ScheduledDate ? t.ScheduledDate.split('T')[0] : '',
      });
    } catch {
      setError('ไม่พบใบงาน');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const extractCoordsFromUrl = (url: string) => {
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /place\/.*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return { lat: match[1], lng: match[2] };
    }
    return null;
  };

  const handleMapsUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setForm(prev => ({ ...prev, googleMapsUrl: url }));
    if (url) {
      const coords = extractCoordsFromUrl(url);
      if (coords) {
        setForm(prev => ({ ...prev, googleMapsUrl: url, latitude: coords.lat, longitude: coords.lng }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.recipientName || !form.documentDesc || !form.address) {
      setError('กรุณากรอกข้อมูลที่จำเป็น: ชื่อผู้รับ, รายละเอียดเอกสาร, ที่อยู่');
      return;
    }

    // Validate phone
    if (form.recipientPhone) {
      const digits = form.recipientPhone.replace(/\D/g, '');
      const isBkk = digits.startsWith('02');
      const isProvincial = /^0[3-5,7]/.test(digits);
      const expectedLen = (isBkk || isProvincial) ? 9 : 10;
      if (digits.length !== expectedLen || !digits.startsWith('0')) {
        setError('เบอร์โทรผู้รับไม่ถูกต้อง');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
          scheduledDate: form.scheduledDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      router.push(`/tasks/${taskId}`);
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
          <p className="text-sm text-surface-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error && !taskNumber) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-surface-400">
        <AlertCircle size={48} className="mb-3 opacity-30" />
        <p className="font-medium">{error}</p>
        <Link href="/tasks" className="mt-4 text-primary-600 hover:underline text-sm">← กลับไปหน้ารายการ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/tasks/${taskId}`} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <FileEdit size={22} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">แก้ไขใบงาน</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 font-mono">{taskNumber}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ข้อมูลผู้รับ */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User size={16} /> ข้อมูลผู้รับ
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="recipientName" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                ชื่อผู้รับ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><User size={16} /></div>
                <input id="recipientName" name="recipientName" value={form.recipientName} onChange={handleChange} required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
            </div>
            <PhoneInput
              value={form.recipientPhone}
              onChange={(val) => { setForm(prev => ({ ...prev, recipientPhone: val })); setError(''); }}
            />
            <div className="sm:col-span-2">
              <label htmlFor="recipientCompany" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">บริษัท/องค์กร</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Building size={16} /></div>
                <input id="recipientCompany" name="recipientCompany" value={form.recipientCompany} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* รายละเอียดงาน */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileEdit size={16} /> รายละเอียดงาน
          </h3>

          {/* Task Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ประเภทงาน</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm({ ...form, taskType: 'oneway' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm
                  ${form.taskType === 'oneway'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'}`}>
                <ArrowRightIcon size={18} /> ส่งอย่างเดียว
              </button>
              <button type="button" onClick={() => setForm({ ...form, taskType: 'roundtrip' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm
                  ${form.taskType === 'roundtrip'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'}`}>
                <ArrowLeftRight size={18} /> ไป-กลับ
              </button>
            </div>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ความเร่งด่วน</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm({ ...form, priority: 'normal' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm
                  ${form.priority === 'normal'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'}`}>
                <Info size={16} /> ปกติ
              </button>
              <button type="button" onClick={() => setForm({ ...form, priority: 'urgent' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm
                  ${form.priority === 'urgent'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'}`}>
                <AlertTriangle size={16} /> ด่วน
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="documentDesc" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              รายละเอียดเอกสาร <span className="text-red-500">*</span>
            </label>
            <textarea id="documentDesc" name="documentDesc" value={form.documentDesc} onChange={handleChange} required
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="scheduledDate" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">วันนัดส่ง</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Calendar size={16} /></div>
                <input id="scheduledDate" name="scheduledDate" type="date" value={form.scheduledDate} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">หมายเหตุ</label>
              <input id="notes" name="notes" value={form.notes} onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
            </div>
          </div>
        </div>

        {/* ที่อยู่ */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin size={16} /> ที่อยู่ปลายทาง
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                ที่อยู่ <span className="text-red-500">*</span>
              </label>
              <textarea id="address" name="address" value={form.address} onChange={handleChange} required rows={2}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none" />
            </div>

            <AddressAutocomplete
              initialSubDistrict={form.subDistrict}
              initialDistrict={form.district}
              initialProvince={form.province}
              initialPostalCode={form.postalCode}
              onSelect={(addr) => setForm(prev => ({
                ...prev,
                subDistrict: addr.subDistrict,
                district: addr.district,
                province: addr.province,
                postalCode: addr.postalCode,
              }))}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="subDistrict" className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">แขวง/ตำบล</label>
                <input id="subDistrict" name="subDistrict" value={form.subDistrict} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
              <div>
                <label htmlFor="district" className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">เขต/อำเภอ</label>
                <input id="district" name="district" value={form.district} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
              <div>
                <label htmlFor="province" className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">จังหวัด</label>
                <input id="province" name="province" value={form.province} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
              <div>
                <label htmlFor="postalCode" className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">รหัสไปรษณีย์</label>
                <input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
            </div>

            <div>
              <label htmlFor="googleMapsUrl" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-2">
                <Map size={16} /> ลิงก์ Google Maps
              </label>
              <input id="googleMapsUrl" name="googleMapsUrl" value={form.googleMapsUrl} onChange={handleMapsUrlChange}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              {form.latitude && form.longitude && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} /> พิกัด: {form.latitude}, {form.longitude}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/tasks/${taskId}`}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400
                       hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
            ยกเลิก
          </Link>
          <button type="submit" disabled={isSaving}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-gradient-to-r from-amber-500 to-amber-600
                       hover:from-amber-600 hover:to-amber-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg shadow-amber-500/25 hover:shadow-xl
                       transition-all flex items-center gap-2 cursor-pointer">
            {isSaving ? <><Loader2 size={16} className="animate-spin" />กำลังบันทึก...</> : <><Save size={16} />บันทึกการแก้ไข</>}
          </button>
        </div>
      </form>
    </div>
  );
}
