import type { ReactNode } from 'react'
import { Gelembung } from './Gelembung'

// ─── Kerangka layar murid ────────────────────────────────────────────────────
// Dipakai layar murid (MuridSesiPage, KerjakanSesi) DAN pratinjau guru, supaya
// yang dilihat guru saat menekan ikon mata persis yang nanti dilihat muridnya.
//
// Desain "Lembar Jawab" (2026-10-01): kepala sesi tinta navy datar, kartu soal
// putih dengan nomor berlabel hitam, dan opsi berupa GELEMBUNG berhuruf yang
// terisi biru saat dipilih -- seperti lembar jawab komputer yang sudah dikenal
// murid. Huruf (A/B/C...) tetap ada karena guru di kelas menyebut jawaban
// dengan huruf ("yang benar B").

export function HalamanMurid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-full bg-alas px-4 py-4 desktop:py-6 ${className}`}>
      <div className="max-w-2xl lg:max-w-195 mx-auto flex flex-col gap-3.5 lg:gap-4">{children}</div>
    </div>
  )
}

export function KartuKepalaMurid({ judul, deskripsi, penanda = 'Sesi kelas', children }: {
  judul: string
  deskripsi?: string
  /** Label mono kecil di atas judul. */
  penanda?: string
  /** Baris bawah kartu (durasi, jumlah soal, keterangan). */
  children?: ReactNode
}) {
  return (
    <div className="rounded-[20px] bg-tinta text-white overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-biru-muda">{penanda}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight leading-tight break-words">{judul}</h1>
        {deskripsi?.trim() && (
          <p className="mt-2 text-[14.5px] text-biru-muda whitespace-pre-wrap leading-relaxed">{deskripsi}</p>
        )}
      </div>
      {children && (
        <div className="border-t border-white/15 px-5 py-3 text-sm text-biru-muda">{children}</div>
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
    <div className="bg-white rounded-[18px] lg:rounded-[20px] border border-garis p-4 lg:px-7 lg:py-6 flex flex-col gap-3.5 lg:gap-4.5">
      <div className="flex gap-3 items-start">
        {nomor !== undefined && (
          <span className="shrink-0 mt-0.5 rounded-lg bg-tinta px-2 py-0.5 font-mono text-[13px] font-medium text-white">
            {String(nomor).padStart(2, '0')}
          </span>
        )}
        <p className="flex-1 min-w-0 text-base lg:text-lg font-semibold text-tinta whitespace-pre-wrap leading-relaxed break-words">
          {pertanyaan}
        </p>
      </div>
      <div role="radiogroup" aria-label="Pilihan jawaban" className="flex flex-col gap-2">
        {pilihan.map((p, j) => {
          const nyala = dipilih === j
          return (
            <button key={j} type="button" role="radio" aria-checked={nyala} onClick={() => onPilih(j)}
              className={`flex items-center gap-3 lg:gap-3.5 w-full min-h-13.5 lg:min-h-14.5 px-3.5 lg:px-4.5 py-2.5 rounded-[14px] border-[1.5px] text-left transition-colors ${
                nyala ? 'bg-biru-tint border-biru' : 'bg-white border-garis active:bg-isian'}`}>
              <Gelembung indeks={j} ukuran="lg" status={nyala ? 'dipilih' : 'kosong'} />
              <span className="flex-1 text-[15px] lg:text-base leading-snug text-tinta min-w-0 break-words">{p}</span>
            </button>
          )
        })}
      </div>
      {catatan}
    </div>
  )
}
