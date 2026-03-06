import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from './db';
import type { User } from './types';

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

export const { handlers, signIn, signOut, auth } = NextAuth({
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

        const users = await query<User[]>(
          'SELECT * FROM Users WHERE EmployeeId = @employeeId AND IsActive = 1',
          { employeeId: credentials.employeeId }
        );

        if (!users || users.length === 0) {
          return null;
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.PasswordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // อัปเดต LastLoginAt
        await query(
          'UPDATE Users SET LastLoginAt = GETDATE() WHERE Id = @id',
          { id: user.Id }
        );

        return {
          id: String(user.Id),
          employeeId: user.EmployeeId,
          fullName: user.FullName,
          email: user.Email || '',
          role: user.Role,
          department: user.Department,
        };
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
      }
      return token;
    },
    async session({ session, token }) {
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
