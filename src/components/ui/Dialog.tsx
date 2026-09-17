import type { ReactNode } from 'react'

/**
 * Dialog tengah ala Google: judul, isi, tombol teks rata kanan. Satu kerangka
 * untuk konfirmasi, Kirim, dan Impor.
 *
 * `onTutup` undefined = tidak bisa ditutup dengan mengetuk latar (sedang sibuk).
 */
export function Dialog({ judul, children, aksi, onTutup, lebar = 'max-w-md' }: {
  judul: ReactNode
  children: ReactNode
  aksi?: ReactNode
  onTutup?: () => void
  lebar?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onTutup} />
      <div role="dialog" aria-modal
        className={`relative w-full ${lebar} max-h-[calc(100%-2rem)] flex flex-col bg-white rounded-lg shadow-2xl`}>
        <h2 className="px-6 pt-6 pb-3 text-xl text-teks shrink-0">{judul}</h2>
        <div className="px-6 pb-2 overflow-y-auto overscroll-contain text-sm text-teks-2 leading-relaxed">{children}</div>
        {aksi && <div className="px-4 py-3 flex flex-wrap justify-end gap-2 shrink-0">{aksi}</div>}
      </div>
    </div>
  )
}
