import type { ReactNode } from 'react'

/**
 * Label kecil huruf kapital berhuruf mono di atas sebuah blok ("SEDANG
 * BERJALAN"). Satu tempat supaya jarak huruf & ukurannya seragam di semua layar.
 */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-xs uppercase tracking-[0.14em] text-teks-3 ${className}`}>{children}</p>
  )
}
