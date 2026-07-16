import React from 'react'
import { cn } from './Button'

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-12 w-full rounded-xl border border-white/10 bg-brand-base px-4 py-2 text-brand-offwhite ring-offset-brand-base file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-brand-offwhite/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'
