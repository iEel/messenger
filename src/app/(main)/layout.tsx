'use client';

import Sidebar from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/toast';
import { PushSubscribe } from '@/components/push-subscribe';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500 dark:text-surface-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <PushSubscribe />
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
        <Sidebar />
        <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
