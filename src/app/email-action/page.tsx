'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle, XCircle, Loader2, AlertTriangle, CalendarClock, PackageCheck } from 'lucide-react';

function EmailActionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [task, setTask] = useState<{ TaskNumber: string; DocumentDesc: string; RecipientName: string; Status: string } | null>(null);
  const [action, setAction] = useState<string>('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('ลิงก์ไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    // ดึงข้อมูล task (ไม่ confirm)
    fetch('/api/email-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, confirm: false }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setTask(data.task);
          setAction(data.action);
        }
      })
      .catch(() => setError('ไม่สามารถเชื่อมต่อระบบได้'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch('/api/email-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, confirm: true }),
      });
      const data = await res.json();
      if (data.error) {
        setResult({ success: false, message: data.error });
      } else {
        setResult({ success: true, message: data.message });
      }
    } catch {
      setResult({ success: false, message: 'เกิดข้อผิดพลาดในการดำเนินการ' });
    } finally {
      setConfirming(false);
    }
  };

  const actionLabels: Record<string, { label: string; desc: string; color: string; icon: React.ReactNode }> = {
    cancel: { label: 'นำเอกสารมาคืน', desc: 'แมสเซ็นเจอร์จะนำเอกสารกลับมาที่ออฟฟิศ', color: '#ef4444', icon: <PackageCheck size={24} /> },
    reschedule: { label: 'เลื่อนวันส่งใหม่', desc: 'ใบงานจะกลับเป็นสถานะรอจ่ายงาน เพื่อจ่ายงานให้แมสเซ็นเจอร์อีกครั้ง', color: '#f59e0b', icon: <CalendarClock size={24} /> },
  };

  const actionConf = actionLabels[action] || { label: action, desc: '', color: '#6366f1', icon: <AlertTriangle size={24} /> };

  // แสดงผลลัพธ์
  if (result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 32, background: 'white', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {result.success ? (
            <CheckCircle size={56} color="#22c55e" style={{ margin: '0 auto 16px' }} />
          ) : (
            <XCircle size={56} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          )}
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: result.success ? '#16a34a' : '#dc2626' }}>
            {result.success ? 'ดำเนินการสำเร็จ' : 'ไม่สำเร็จ'}
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{result.message}</p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Loader2 size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 32, background: 'white', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <XCircle size={56} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>ไม่สามารถดำเนินการได้</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  // หน้ายืนยัน
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 440, width: '100%', padding: 32, background: 'white', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', margin: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${actionConf.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: actionConf.color }}>
            {actionConf.icon}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>ยืนยัน: {actionConf.label}</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{actionConf.desc}</p>
        </div>

        {task && (
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 24, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', fontSize: 14 }}>
              <tbody>
                <tr><td style={{ padding: '4px 0', color: '#6b7280' }}>ใบงาน:</td><td style={{ fontWeight: 600 }}>{task.TaskNumber}</td></tr>
                <tr><td style={{ padding: '4px 0', color: '#6b7280' }}>เอกสาร:</td><td>{task.DocumentDesc}</td></tr>
                <tr><td style={{ padding: '4px 0', color: '#6b7280' }}>ผู้รับ:</td><td>{task.RecipientName}</td></tr>
                <tr><td style={{ padding: '4px 0', color: '#6b7280' }}>สถานะ:</td><td>{task.Status}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            width: '100%', padding: '14px 0', border: 'none', borderRadius: 12, cursor: confirming ? 'wait' : 'pointer',
            background: actionConf.color, color: 'white', fontSize: 15, fontWeight: 700,
            opacity: confirming ? 0.6 : 1, transition: 'opacity 0.2s',
          }}
        >
          {confirming ? 'กำลังดำเนินการ...' : `✓ ยืนยัน${actionConf.label}`}
        </button>

        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#cbd5e1' }}>
          ลิงก์นี้มีอายุ 72 ชั่วโมง • เข้ารหัส HMAC-SHA256
        </p>
      </div>
    </div>
  );
}

export default function EmailActionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Loader2 size={32} color="#6366f1" />
      </div>
    }>
      <EmailActionContent />
    </Suspense>
  );
}
