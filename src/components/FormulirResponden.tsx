import type { ReactNode } from 'react'

// ─── Tampilan responden ala Google Form ──────────────────────────────────────
// Dipakai layar murid (KerjakanSesi) DAN pratinjau guru, supaya yang dilihat
// guru saat menekan ikon mata persis yang nanti dilihat muridnya.

/** Latar lavender + kolom 640px, lebar kolom formulir responden Google Form. */
export function HalamanResponden({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-full bg-slate-50 px-3 py-3 desktop:py-6 ${className}`}>
      <div className="max-w-160 mx-auto flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function KartuKepalaResponden({ judul, deskripsi, children }: {
  judul: string
  deskripsi?: string
  /** Baris bawah kartu (durasi, jumlah soal, catatan wajib diisi). */
  children?: ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-garis overflow-hidden">
      <div className="h-2.5 bg-indigo-600" />
      <div className="px-5 desktop:px-6 pt-5 pb-5">
        <h1 className="text-[28px] leading-tight text-teks break-words">{judul}</h1>
        {deskripsi?.trim() && <p className="mt-3 text-sm text-teks whitespace-pre-wrap leading-relaxed">{deskripsi}</p>}
      </div>
      {children && <div className="border-t border-garis px-5 desktop:px-6 py-3 text-sm text-teks-2">{children}</div>}
    </div>
  )
}

export function KartuSoalResponden({ pertanyaan, pilihan, dipilih, onPilih, catatan }: {
  pertanyaan: string
  pilihan: string[]
  dipilih: number | undefined
  onPilih: (i: number) => void
  /** Teks kecil di bawah opsi, mis. "Menyimpan...". */
  catatan?: ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-garis p-5 desktop:p-6 flex flex-col gap-3">
      <p className="text-base text-teks whitespace-pre-wrap leading-relaxed break-words">
        {pertanyaan}<span className="text-salah"> *</span>
      </p>
      <div role="radiogroup" className="flex flex-col">
        {pilihan.map((p, j) => {
          const nyala = dipilih === j
          return (
            <button key={j} type="button" role="radio" aria-checked={nyala} onClick={() => onPilih(j)}
              className="flex items-center gap-3 -mx-2 px-2 py-2.5 rounded-md text-left hover:bg-slate-900/3 active:bg-indigo-50 transition-colors">
              <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                nyala ? 'border-indigo-600' : 'border-teks-2'}`}>
                {nyala && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
              </span>
              <span className="text-sm text-teks break-words">{p}</span>
            </button>
          )
        })}
      </div>
      {catatan}
    </div>
  )
}
