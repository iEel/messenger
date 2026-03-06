'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  CheckCircle,
  Loader2,
  X,
  Upload,
} from 'lucide-react';
import SignaturePad from '@/components/ui/SignaturePad';

export default function DeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [signature, setSignature] = useState<string>('');
  const [receiverName, setReceiverName] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files).slice(0, 3 - photos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos].slice(0, 3));
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!signature) {
      alert('กรุณาให้ผู้รับเซ็นชื่อ');
      return;
    }

    setIsLoading(true);
    try {
      // อัปเดตสถานะเป็น completed พร้อมข้อมูล POD
      const podNotes = [
        `ผู้รับ: ${receiverName || '-'}`,
        `รูปถ่าย: ${photos.length} รูป`,
        notes ? `หมายเหตุ: ${notes}` : '',
      ].filter(Boolean).join(' | ');

      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          notes: podNotes,
          signatureData: signature,
        }),
      });

      setSuccess(true);
      setTimeout(() => router.push('/messenger'), 2000);
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-surface-800 dark:text-white">ส่งเอกสารสำเร็จ! 🎉</h2>
        <p className="text-sm text-surface-500 mt-2">บันทึกหลักฐานการส่งเรียบร้อย</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/messenger" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <ArrowLeft size={20} className="text-surface-500" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle size={22} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800 dark:text-white">ยืนยันการส่ง</h1>
            <p className="text-xs text-surface-500">บันทึกหลักฐานการส่งเอกสาร</p>
          </div>
        </div>
      </div>

      {/* Photo Section */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-5">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
          <Camera size={16} /> ถ่ายรูปหลักฐาน
          <span className="text-xs font-normal text-surface-400">({photos.length}/3)</span>
        </h3>

        {/* Photo Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {photos.map((photo, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700">
              <img src={photo.preview} alt={`รูปที่ ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => removePhoto(i)} type="button"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white
                           flex items-center justify-center shadow-md cursor-pointer">
                <X size={12} />
              </button>
            </div>
          ))}

          {photos.length < 3 && (
            <button type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600
                         flex flex-col items-center justify-center gap-1 text-surface-400
                         hover:border-primary-400 hover:text-primary-500 cursor-pointer transition-colors">
              <Upload size={20} />
              <span className="text-[10px]">เพิ่มรูป</span>
            </button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple
          className="hidden" onChange={handlePhotoCapture} />

        {photos.length === 0 && (
          <div className="flex gap-2">
            <button type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 py-3 rounded-xl text-sm font-medium border border-surface-200 dark:border-surface-700
                         text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700
                         flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <Camera size={16} /> ถ่ายรูป
            </button>
            <button type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 py-3 rounded-xl text-sm font-medium border border-surface-200 dark:border-surface-700
                         text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700
                         flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <ImageIcon size={16} /> เลือกรูป
            </button>
          </div>
        )}
      </div>

      {/* Signature Section */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-5">
        <SignaturePad onSave={(dataUrl) => setSignature(dataUrl)} />
        {signature && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle size={14} /> บันทึกลายเซ็นแล้ว
          </p>
        )}
      </div>

      {/* Receiver Info */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700
                       shadow-[var(--shadow-card)] p-5 space-y-3">
        <div>
          <label htmlFor="receiverName" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            👤 ชื่อผู้รับเอกสาร
          </label>
          <input id="receiverName" value={receiverName} onChange={(e) => setReceiverName(e.target.value)}
            placeholder="ชื่อผู้รับจริง (ถ้าต่างจากที่ระบุ)"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                       focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
        </div>
        <div>
          <label htmlFor="pod-notes" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            📝 หมายเหตุ
          </label>
          <textarea id="pod-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                       focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none" />
        </div>
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!signature || isLoading}
        className="w-full py-4 rounded-xl text-sm font-bold text-white
                   bg-gradient-to-r from-emerald-500 to-emerald-600
                   hover:from-emerald-600 hover:to-emerald-700
                   disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-lg shadow-emerald-500/25 hover:shadow-xl
                   flex items-center justify-center gap-2 transition-all cursor-pointer">
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
        ยืนยันส่งเอกสารสำเร็จ
      </button>
    </div>
  );
}
