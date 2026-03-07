'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  MapPin,
  Save,
  Loader2,
  CheckCircle,
  Building,
  Globe,
  Hash,
} from 'lucide-react';
import { formatDateTimeShort } from '@/lib/date-utils';

interface Setting {
  Id: number;
  SettingKey: string;
  SettingValue: string;
  Description: string | null;
  UpdatedAt: string;
}

// จัดกลุ่ม settings ตามหมวดหมู่
const settingGroups = [
  {
    title: '📍 พิกัดออฟฟิศ',
    description: 'ตำแหน่งจุดรับเอกสารส่วนกลาง สำหรับคำนวณระยะทาง',
    icon: <MapPin size={20} />,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    keys: [
      { key: 'office_name', label: 'ชื่อจุดรับเอกสาร', icon: <Building size={16} />, type: 'text' as const },
      { key: 'office_lat', label: 'ละติจูด (Latitude)', icon: <Globe size={16} />, type: 'number' as const, placeholder: '13.7563' },
      { key: 'office_lng', label: 'ลองจิจูด (Longitude)', icon: <Globe size={16} />, type: 'number' as const, placeholder: '100.5018' },
    ],
  },
  {
    title: '📋 ใบงาน',
    description: 'ตั้งค่าเลขที่ใบงานและรูปแบบ',
    icon: <Hash size={20} />,
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    keys: [
      { key: 'task_number_prefix', label: 'คำนำหน้าเลขใบงาน', icon: <Hash size={16} />, type: 'text' as const, placeholder: 'MSG' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data: Setting[] = await res.json();
        setSettings(data);
        const values: Record<string, string> = {};
        data.forEach(s => { values[s.SettingKey] = s.SettingValue; });
        setFormValues(values);
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const settingsToSave = Object.entries(formValues).map(([key, value]) => ({ key, value }));
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchSettings();
      }
    } catch (error) {
      console.error('Save settings error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getValue = (key: string) => formValues[key] || '';
  const setValue = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const openGoogleMaps = () => {
    const lat = getValue('office_lat');
    const lng = getValue('office_lng');
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500">กำลังโหลดค่าตั้งค่า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Settings size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white">ตั้งค่าระบบ</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">จัดการค่าตั้งค่าทั้งหมดของระบบ</p>
          </div>
        </div>

        <button onClick={handleSave} disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                     bg-gradient-to-r from-primary-600 to-primary-700
                     hover:from-primary-700 hover:to-primary-800
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-lg shadow-primary-500/25 hover:shadow-xl
                     transition-all cursor-pointer">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> :
           saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'บันทึกแล้ว ✓' : 'บันทึก'}
        </button>
      </div>

      {/* Success Toast */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20
                        border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300
                        text-sm font-medium animate-fade-in">
          <CheckCircle size={16} /> บันทึกค่าตั้งค่าเรียบร้อยแล้ว
        </div>
      )}

      {/* Settings Groups */}
      {settingGroups.map(group => (
        <div key={group.title}
          className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                     shadow-[var(--shadow-card)] overflow-hidden">
          {/* Group Header */}
          <div className={`p-5 ${group.bgColor} border-b ${group.borderColor}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${group.color} flex items-center justify-center text-white shadow-sm`}>
                {group.icon}
              </div>
              <div>
                <h2 className="text-sm font-bold text-surface-800 dark:text-white">{group.title}</h2>
                <p className="text-xs text-surface-500 dark:text-surface-400">{group.description}</p>
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="p-5 space-y-4">
            {group.keys.map(field => (
              <div key={field.key}>
                <label htmlFor={field.key}
                  className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  <span className="text-surface-400">{field.icon}</span>
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type={field.type === 'number' ? 'text' : 'text'}
                  inputMode={field.type === 'number' ? 'decimal' : 'text'}
                  value={getValue(field.key)}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-900 text-surface-800 dark:text-white text-sm
                             placeholder:text-surface-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                             transition-all"
                />
              </div>
            ))}

            {/* Office Map Preview Button */}
            {group.keys.some(k => k.key === 'office_lat') && getValue('office_lat') && getValue('office_lng') && (
              <button onClick={openGoogleMaps}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                           text-blue-600 dark:text-blue-400
                           bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800
                           hover:bg-blue-100 dark:hover:bg-blue-900/30
                           transition-all cursor-pointer">
                <MapPin size={16} />
                ดูตำแหน่งบน Google Maps
                <span className="text-xs text-blue-400">({getValue('office_lat')}, {getValue('office_lng')})</span>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* All Settings Table */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <h3 className="text-sm font-bold text-surface-700 dark:text-surface-300">📂 ค่าทั้งหมดในระบบ</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Key</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">คำอธิบาย</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {settings.map(s => (
                <tr key={s.Id} className="border-b border-surface-100 dark:border-surface-700/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-surface-600 dark:text-surface-400">{s.SettingKey}</td>
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{s.SettingValue}</td>
                  <td className="px-4 py-3 text-surface-500 dark:text-surface-400 text-xs">{s.Description || '-'}</td>
                  <td className="px-4 py-3 text-surface-400 text-xs">
                    {formatDateTimeShort(s.UpdatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
