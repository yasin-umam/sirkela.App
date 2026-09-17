import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: boolean
  /** Pita warna di tepi atas, ala kepala tema di Google Form. */
  accent?: boolean
}

// Kartu Google Form: sudut 8px, garis tipis abu-abu, tanpa bayangan.
export function Card({ children, padding = true, accent = false, className = '', ...props }: CardProps) {
  if (!accent) {
    return (
      <div className={`bg-white rounded-lg border border-garis ${padding ? 'p-5 desktop:p-6' : ''} ${className}`} {...props}>
        {children}
      </div>
    )
  }
  return (
    <div className={`bg-white rounded-lg border border-garis overflow-hidden ${className}`} {...props}>
      <div className="h-2.5 bg-indigo-600" />
      <div className={padding ? 'p-5 desktop:p-6' : ''}>{children}</div>
    </div>
  )
}
