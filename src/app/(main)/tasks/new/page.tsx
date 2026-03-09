'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  User,
  Phone,
  Building,
  MapPin,
  FileEdit,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Map,
  ArrowLeftRight,
  ArrowRight as ArrowRightIcon,
  Calendar,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import PhoneInput from '@/components/ui/PhoneInput';
import MapPicker from '@/components/ui/MapPicker';

export default function CreateTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');

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
    province: 'กรุงเทพมหานคร',
    postalCode: '',
    googleMapsUrl: '',
    latitude: '',
    longitude: '',
    priority: 'normal',
    scheduledDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [templateName, setTemplateName] = useState('');

  // ★ โหลดข้อมูลจาก Template (ถ้ามี ?template=ID)
  useEffect(() => {
    if (!templateId) return;
    const loadTemplate = async () => {
      try {
        const res = await fetch(`/api/task-templates/${templateId}`);
        if (!res.ok) return;
        const t = await res.json();
        setTemplateName(t.Name || '');
        setForm(prev => ({
          ...prev,
          recipientName: t.RecipientName || '',
          recipientPhone: t.RecipientPhone || '',
          recipientCompany: t.RecipientCompany || '',
          taskType: t.TaskType || 'oneway',
          documentDesc: t.DocumentDesc || '',
          address: t.Address || '',
          district: t.District || '',
          subDistrict: t.SubDistrict || '',
          province: t.Province || 'กรุงเทพมหานคร',
          postalCode: t.PostalCode || '',
          googleMapsUrl: t.GoogleMapsUrl || '',
          latitude: t.Latitude?.toString() || '',
          longitude: t.Longitude?.toString() || '',
          priority: t.Priority || 'normal',
        }));
      } catch { /* ignore */ }
    };
    loadTemplate();
  }, [templateId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // ดึง lat/lng จาก Google Maps URL
  // IMPORTANT: !3d...!4d... = actual pin, @lat,lng = viewport (less accurate)
  const extractCoordsFromUrl = (url: string) => {
    const patterns = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /destination=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { lat: match[1], lng: match[2] };
      }
    }
    return null;
  };

  // ตรวจสอบว่าเป็น short URL หรือไม่
  const isShortUrl = (url: string) => {
    return /goo\.gl|maps\.app\.goo/.test(url);
  };

  const [resolvingUrl, setResolvingUrl] = useState(false);

  const handleMapsUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setForm(prev => ({ ...prev, googleMapsUrl: url }));

    if (!url) return;

    // ลองดึงพิกัดจาก URL ตรงๆ ก่อน
    const coords = extractCoordsFromUrl(url);
    if (coords) {
      setForm(prev => ({ ...prev, googleMapsUrl: url, latitude: coords.lat, longitude: coords.lng }));
      return;
    }

    // ถ้าเป็น short URL → resolve ผ่าน API
    if (isShortUrl(url)) {
      setResolvingUrl(true);
      try {
        const res = await fetch(`/api/maps-resolve?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lat && data.lng) {
            setForm(prev => ({ ...prev, googleMapsUrl: url, latitude: data.lat, longitude: data.lng }));
          }
        }
      } catch (error) {
        console.error('Resolve short URL error:', error);
      } finally {
        setResolvingUrl(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.recipientName || !form.documentDesc || !form.address) {
      setError('กรุณากรอกข้อมูลที่จำเป็น: ชื่อผู้รับ, รายละเอียดเอกสาร, ที่อยู่');
      return;
    }

    // Validate phone if entered
    if (form.recipientPhone) {
      const digits = form.recipientPhone.replace(/\D/g, '');
      const isBkk = digits.startsWith('02');
      const isProvincial = /^0[3-5,7]/.test(digits);
      const expectedLen = (isBkk || isProvincial) ? 9 : 10;
      if (digits.length !== expectedLen || !digits.startsWith('0')) {
        setError('เบอร์โทรผู้รับไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
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

      setSuccess(`สร้างใบงาน ${data.taskNumber} สำเร็จ!`);
      setTimeout(() => router.push('/tasks'), 2000);
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tasks" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <ArrowLeft size={20} className="text-surface-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-800 dark:text-white">สร้างใบงานใหม่</h1>
              <p className="text-sm text-surface-500 dark:text-surface-400">กรอกข้อมูลเพื่อส่งเอกสาร</p>
            </div>
          </div>
        </div>
        <Link href="/tasks/templates"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                     text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20
                     border border-indigo-200 dark:border-indigo-800
                     hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer">
          <Copy size={14} /> เลือกจาก Template
        </Link>
      </div>

      {/* Template Info Banner */}
      {templateName && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800
                        flex items-center gap-2 animate-fade-in">
          <Copy size={16} className="text-indigo-500 shrink-0" />
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            ใช้ข้อมูลจาก Template: <strong>{templateName}</strong>
          </p>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3 animate-fade-in">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 animate-fade-in">
          <CheckCircle size={18} className="text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ข้อมูลผู้รับ */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
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
                  placeholder="ชื่อผู้รับเอกสาร"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
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
                  placeholder="ชื่อบริษัทหรือองค์กรผู้รับ"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* ประเภทงานและรายละเอียด */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileEdit size={16} /> รายละเอียดงาน
          </h3>

          {/* Task Type Toggle */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ประเภทงาน <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setForm({ ...form, taskType: 'oneway' })}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                  ${form.taskType === 'oneway'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'}`}>
                <ArrowRightIcon size={20} />
                <div className="text-left">
                  <p className="font-semibold text-sm">ส่งอย่างเดียว</p>
                  <p className="text-xs opacity-70">One-way</p>
                </div>
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, taskType: 'roundtrip' })}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                  ${form.taskType === 'roundtrip'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'}`}>
                <ArrowLeftRight size={20} />
                <div className="text-left">
                  <p className="font-semibold text-sm">ไป-กลับ / วางบิลรับเช็ค</p>
                  <p className="text-xs opacity-70">Round-trip</p>
                </div>
              </button>
            </div>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ความเร่งด่วน</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setForm({ ...form, priority: 'normal' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-sm
                  ${form.priority === 'normal'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'}`}>
                <Info size={16} /> ปกติ
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, priority: 'urgent' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-sm
                  ${form.priority === 'urgent'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'}`}>
                <AlertTriangle size={16} /> ด่วน
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="documentDesc" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              รายละเอียดเอกสาร <span className="text-red-500">*</span>
            </label>
            <textarea id="documentDesc" name="documentDesc" value={form.documentDesc} onChange={handleChange} required
              rows={3} placeholder="เช่น ใบแจ้งหนี้ 3 ฉบับ, เช็ค, สัญญา..."
              className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="scheduledDate" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">วันนัดส่ง</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Calendar size={16} /></div>
                <input id="scheduledDate" name="scheduledDate" type="date" value={form.scheduledDate} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">หมายเหตุ</label>
              <input id="notes" name="notes" value={form.notes} onChange={handleChange}
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
            </div>
          </div>
        </div>

        {/* ที่อยู่ */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin size={16} /> ที่อยู่ปลายทาง
          </h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                ที่อยู่ <span className="text-red-500">*</span>
              </label>
              <textarea id="address" name="address" value={form.address} onChange={handleChange} required
                rows={2} placeholder="เลขที่, ซอย, ถนน, อาคาร, ชั้น..."
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none" />
            </div>

            {/* Address Autocomplete */}
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

            {/* แสดงผลที่อยู่ที่เลือก (แก้ไขได้) */}
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

            {/* Google Maps Link */}
            <div>
              <label htmlFor="googleMapsUrl" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-2">
                <Map size={16} /> ลิงก์ Google Maps <span className="text-xs font-normal text-surface-400">(วางลิงก์เพื่อดึงพิกัดอัตโนมัติ)</span>
              </label>
              <input id="googleMapsUrl" name="googleMapsUrl" value={form.googleMapsUrl} onChange={handleMapsUrlChange}
                placeholder="https://maps.google.com/... หรือ https://maps.app.goo.gl/..."
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                           bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
              {resolvingUrl && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> กำลังดึงพิกัดจาก short URL...
                </p>
              )}
              {!resolvingUrl && form.latitude && form.longitude && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} /> พิกัด: {form.latitude}, {form.longitude}
                </p>
              )}
            </div>

            {/* ★ Map Picker */}
            <MapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onSelect={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))}
            />
          </div>
        </div>

        {/* Basket Notice */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800
                        flex items-start gap-3">
          <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">📋 หลังสร้างใบงาน</p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              กรุณานำเอกสารไปวางที่ <strong>จุดรับเอกสารส่วนกลาง (ตะกร้า)</strong> เพื่อให้แมสเซ็นเจอร์มารับ
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/tasks"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400
                       hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
            ยกเลิก
          </Link>
          <button id="submit-task" type="submit" disabled={isLoading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-gradient-to-r from-primary-600 to-primary-700
                       hover:from-primary-700 hover:to-primary-800
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg shadow-primary-500/25 hover:shadow-xl
                       transition-all duration-200 flex items-center gap-2 cursor-pointer">
            {isLoading ? (
              <><Loader2 size={16} className="animate-spin" />กำลังสร้าง...</>
            ) : (
              <><Send size={16} />สร้างใบงาน</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
