import React from 'react'
import { cn } from './Button'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'w-full px-4',
        className
      )}
      {...props}
    />
  )
}
