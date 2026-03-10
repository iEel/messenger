import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from './db';
import type { User } from './types';
import { logAudit } from './audit';
import { ldapAuthenticate } from './ldap';
import { getPool } from './db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      employeeId: string;
      fullName: string;
      email: string;
      role: string;
      department: string | null;
    };
  }
  interface User {
    employeeId: string;
    fullName: string;
    role: string;
    department: string | null;
  }
}

declare module 'next-auth' {
  interface JWT {
    id: string;
    employeeId: string;
    fullName: string;
    role: string;
    department: string | null;
  }
}

// ★ In-memory cache สำหรับเช็ค IsActive (ไม่ต้อง query DB ทุก request)
const activeCache = new Map<string, { active: boolean; checkedAt: number }>();
const ACTIVE_CHECK_INTERVAL = 5 * 60 * 1000; // เช็คทุก 5 นาที

async function isUserActive(userId: string): Promise<boolean> {
  const cached = activeCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < ACTIVE_CHECK_INTERVAL) {
    return cached.active;
  }

  try {
    const rows = await query<{ IsActive: boolean }[]>(
      'SELECT IsActive FROM Users WHERE Id = @id',
      { id: parseInt(userId) }
    );
    const active = rows.length > 0 && rows[0].IsActive;
    activeCache.set(userId, { active, checkedAt: Date.now() });
    return active;
  } catch {
    // ถ้า query ไม่ได้ ให้ใช้ค่า cache เดิม หรือ default true (ไม่ block user)
    return cached?.active ?? true;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        employeeId: { label: 'รหัสพนักงาน', type: 'text' },
        password: { label: 'รหัสผ่าน', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.employeeId || !credentials?.password) {
          return null;
        }

        const username = (credentials.employeeId as string).trim();
        const password = credentials.password as string;

        // ★ Auto-add AdUsername column if not exists
        try {
          const pool = await getPool();
          await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'AdUsername')
            ALTER TABLE Users ADD AdUsername NVARCHAR(100) NULL
          `);
        } catch { /* ignore */ }

        // ★ STEP 1: ลอง Local User ก่อน (ค้นหาทั้ง EmployeeId และ AdUsername)
        const users = await query<User[]>(
          'SELECT * FROM Users WHERE (EmployeeId = @username OR AdUsername = @username) AND IsActive = 1',
          { username }
        );

        if (users && users.length > 0) {
          const user = users[0];

          // ถ้าเป็น local user (มี PasswordHash) → bcrypt compare
          if (user.PasswordHash) {
            const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
            if (isPasswordValid) {
              // อัปเดต LastLoginAt
              await query('UPDATE Users SET LastLoginAt = GETDATE() WHERE Id = @id', { id: user.Id });
              logAudit({ action: 'user_login', userId: user.Id, details: `${user.FullName} (${user.EmployeeId}) เข้าสู่ระบบ (Local)` });

              return {
                id: String(user.Id),
                employeeId: user.EmployeeId,
                fullName: user.FullName,
                email: user.Email || '',
                role: user.Role,
                department: user.Department,
              };
            }
          }

          // ★ ถ้า local password ไม่ตรง → ลอง LDAP (user อาจเป็น AD user ที่มีอยู่ใน DB แล้ว)
          const ldapUser = await ldapAuthenticate(username, password);
          if (ldapUser) {
            // อัปเดตข้อมูลจาก AD
            await query(
              `UPDATE Users SET 
                FullName = @fullName, Email = @email, Department = @department,
                AdUsername = @adUsername,
                LastLoginAt = GETDATE(), UpdatedAt = GETDATE()
               WHERE Id = @id`,
              { id: user.Id, fullName: ldapUser.cn, email: ldapUser.mail, department: ldapUser.department, adUsername: username }
            );
            logAudit({ action: 'user_login', userId: user.Id, details: `${ldapUser.cn} (AD) เข้าสู่ระบบ` });

            return {
              id: String(user.Id),
              employeeId: user.EmployeeId,
              fullName: ldapUser.cn,
              email: ldapUser.mail || user.Email || '',
              role: user.Role,  // ใช้ role ที่ admin กำหนดไว้ใน DB
              department: ldapUser.department || user.Department,
            };
          }

          return null; // ทั้ง local + LDAP ไม่ผ่าน
        }

        // ★ STEP 2: ไม่เจอใน DB (by username) → ลอง LDAP
        const ldapUser = await ldapAuthenticate(username, password);
        if (ldapUser) {
          // เช็คว่า EmployeeId จาก AD หรือ AdUsername มีอยู่ใน DB แล้วหรือไม่
          const existingByEmpId = await query<User[]>(
            'SELECT * FROM Users WHERE (EmployeeId = @empId OR AdUsername = @username) AND IsActive = 1',
            { empId: ldapUser.employeeID, username }
          );

          if (existingByEmpId.length > 0) {
            // ★ มี user อยู่แล้ว (อาจเคย auto-create มาก่อน) → อัปเดตข้อมูล + login
            const existing = existingByEmpId[0];
            await query(
              `UPDATE Users SET 
                FullName = @fullName, Email = @email, Department = @department,
                AdUsername = @adUsername,
                LastLoginAt = GETDATE(), UpdatedAt = GETDATE()
               WHERE Id = @id`,
              { id: existing.Id, fullName: ldapUser.cn, email: ldapUser.mail, department: ldapUser.department, adUsername: username }
            );
            logAudit({ action: 'user_login', userId: existing.Id, details: `${ldapUser.cn} (AD) เข้าสู่ระบบ` });

            return {
              id: String(existing.Id),
              employeeId: existing.EmployeeId,
              fullName: ldapUser.cn,
              email: ldapUser.mail || existing.Email || '',
              role: existing.Role,
              department: ldapUser.department || existing.Department,
            };
          }

          // ★ ไม่มีเลย → สร้าง user ใหม่ (role = requester / พนักงาน)
          const result = await query<{ Id: number }[]>(
            `INSERT INTO Users (EmployeeId, FullName, Email, Phone, PasswordHash, Role, Department, IsActive, AdUsername)
             OUTPUT INSERTED.Id
             VALUES (@employeeId, @fullName, @email, NULL, @passwordHash, 'requester', @department, 1, @adUsername)`,
            {
              employeeId: ldapUser.employeeID || username,
              fullName: ldapUser.cn,
              email: ldapUser.mail || '',
              passwordHash: 'AD_USER_NO_LOCAL_PASSWORD',
              department: ldapUser.department || null,
              adUsername: username,
            }
          );

          const newUserId = result[0]?.Id;
          if (newUserId) {
            logAudit({ action: 'user_login', userId: newUserId, details: `${ldapUser.cn} (AD ครั้งแรก) เข้าสู่ระบบ — auto-create` });

            return {
              id: String(newUserId),
              employeeId: ldapUser.employeeID || username,
              fullName: ldapUser.cn,
              email: ldapUser.mail || '',
              role: 'requester',
              department: ldapUser.department || null,
            };
          }
        }

        return null; // ไม่มีทางเข้าได้
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.employeeId = user.employeeId;
        token.fullName = user.fullName;
        token.role = user.role;
        token.department = user.department;
        token.lastChecked = Date.now();
      }

      // ★ เช็ค IsActive ทุก 5 นาที — ถ้า admin disable → force logout
      if (token.id) {
        const lastChecked = (token.lastChecked as number) || 0;
        if (Date.now() - lastChecked > ACTIVE_CHECK_INTERVAL) {
          const active = await isUserActive(token.id as string);
          if (!active) {
            console.log(`[Auth] User ${token.id} disabled — forcing logout`);
            return {} as typeof token; // empty token → redirect to login
          }
          token.lastChecked = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        // ★ token ถูก clear (user disabled) → session ว่าง
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      session.user.id = token.id as string;
      session.user.employeeId = token.employeeId as string;
      session.user.fullName = token.fullName as string;
      session.user.role = token.role as string;
      session.user.department = token.department as string | null;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});
