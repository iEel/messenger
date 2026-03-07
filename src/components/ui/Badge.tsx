'use client';

import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300',
  success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

export default function Badge({ variant = 'default', icon, children, className = '', pulse = false }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full 
      text-[11px] font-semibold whitespace-nowrap
      ${variantClasses[variant]}
      ${pulse ? 'animate-pulse' : ''}
      ${className}
    `}>
      {icon}
      {children}
    </span>
  );
}
