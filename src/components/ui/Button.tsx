'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `bg-gradient-to-r from-primary-600 to-primary-700
            hover:from-primary-700 hover:to-primary-800
            text-white shadow-lg shadow-primary-500/25 hover:shadow-xl`,
  secondary: `bg-white dark:bg-surface-800
              border border-surface-200 dark:border-surface-700
              text-surface-700 dark:text-surface-300
              hover:bg-surface-50 dark:hover:bg-surface-700`,
  danger: `bg-gradient-to-r from-red-500 to-red-600
           hover:from-red-600 hover:to-red-700
           text-white shadow-lg shadow-red-500/25`,
  ghost: `text-surface-600 dark:text-surface-400
          hover:bg-surface-100 dark:hover:bg-surface-700`,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center font-semibold
        transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
