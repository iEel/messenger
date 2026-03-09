'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Copy, User, Building, MapPin, FileEdit, Save, Loader2,
  AlertCircle, CheckCircle, Map, ArrowLeftRight, ArrowRight as ArrowRightIcon,
  Globe, Lock,
} from 'lucide-react';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import PhoneInput from '@/components/ui/PhoneInput';
import MapPicker from '@/components/ui/MapPicker';

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const canShare = ['admin', 'dispatcher'].includes(session?.user?.role || '');

  const [form, setForm] = useState({
    name: '', recipientName: '', recipientPhone: '', recipientCompany: '',
    taskType: 'oneway', documentDesc: '', address: '', district: '',
    subDistrict: '', province: 'กรุงเทพมหานคร', postalCode: '',
    googleMapsUrl: '', latitude: '', longitude: '', priority: 'normal', isShared: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resolvingUrl, setResolvingUrl] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/task-templates/${id}`);
        if (!res.ok) { setError('ไม่พบ Template'); return; }
        const data = await res.json();
        setForm({
          name: data.Name || '',
          recipientName: data.RecipientName || '',
          recipientPhone: data.RecipientPhone || '',
          recipientCompany: data.RecipientCompany || '',
          taskType: data.TaskType || 'oneway',
          documentDesc: data.DocumentDesc || '',
          address: data.Address || '',
          district: data.District || '',
          subDistrict: data.SubDistrict || '',
          province: data.Province || 'กรุงเทพมหานคร',
          postalCode: data.PostalCode || '',
          googleMapsUrl: data.GoogleMapsUrl || '',
          latitude: data.Latitude?.toString() || '',
          longitude: data.Longitude?.toString() || '',
          priority: data.Priority || 'normal',
          isShared: !!data.IsShared,
        });
      } catch { setError('เกิดข้อผิดพลาด'); } finally { setIsLoading(false); }
    };
    fetchTemplate();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const extractCoordsFromUrl = (url: string) => {
    const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/];
    for (const p of patterns) { const m = url.match(p); if (m) return { lat: m[1], lng: m[2] }; }
    return null;
  };

  const handleMapsUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setForm(prev => ({ ...prev, googleMapsUrl: url }));
    if (!url) return;
    const coords = extractCoordsFromUrl(url);
    if (coords) { setForm(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng })); return; }
    if (/goo\.gl|maps\.app\.goo/.test(url)) {
      setResolvingUrl(true);
      try {
        const res = await fetch(`/api/maps-resolve?url=${encodeURIComponent(url)}`);
        if (res.ok) { const data = await res.json(); if (data.lat && data.lng) setForm(prev => ({ ...prev, latitude: data.lat, longitude: data.lng })); }
      } catch { /* */ } finally { setResolvingUrl(false); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('กรุณาระบุชื่อ Template'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/task-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setSuccess('บันทึกสำเร็จ!');
      setTimeout(() => router.push('/tasks/templates'), 1500);
    } catch { setError('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link href="/tasks/templates" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Copy size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">แก้ไข Template</h1>
            <p className="text-sm text-surface-500">{form.name}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500" /><p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-500" /><p className="text-sm text-emerald-600">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ชื่อ Template */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Copy size={16} /> ข้อมูล Template</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ชื่อ Template <span className="text-red-500">*</span></label>
              <input id="name" name="name" value={form.name} onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
            </div>
            {canShare && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isShared}
                  onChange={(e) => setForm({ ...form, isShared: e.target.checked })}
                  className="w-5 h-5 rounded-md border-2 border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                <div className="flex items-center gap-2">
                  {form.isShared ? <Globe size={16} className="text-blue-500" /> : <Lock size={16} className="text-surface-400" />}
                  <span className="text-sm text-surface-700 dark:text-surface-300">{form.isShared ? 'แชร์ให้ทุกคนใช้ได้' : 'เก็บเป็นส่วนตัว'}</span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* ข้อมูลผู้รับ */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16} /> ข้อมูลผู้รับ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="recipientName" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">ชื่อผู้รับ</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><User size={16} /></div>
                <input id="recipientName" name="recipientName" value={form.recipientName} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
            </div>
            <PhoneInput value={form.recipientPhone} onChange={(val) => setForm(prev => ({ ...prev, recipientPhone: val }))} />
            <div className="sm:col-span-2">
              <label htmlFor="recipientCompany" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">บริษัท/องค์กร</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400"><Building size={16} /></div>
                <input id="recipientCompany" name="recipientCompany" value={form.recipientCompany} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* ประเภท + เอกสาร */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2"><FileEdit size={16} /> รายละเอียดงาน</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {['oneway', 'roundtrip'].map(type => (
              <button key={type} type="button" onClick={() => setForm({ ...form, taskType: type })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm
                  ${form.taskType === type ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'border-surface-200 dark:border-surface-700 text-surface-600'}`}>
                {type === 'oneway' ? <><ArrowRightIcon size={16} /> ส่งอย่างเดียว</> : <><ArrowLeftRight size={16} /> ไป-กลับ</>}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="documentDesc" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">รายละเอียดเอกสาร</label>
            <textarea id="documentDesc" name="documentDesc" value={form.documentDesc} onChange={handleChange} rows={2}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none" />
          </div>
        </div>

        {/* ที่อยู่ */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-[var(--shadow-card)] p-6">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2"><MapPin size={16} /> ที่อยู่ปลายทาง</h3>
          <div className="space-y-4">
            <textarea id="address" name="address" value={form.address} onChange={handleChange} rows={2} placeholder="ที่อยู่"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none" />
            <AddressAutocomplete initialSubDistrict={form.subDistrict} initialDistrict={form.district} initialProvince={form.province} initialPostalCode={form.postalCode}
              onSelect={(addr) => setForm(prev => ({ ...prev, subDistrict: addr.subDistrict, district: addr.district, province: addr.province, postalCode: addr.postalCode }))} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[{ id: 'subDistrict', label: 'แขวง/ตำบล' }, { id: 'district', label: 'เขต/อำเภอ' }, { id: 'province', label: 'จังหวัด' }, { id: 'postalCode', label: 'รหัสไปรษณีย์' }].map(f => (
                <div key={f.id}><label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{f.label}</label>
                  <input name={f.id} value={(form as unknown as Record<string, string>)[f.id]} onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" /></div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-2"><Map size={16} /> ลิงก์ Google Maps</label>
              <input name="googleMapsUrl" value={form.googleMapsUrl} onChange={handleMapsUrlChange}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm text-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
              {resolvingUrl && <p className="mt-2 text-xs text-blue-600 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> กำลังดึงพิกัด...</p>}
              {!resolvingUrl && form.latitude && form.longitude && <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={14} /> พิกัด: {form.latitude}, {form.longitude}</p>}
            </div>
            <MapPicker latitude={form.latitude} longitude={form.longitude}
              onSelect={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/tasks/templates" className="px-5 py-2.5 rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors">ยกเลิก</Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer">
            {saving ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Save size={16} /> บันทึก</>}
          </button>
        </div>
      </form>
    </div>
  );
}
