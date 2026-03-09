/**
 * Unit Tests — date-utils.ts
 * ทดสอบการ format วันเวลาภาษาไทย + แก้ timezone จาก DB
 */
import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatDateTimeShort,
  formatDate,
  formatDateFull,
} from '../date-utils';

// ============================================================
// ข้อมูลทดสอบ
// DB เก็บ local time (Bangkok) แต่ mssql driver ส่งมาเป็น UTC ISO string
// เช่น เวลาจริง 09:53 Bangkok → DB ส่งมาเป็น "2026-03-07T09:53:00.000Z"
// ============================================================
const DB_DATE_STRING = '2026-03-07T09:53:00.000Z'; // = 7 มี.ค. 2026 09:53 (Bangkok)
const DB_DATE_OBJECT = new Date('2026-03-07T09:53:00.000Z');

describe('formatDateTime', () => {
  it('should format as "7 มี.ค. 2026 09:53"', () => {
    expect(formatDateTime(DB_DATE_STRING)).toBe('7 มี.ค. 2026 09:53');
  });

  it('should accept Date object', () => {
    expect(formatDateTime(DB_DATE_OBJECT)).toBe('7 มี.ค. 2026 09:53');
  });

  it('should use ค.ศ. (not พ.ศ.)', () => {
    const result = formatDateTime(DB_DATE_STRING);
    expect(result).toContain('2026');
    expect(result).not.toContain('2569'); // พ.ศ. = 2026 + 543
  });

  it('should pad hours/minutes with leading zeros', () => {
    // 05:03 → should be "05:03" not "5:3"
    const result = formatDateTime('2026-01-15T05:03:00.000Z');
    expect(result).toContain('05:03');
  });
});

describe('formatDateTimeShort', () => {
  it('should format as "7/3/2026 09:53"', () => {
    expect(formatDateTimeShort(DB_DATE_STRING)).toBe('7/3/2026 09:53');
  });

  it('should not pad day/month', () => {
    // 7 มีนา ไม่ใช่ 07/03
    const result = formatDateTimeShort(DB_DATE_STRING);
    expect(result).toMatch(/^7\/3\//);
  });
});

describe('formatDate', () => {
  it('should format as "7 มี.ค. 2026"', () => {
    expect(formatDate(DB_DATE_STRING)).toBe('7 มี.ค. 2026');
  });

  it('should not include time', () => {
    const result = formatDate(DB_DATE_STRING);
    expect(result).not.toContain(':');
  });
});

describe('formatDateFull', () => {
  it('should include Thai weekday', () => {
    // 7 มีนาคม 2026 = วันเสาร์
    expect(formatDateFull(DB_DATE_STRING)).toBe('วันเสาร์ 7 มีนาคม 2026');
  });

  it('should use full month name', () => {
    const result = formatDateFull(DB_DATE_STRING);
    expect(result).toContain('มีนาคม');
    expect(result).not.toContain('มี.ค.');
  });
});

describe('All 12 months', () => {
  const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];

  THAI_MONTHS_SHORT.forEach((thaiMonth, index) => {
    it(`should display "${thaiMonth}" for month ${index + 1}`, () => {
      const month = String(index + 1).padStart(2, '0');
      const dateStr = `2026-${month}-15T10:00:00.000Z`;
      const result = formatDate(dateStr);
      expect(result).toContain(thaiMonth);
    });
  });
});

describe('Edge cases', () => {
  it('should handle midnight (00:00)', () => {
    const result = formatDateTime('2026-06-01T00:00:00.000Z');
    expect(result).toContain('00:00');
  });

  it('should handle last minute of day (23:59)', () => {
    const result = formatDateTime('2026-06-01T23:59:00.000Z');
    expect(result).toContain('23:59');
  });

  it('should handle Jan 1st', () => {
    const result = formatDate('2026-01-01T00:00:00.000Z');
    expect(result).toBe('1 ม.ค. 2026');
  });

  it('should handle Dec 31st', () => {
    const result = formatDate('2026-12-31T23:59:00.000Z');
    expect(result).toBe('31 ธ.ค. 2026');
  });
});
