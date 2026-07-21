import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function Button({ className, variant = 'primary', size = 'default', type = 'button', ...props }) {
  const variants = {
    primary: 'bg-brand-offwhite text-brand-base hover:bg-opacity-90 active:scale-95 shadow-lg shadow-white/5',
    danger: 'bg-brand-primary text-brand-offwhite hover:bg-opacity-90 active:scale-95 shadow-lg shadow-brand-primary/20',
    outline: 'border-2 border-brand-offwhite/20 bg-transparent text-brand-offwhite hover:bg-brand-offwhite/10 active:scale-95',
    ghost: 'bg-transparent text-brand-offwhite hover:bg-brand-offwhite/10 active:scale-95'
  }
  const sizes = {
    default: 'h-12 px-6 py-2 text-lg',
    sm: 'h-9 px-4 text-sm',
    lg: 'h-14 px-8 text-xl font-bold'
  }

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-offwhite disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}
