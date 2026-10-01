import type { ReactNode } from 'react'

export type WarnaBadge = 'biru' | 'hijau' | 'jingga' | 'slate'

const WARNA: Record<WarnaBadge, string> = {
  biru: 'bg-biru-tint text-biru',
  hijau: 'bg-hijau-tint text-hijau',
  jingga: 'bg-jingga-tint text-jingga-gelap',
  slate: 'bg-garis-2 text-tinta-2',
}

const TITIK: Record<WarnaBadge, string> = {
  biru: 'bg-biru',
  hijau: 'bg-hijau',
  jingga: 'bg-jingga-gelap',
  slate: 'bg-tinta-2',
}

/**
 * Label status berbentuk pil. Warna SELALU ditemani kata (dan titik kalau
 * `titik`), tidak pernah warna saja.
 */
export function Badge({ warna = 'slate', titik = false, children }: {
  warna?: WarnaBadge
  /** Titik kecil di depan teks, dipakai untuk status "hidup" (Berjalan). */
  titik?: boolean
  children: ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${WARNA[warna]}`}>
      {titik && <span className={`w-1.5 h-1.5 rounded-full ${TITIK[warna]}`} />}
      {children}
    </span>
  )
}
