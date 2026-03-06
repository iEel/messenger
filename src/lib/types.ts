// ประเภทข้อมูลหลักของระบบ

export type UserRole = 'requester' | 'dispatcher' | 'messenger' | 'admin';

export type TaskType = 'oneway' | 'roundtrip';

export type TaskStatus =
  | 'new'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'completed'
  | 'issue'
  | 'return_picked_up'
  | 'returning'
  | 'returned'
  | 'rescheduled';

export type IssueProblemType = 
  | 'contact_failed' 
  | 'office_closed' 
  | 'wrong_address' 
  | 'other';

export type IssueResolution = 'return' | 'reschedule';

export interface User {
  Id: number;
  EmployeeId: string;
  FullName: string;
  Email: string | null;
  Phone: string | null;
  PasswordHash: string;
  Role: UserRole;
  Department: string | null;
  IsActive: boolean;
  AvatarUrl: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  LastLoginAt: string | null;
}

export interface Task {
  Id: number;
  TaskNumber: string;
  RequesterId: number;
  AssignedTo: number | null;
  RecipientName: string;
  RecipientPhone: string | null;
  RecipientCompany: string | null;
  TaskType: TaskType;
  DocumentDesc: string;
  Notes: string | null;
  Address: string;
  District: string | null;
  SubDistrict: string | null;
  Province: string | null;
  PostalCode: string | null;
  Latitude: number | null;
  Longitude: number | null;
  GoogleMapsUrl: string | null;
  Status: TaskStatus;
  Priority: string;
  ScheduledDate: string | null;
  CompletedAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TaskStatusHistoryEntry {
  Id: number;
  TaskId: number;
  Status: TaskStatus;
  ChangedBy: number;
  Notes: string | null;
  Latitude: number | null;
  Longitude: number | null;
  CreatedAt: string;
}

export interface Trip {
  Id: number;
  MessengerId: number;
  StartTime: string;
  EndTime: string | null;
  TotalDistanceKm: number | null;
  Status: string;
  Notes: string | null;
  CreatedAt: string;
}

// สถานะและการแสดงผล
export const STATUS_CONFIG: Record<TaskStatus, { label: string; labelTh: string; color: string; bgColor: string; icon: string }> = {
  new:              { label: 'New',              labelTh: 'รอจ่ายงาน',          color: '#EAB308', bgColor: '#FEF9C3', icon: '📋' },
  assigned:         { label: 'Assigned',         labelTh: 'จ่ายงานแล้ว',         color: '#F97316', bgColor: '#FED7AA', icon: '👤' },
  picked_up:        { label: 'Picked Up',        labelTh: 'รับเอกสารแล้ว',       color: '#8B5CF6', bgColor: '#EDE9FE', icon: '📦' },
  in_transit:       { label: 'In Transit',       labelTh: 'กำลังจัดส่ง',         color: '#3B82F6', bgColor: '#DBEAFE', icon: '🏍️' },
  completed:        { label: 'Completed',        labelTh: 'สำเร็จ',             color: '#22C55E', bgColor: '#DCFCE7', icon: '✅' },
  issue:            { label: 'Issue',            labelTh: 'มีปัญหา',            color: '#EF4444', bgColor: '#FEE2E2', icon: '🔴' },
  return_picked_up: { label: 'Return Picked Up', labelTh: 'รับเช็คกลับแล้ว',     color: '#06B6D4', bgColor: '#CFFAFE', icon: '📥' },
  returning:        { label: 'Returning',        labelTh: 'กำลังนำกลับ',         color: '#6366F1', bgColor: '#E0E7FF', icon: '🔄' },
  returned:         { label: 'Returned',         labelTh: 'คืนเอกสารสำเร็จ',     color: '#10B981', bgColor: '#D1FAE5', icon: '✅' },
  rescheduled:      { label: 'Rescheduled',      labelTh: 'เลื่อนวันส่ง',         color: '#F59E0B', bgColor: '#FEF3C7', icon: '📅' },
};

export const ROLE_CONFIG: Record<UserRole, { label: string; labelTh: string; color: string; bgColor: string }> = {
  requester:  { label: 'Requester',  labelTh: 'พนักงาน',      color: '#3B82F6', bgColor: '#DBEAFE' },
  dispatcher: { label: 'Dispatcher', labelTh: 'หัวหน้าแมส',   color: '#8B5CF6', bgColor: '#EDE9FE' },
  messenger:  { label: 'Messenger',  labelTh: 'แมสเซ็นเจอร์', color: '#F97316', bgColor: '#FED7AA' },
  admin:      { label: 'Admin',      labelTh: 'ผู้ดูแลระบบ',  color: '#EF4444', bgColor: '#FEE2E2' },
};
