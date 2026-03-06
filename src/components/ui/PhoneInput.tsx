'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, CheckCircle, AlertCircle, PhoneCall } from 'lucide-react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
}

// ฟอร์แมตเบอร์โทรไทย: 0XX-XXX-XXXX หรือ 02-XXX-XXXX
function formatThaiPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';

  // เบอร์ กทม (02)
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  }

  // เบอร์มือถือ/จังหวัด (0X)
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// ตรวจสอบเบอร์โทรไทย
function validateThaiPhone(digits: string): { valid: boolean; message: string } {
  const d = digits.replace(/\D/g, '');

  if (d.length === 0) return { valid: true, message: '' };

  if (!d.startsWith('0')) {
    return { valid: false, message: 'เบอร์โทรต้องขึ้นต้นด้วย 0' };
  }

  // เบอร์ กทม: 02
  if (d.startsWith('02')) {
    if (d.length < 9) return { valid: false, message: `ยังขาดอีก ${9 - d.length} หลัก (เบอร์ กทม. 9 หลัก)` };
    if (d.length > 9) return { valid: false, message: 'เบอร์ กทม. ต้องมี 9 หลัก' };
    return { valid: true, message: '✓ เบอร์ กทม.' };
  }

  // เบอร์มือถือ: 06, 08, 09
  if (d.startsWith('06') || d.startsWith('08') || d.startsWith('09')) {
    if (d.length < 10) return { valid: false, message: `ยังขาดอีก ${10 - d.length} หลัก` };
    if (d.length > 10) return { valid: false, message: 'เบอร์มือถือต้องมี 10 หลัก' };
    return { valid: true, message: '✓ เบอร์มือถือ' };
  }

  // เบอร์จังหวัดอื่น: 03x, 04x, 05x, 07x
  if (/^0[3-5,7]/.test(d)) {
    if (d.length < 9) return { valid: false, message: `ยังขาดอีก ${9 - d.length} หลัก (เบอร์จังหวัด 9 หลัก)` };
    if (d.length > 9) return { valid: false, message: 'เบอร์จังหวัดต้องมี 9 หลัก' };
    return { valid: true, message: '✓ เบอร์จังหวัด' };
  }

  return { valid: false, message: 'รูปแบบเบอร์ไม่ถูกต้อง' };
}

export default function PhoneInput({ value, onChange, id = 'recipientPhone', name = 'recipientPhone', required = false, placeholder = '08X-XXX-XXXX' }: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; message: string }>({ valid: true, message: '' });
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync incoming value
  useEffect(() => {
    const formatted = formatThaiPhone(value);
    setDisplayValue(formatted);
    setValidation(validateThaiPhone(value));
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    const formatted = formatThaiPhone(digits);
    setDisplayValue(formatted);
    setValidation(validateThaiPhone(digits));
    onChange(digits); // ส่งแค่ตัวเลข
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // อนุญาตเฉพาะ: ตัวเลข, Backspace, Delete, Arrow, Tab, Ctrl+A/C/V
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const digits = value.replace(/\D/g, '');
  const isEmpty = digits.length === 0;
  const isComplete = validation.valid && digits.length >= 9;

  // Border color
  const borderClass = isEmpty
    ? 'border-surface-200 dark:border-surface-700'
    : isComplete
      ? 'border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-900'
      : validation.valid
        ? 'border-amber-300 dark:border-amber-700'
        : 'border-red-400 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-900';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        เบอร์โทรผู้รับ {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {isEmpty ? (
            <Phone size={16} className="text-surface-400" />
          ) : isComplete ? (
            <CheckCircle size={16} className="text-emerald-500" />
          ) : (
            <Phone size={16} className={validation.valid ? 'text-amber-500' : 'text-red-500'} />
          )}
        </div>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={displayValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          placeholder={placeholder}
          maxLength={12} // 0XX-XXX-XXXX = 12 chars
          className={`w-full pl-11 pr-14 py-3 rounded-xl border
                      bg-white dark:bg-surface-800 text-surface-800 dark:text-white text-sm placeholder:text-surface-400
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      transition-all font-mono tracking-wider ${borderClass}`}
        />
        {/* ปุ่มโทรเช็ค */}
        {isComplete && (
          <a href={`tel:${digits}`}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary-500 hover:text-primary-700 transition-colors"
            title="โทรเช็คเบอร์">
            <PhoneCall size={16} />
          </a>
        )}
        {/* Counter */}
        {!isEmpty && !isComplete && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <span className="text-xs font-mono text-surface-400">{digits.length}/{digits.startsWith('02') || /^0[3-5,7]/.test(digits) ? '9' : '10'}</span>
          </div>
        )}
      </div>

      {/* Feedback message */}
      {!isEmpty && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs transition-all
          ${isComplete ? 'text-emerald-600 dark:text-emerald-400' :
            validation.valid ? 'text-amber-600 dark:text-amber-400' :
            'text-red-600 dark:text-red-400'}`}>
          {isComplete ? <CheckCircle size={12} /> : validation.valid ? null : <AlertCircle size={12} />}
          {validation.message}
        </div>
      )}
    </div>
  );
}
