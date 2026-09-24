import type { ReactNode } from 'react'

type WarnaBadge = 'indigo' | 'hijau' | 'kuning' | 'merah' | 'slate'

const WARNA: Record<WarnaBadge, string> = {
  indigo: 'bg-indigo-100 text-indigo-700',
  hijau: 'bg-emerald-100 text-emerald-700',
  kuning: 'bg-amber-100 text-amber-700',
  merah: 'bg-red-100 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function Badge({ warna = 'slate', children }: { warna?: WarnaBadge; children: ReactNode }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${WARNA[warna]}`}>
      {children}
    </span>
  )
}
