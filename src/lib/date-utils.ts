/**
 * Date/Time formatting utilities
 * แก้ปัญหา:
 * 1. th-TH locale แสดงปี พ.ศ. (2569 → "69") → ใช้ en-GB + manual Thai formatting
 * 2. GETDATE() เก็บ local time แต่ mssql driver ส่งมาเป็น UTC → ต้องลบ offset ออก
 */

// ชื่อเดือนย่อภาษาไทย
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_WEEKDAYS = [
  'วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์',
];

/**
 * แปลง date string จาก DB (ที่ถูก interpret เป็น UTC) กลับเป็นเวลาจริง
 * MSSQL GETDATE() เก็บเวลา local (Bangkok) แต่ mssql driver ส่งมาเป็น ISO string ที่ถูกตีความว่าเป็น UTC
 * เราต้อง "แก้" โดยใช้ UTC values ตรงๆ (เพราะมันคือเวลา Bangkok จริงๆ)
 */
function parseDbDate(dateValue: string | Date): Date {
  const d = new Date(dateValue);
  // ใช้ UTC values ตรงๆ เพราะ DB เก็บเป็น local time แต่ driver ตีความว่าเป็น UTC
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds()
  );
}

/**
 * Format: "7 มี.ค. 2026 09:53"
 */
export function formatDateTime(dateValue: string | Date): string {
  const d = parseDbDate(dateValue);
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/**
 * Format short: "7/3/2026 09:53"
 */
export function formatDateTimeShort(dateValue: string | Date): string {
  const d = parseDbDate(dateValue);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format date only: "7 มี.ค. 2026"
 */
export function formatDate(dateValue: string | Date): string {
  const d = parseDbDate(dateValue);
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format full date: "วันศุกร์ 7 มีนาคม 2026"
 */
export function formatDateFull(dateValue: string | Date): string {
  const d = parseDbDate(dateValue);
  const weekday = THAI_WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = THAI_MONTHS_FULL[d.getMonth()];
  const year = d.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
}
