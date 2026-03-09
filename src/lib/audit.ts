import { query, getPool } from '@/lib/db';

export type AuditAction =
  | 'task_created'
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_unassigned'
  | 'task_status_changed'
  | 'task_cancelled'
  | 'trip_started'
  | 'trip_ended'
  | 'user_login'
  | 'user_logout'
  | 'user_created'
  | 'user_updated'
  | 'settings_updated'
  | 'pod_uploaded'
  | 'template_created'
  | 'template_updated'
  | 'template_deleted';

interface AuditLogEntry {
  action: AuditAction;
  userId: number;
  targetType?: string;   // 'task' | 'user' | 'trip' | 'settings'
  targetId?: number;
  details?: string;
  ip?: string;
}

/**
 * ★ Log an audit event
 * Auto-creates AuditLog table on first call
 */
export async function logAudit(entry: AuditLogEntry) {
  try {
    const pool = await getPool();

    // Ensure table exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditLog')
      CREATE TABLE AuditLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Action NVARCHAR(50) NOT NULL,
        UserId INT NOT NULL,
        UserName NVARCHAR(100),
        TargetType NVARCHAR(50),
        TargetId INT,
        Details NVARCHAR(MAX),
        IpAddress NVARCHAR(50),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_AuditLog_User FOREIGN KEY (UserId) REFERENCES Users(Id)
      )
    `);

    // Get user name
    const userResult = await query<{ FullName: string }[]>(
      'SELECT FullName FROM Users WHERE Id = @userId',
      { userId: entry.userId }
    );

    await pool.request()
      .input('action', entry.action)
      .input('userId', entry.userId)
      .input('userName', userResult[0]?.FullName || 'Unknown')
      .input('targetType', entry.targetType || null)
      .input('targetId', entry.targetId || null)
      .input('details', entry.details || null)
      .input('ip', entry.ip || null)
      .query(`
        INSERT INTO AuditLog (Action, UserId, UserName, TargetType, TargetId, Details, IpAddress)
        VALUES (@action, @userId, @userName, @targetType, @targetId, @details, @ip)
      `);
  } catch (error) {
    console.error('[Audit] Log error:', error);
    // Audit logging should never break the main flow
  }
}
