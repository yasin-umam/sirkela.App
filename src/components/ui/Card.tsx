import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: boolean
  /**
   * Kartu hero: gradasi indigo, teks putih. Dipakai untuk satu kartu paling atas
   * sebuah layar (sambutan, sesi yang sedang berjalan) -- tidak pernah dua
   * sekaligus dalam satu layar, kalau tidak ia berhenti berarti "yang ini".
   */
  hero?: boolean
}

// Kartu Luang: sudut 16px, garis slate tipis, bayangan sangat halus.
export function Card({ children, padding = true, hero = false, className = '', ...props }: CardProps) {
  const dasar = hero
    ? 'bg-linear-to-br from-indigo-600 to-indigo-700 border-0 text-white shadow-sm shadow-indigo-200'
    : 'bg-white border border-slate-100 shadow-sm'
  return (
    <div className={`rounded-2xl ${dasar} ${padding ? 'p-4' : ''} ${className}`} {...props}>
      {children}
    </div>
  )
}
