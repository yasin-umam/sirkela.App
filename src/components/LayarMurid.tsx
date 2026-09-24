import type { ReactNode } from 'react'

// ─── Kerangka layar murid ────────────────────────────────────────────────────
// Dipakai layar murid (MuridSesiPage, KerjakanSesi) DAN pratinjau guru, supaya
// yang dilihat guru saat menekan ikon mata persis yang nanti dilihat muridnya.
//
// Sebelum 2026-09-22 berkas ini bernama FormulirResponden.tsx dan meniru
// tampilan responden Google Form (kartu persegi, kepala berpita ungu, opsi
// tanpa huruf). Diganti saat aplikasi didesain ulang mengikuti Luang: kartu
// bersudut 16px, kepala hero indigo, dan opsi berlabel A/B/C seperti
// KerjakanSesi di Luang.

/** Huruf opsi. Sengaja KEMBALI setelah era Google Form: guru di kelas
 *  menyebut jawaban dengan huruf ("yang benar B"), dan murid tidak punya cara
 *  lain menyebut opsi ketiga selain membacanya utuh. */
export const HURUF_OPSI = 'ABCDEFGHIJ'

export function HalamanMurid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-full bg-slate-50 tekstur-latar px-4 py-4 desktop:py-6 ${className}`}>
      <div className="max-w-2xl mx-auto flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function KartuKepalaMurid({ judul, deskripsi, children }: {
  judul: string
  deskripsi?: string
  /** Baris bawah kartu (durasi, jumlah soal, keterangan). */
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl bg-linear-to-br from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-200 overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-xl font-bold leading-snug break-words">{judul}</h1>
        {deskripsi?.trim() && (
          <p className="mt-2 text-sm text-indigo-100 whitespace-pre-wrap leading-relaxed">{deskripsi}</p>
        )}
      </div>
      {children && (
        <div className="border-t border-white/15 bg-black/5 px-5 py-3 text-sm text-indigo-100">{children}</div>
      )}
    </div>
  )
}

export function KartuSoalMurid({ nomor, pertanyaan, pilihan, dipilih, onPilih, catatan }: {
  /** Nomor urut yang tampil di pojok kartu. Tanpa ini murid tidak punya cara
   *  menyebut soal mana yang ia tanyakan ke gurunya. */
  nomor?: number
  pertanyaan: string
  pilihan: string[]
  dipilih: number | undefined
  onPilih: (i: number) => void
  /** Teks kecil di bawah opsi, mis. "Menyimpan...". */
  catatan?: ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex gap-2.5">
        {nomor !== undefined && (
          <span className="shrink-0 w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">
            {nomor}
          </span>
        )}
        <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
          {pertanyaan}
        </p>
      </div>
      <div role="radiogroup" className="flex flex-col gap-2">
        {pilihan.map((p, j) => {
          const nyala = dipilih === j
          return (
            <button key={j} type="button" role="radio" aria-checked={nyala} onClick={() => onPilih(j)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                nyala ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 active:bg-slate-50'}`}>
              <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${
                nyala ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-200 text-slate-400'}`}>
                {HURUF_OPSI[j] ?? j + 1}
              </span>
              <span className="text-sm text-slate-700 min-w-0 break-words">{p}</span>
            </button>
          )
        })}
      </div>
      {catatan}
    </div>
  )
}
