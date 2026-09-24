import type { ReactNode } from 'react'
import { Ikon } from './Ikon'

/**
 * Dialog tengah: judul, isi, tombol rata kanan. Satu kerangka untuk konfirmasi,
 * Kirim, dan Impor. Sudut 16px dan tombol berbentuk pil, sama dengan kartu di
 * belakangnya -- dialog ini bagian dari layar yang sama, bukan jendela sistem.
 *
 * `onTutup` undefined = tidak bisa ditutup dengan mengetuk latar (sedang sibuk).
 */
export function Dialog({ judul, children, aksi, onTutup, lebar = 'max-w-md', tombolTutup = false }: {
  judul: ReactNode
  children: ReactNode
  aksi?: ReactNode
  onTutup?: () => void
  lebar?: string
  /** Ikon X di pojok kanan atas header -- dipakai saat `aksi` tidak punya tombol "Batal" sendiri. */
  tombolTutup?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onTutup} />
      <div role="dialog" aria-modal
        className={`relative w-full ${lebar} max-h-[calc(100%-2rem)] flex flex-col bg-white rounded-2xl shadow-xl`}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{judul}</h2>
          {tombolTutup && onTutup && (
            <button type="button" aria-label="Tutup" onClick={onTutup}
              className="-mr-1.5 -mt-1 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <Ikon nama="tutup" className="w-4.5 h-4.5" tebal={2} />
            </button>
          )}
        </div>
        <div className="px-5 pb-2 overflow-y-auto overscroll-contain hide-scrollbar text-sm text-slate-500 leading-relaxed">{children}</div>
        {aksi && <div className="px-4 py-3 flex flex-wrap justify-end gap-2 shrink-0">{aksi}</div>}
      </div>
    </div>
  )
}
