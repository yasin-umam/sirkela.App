import type { ReactNode } from 'react'
import { Ikon } from './Ikon'

/**
 * Dialog: LEMBAR yang naik dari bawah di HP, kartu di tengah di layar lebar
 * (`sm:` = 640px). Judul, isi, tombol rata kanan. Satu kerangka untuk konfirmasi,
 * Kirim, dan Impor -- bagian dari layar yang sama, bukan jendela sistem.
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-tinta/55" onClick={onTutup} />
      <div role="dialog" aria-modal
        className={`lembar-masuk relative w-full ${lebar} max-h-[92%] sm:max-h-[calc(100%-2rem)] flex flex-col bg-white rounded-t-[26px] sm:rounded-2xl shadow-xl`}>
        <div aria-hidden className="sm:hidden mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-garis" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 sm:pt-5 pb-2 shrink-0">
          <h2 className="text-xl font-extrabold tracking-tight text-tinta">{judul}</h2>
          {tombolTutup && onTutup && (
            <button type="button" aria-label="Tutup" onClick={onTutup}
              className="-mr-1.5 -mt-1 w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-teks-3 hover:bg-garis-2 hover:text-tinta transition-colors">
              <Ikon nama="tutup" className="w-5 h-5" tebal={2} />
            </button>
          )}
        </div>
        <div className="px-5 pb-3 overflow-y-auto overscroll-contain hide-scrollbar text-sm text-tinta-2 leading-relaxed">{children}</div>
        {aksi && (
          <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-wrap justify-end gap-2 shrink-0">{aksi}</div>
        )}
      </div>
    </div>
  )
}
