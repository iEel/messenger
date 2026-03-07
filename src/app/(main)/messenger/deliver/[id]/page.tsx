'use client';

import { useState, useRef, useEffect } from 'react';
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
  ArrowRightLeft,
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
  const [taskType, setTaskType] = useState<string>('oneway');
  const [isRoundtrip, setIsRoundtrip] = useState(false);
  const [isReturning, setIsReturning] = useState(false); // ★ โหมดคืนเอกสาร (ถ่ายรูปเช็ค)
  const [uploadProgress, setUploadProgress] = useState('');

  // Fetch task info to check if roundtrip
  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then(r => r.json())
      .then(data => {
        if (data.task) {
          setTaskType(data.task.TaskType);
          setIsRoundtrip(data.task.TaskType === 'roundtrip');
          // ★ ตรวจสถานะ returning → โหมดถ่ายรูปเช็ค
          if (data.task.Status === 'returning') {
            setIsReturning(true);
          }
        }
      })
      .catch(console.error);
  }, [taskId]);

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

  // Helper: upload a single file
  const uploadFile = async (file: File | Blob, type: 'photo' | 'signature', fileName?: string) => {
    const formData = new FormData();
    if (file instanceof Blob && !(file instanceof File)) {
      formData.append('file', file, fileName || 'signature.png');
    } else {
      formData.append('file', file);
    }
    formData.append('taskId', taskId);
    formData.append('type', type);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    return res.json();
  };

  // Convert base64 data URL to Blob
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    return new Blob([uint8Array], { type: mime });
  };

  const handleSubmit = async () => {
    // ★ โหมดคืนเอกสาร: ต้องถ่ายรูปแต่ไม่ต้องเซ็นชื่อ
    if (!isReturning && !signature) {
      alert('กรุณาให้ผู้รับเซ็นชื่อ');
      return;
    }
    if (isReturning && photos.length === 0) {
      alert('กรุณาถ่ายรูปเอกสาร/เช็คที่รับกลับมา');
      return;
    }

    setIsLoading(true);
    try {
      // 1. อัปโหลดรูปถ่าย
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(`อัปโหลดรูปที่ ${i + 1}/${photos.length}...`);
        await uploadFile(photos[i].file, 'photo');
      }

      // 2. อัปโหลดลายเซ็น (ถ้ามี — โหมดคืนเอกสารไม่ต้อง)
      if (signature) {
        setUploadProgress('บันทึกลายเซ็น...');
        const signatureBlob = dataUrlToBlob(signature);
        await uploadFile(signatureBlob, 'signature', 'signature.png');
      }

      // 3. อัปเดตสถานะ
      setUploadProgress('อัปเดตสถานะ...');
      const podNotes = isReturning
        ? [
            `คืนเอกสาร/เช็ค: ${photos.length} รูป`,
            notes ? `หมายเหตุ: ${notes}` : '',
          ].filter(Boolean).join(' | ')
        : [
            `ผู้รับ: ${receiverName || '-'}`,
            `รูปถ่าย: ${photos.length} รูป`,
            notes ? `หมายเหตุ: ${notes}` : '',
          ].filter(Boolean).join(' | ');

      // ★ returning → returned (คืนเอกสาร)
      // ★ roundtrip in_transit → return_picked_up (รอรับเอกสารกลับ)
      // ★ oneway in_transit → completed
      const nextStatus = isReturning ? 'returned' : (isRoundtrip ? 'return_picked_up' : 'completed');

      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          notes: podNotes + (isReturning ? ' | 📦 คืนเอกสารแล้ว' : isRoundtrip ? ' | 🔄 รอรับเอกสารกลับ' : ''),
        }),
      });

      setSuccess(true);
      setTimeout(() => router.push('/messenger'), 2500);
    } catch (err) {
      console.error('Submit error:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลด กรุณาลองใหม่');
    } finally {
      setIsLoading(false);
      setUploadProgress('');
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

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-primary-600 dark:text-primary-400 animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          {uploadProgress}
        </div>
      )}

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
