import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: boolean
  /**
   * Kartu hero: tinta navy datar, teks putih. Dipakai untuk satu kartu paling
   * atas sebuah layar (sesi yang sedang berjalan, kepala formulir murid) --
   * tidak pernah dua sekaligus dalam satu layar, kalau tidak ia berhenti berarti
   * "yang ini".
   */
  hero?: boolean
}

// Kartu "Lembar Jawab": kertas putih, sudut 16px, bingkai garis tipis, tanpa bayangan.
export function Card({ children, padding = true, hero = false, className = '', ...props }: CardProps) {
  const dasar = hero ? 'bg-tinta text-white' : 'bg-white border border-garis'
  return (
    <div className={`rounded-2xl ${dasar} ${padding ? 'p-4' : ''} ${className}`} {...props}>
      {children}
    </div>
  )
}
