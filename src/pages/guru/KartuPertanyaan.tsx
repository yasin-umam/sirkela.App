import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import type { IsiSoal, Soal } from '../../types'
import { useKembali } from '../../context/NavContext'
import { MAKS_PILIHAN, masalahSoal } from '../../lib/soal'
import { HURUF_OPSI } from '../../components/LayarMurid'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { TeksOtomatis } from '../../components/ui/TeksOtomatis'
import { Button } from '../../components/ui/Button'

// ─── Satu kartu pertanyaan di editor ─────────────────────────────────────────
// Tiga wujud:
//   diam    -- ringkas; ketuk untuk menyunting
//   sunting -- cincin indigo, kolom pertanyaan & opsi bisa diketik
//   kunci   -- "Kunci jawaban": ketuk opsi yang benar, lalu Selesai
//
// Kunci SENGAJA dipilih di mode terpisah, bukan dengan mengetuk lingkaran opsi
// saat menyunting: lingkaran itu di mode sunting cuma penanda huruf, dan guru
// tidak boleh diam-diam mengganti kunci waktu bermaksud memperbaiki ketikan.
//
// Huruf A/B/C di lingkarannya sama dengan yang dilihat murid (HURUF_OPSI di
// LayarMurid) -- guru yang menandai kunci "B" melihat B yang sama.

function kapital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Lingkaran huruf opsi. Satu bentuk untuk ketiga wujud kartu. */
function Huruf({ i, warna = 'bg-slate-100 text-slate-400 border-slate-200' }: { i: number; warna?: string }) {
  return (
    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${warna}`}>
      {HURUF_OPSI[i] ?? i + 1}
    </span>
  )
}

export function KartuPertanyaan({
  soal, nomor, aktif, gulir, tandaiMasalah, bisaNaik, bisaTurun,
  onAktifkan, onGulirSelesai, onUbah, onDuplikat, onHapus, onNaik, onTurun,
}: {
  soal: Soal
  /** Nomor urut di formulir. Sama dengan nomor yang disebut server saat menolak. */
  nomor?: number
  aktif: boolean
  /** 'fokus' = soal baru: gulir ke sana & taruh kursor di pertanyaan. 'lihat' = gulir saja. */
  gulir: 'fokus' | 'lihat' | null
  /** true setelah Kirim ditolak: masalah ditandai merah, bukan kuning. */
  tandaiMasalah: boolean
  bisaNaik: boolean
  bisaTurun: boolean
  onAktifkan: () => void
  onGulirSelesai: () => void
  onUbah: (ubahan: Partial<IsiSoal>) => void
  onDuplikat: () => void
  onHapus: () => void
  onNaik: () => void
  onTurun: () => void
}) {
  const kartuRef = useRef<HTMLDivElement>(null)
  const pertanyaanRef = useRef<HTMLTextAreaElement>(null)
  const opsiRefs = useRef<(HTMLInputElement | null)[]>([])
  const [modeKunci, setModeKunci] = useState(false)
  const [fokusOpsi, setFokusOpsi] = useState<number | null>(null)

  const masalah = masalahSoal(soal)
  const { pilihan, jawabanBenar } = soal

  useEffect(() => { if (!aktif) setModeKunci(false) }, [aktif])

  useEffect(() => {
    if (!gulir) return
    kartuRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (gulir === 'fokus') pertanyaanRef.current?.focus({ preventScroll: true })
    onGulirSelesai()
  }, [gulir, onGulirSelesai])

  // Opsi baru langsung terseleksi: mengetik menimpa "Opsi 3".
  useEffect(() => {
    if (fokusOpsi === null) return
    const el = opsiRefs.current[fokusOpsi]
    el?.focus()
    el?.select()
    setFokusOpsi(null)
  }, [fokusOpsi, pilihan.length])

  useKembali(() => {
    if (!modeKunci) return false
    setModeKunci(false)
    return true
  }, aktif)

  function ubahOpsi(i: number, teks: string) {
    const p = [...pilihan]
    p[i] = teks
    onUbah({ pilihan: p })
  }

  function sisipkanOpsi(setelah: number, teks: string[]) {
    const ruang = MAKS_PILIHAN - pilihan.length
    if (ruang <= 0) return
    const masuk = teks.slice(0, ruang)
    const p = [...pilihan]
    p.splice(setelah + 1, 0, ...masuk)
    // Kunci ikut bergeser kalau opsi disisipkan DI ATAS-nya.
    const kunci = jawabanBenar !== null && jawabanBenar > setelah ? jawabanBenar + masuk.length : jawabanBenar
    onUbah({ pilihan: p, jawabanBenar: kunci })
    setFokusOpsi(setelah + masuk.length)
  }

  function hapusOpsi(i: number) {
    if (pilihan.length <= 1) return
    let kunci = jawabanBenar
    if (kunci !== null) {
      if (kunci === i) kunci = null
      else if (kunci > i) kunci -= 1
    }
    onUbah({ pilihan: pilihan.filter((_, j) => j !== i), jawabanBenar: kunci })
  }

  function tombolOpsi(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      sisipkanOpsi(i, [`Opsi ${pilihan.length + 1}`])
    } else if (e.key === 'Backspace' && pilihan[i] === '' && pilihan.length > 1) {
      e.preventDefault()
      hapusOpsi(i)
      setFokusOpsi(Math.max(0, i - 1))
    }
  }

  // Menempel beberapa baris (disalin dari dokumen soal) = beberapa opsi sekaligus.
  function tempelOpsi(e: ClipboardEvent<HTMLInputElement>, i: number) {
    const baris = e.clipboardData.getData('text').split(/\r?\n/).map(b => b.trim()).filter(Boolean)
    if (baris.length < 2) return
    e.preventDefault()
    const p = [...pilihan]
    p[i] = baris[0]
    onUbah({ pilihan: p })
    sisipkanOpsi(i, baris.slice(1))
  }

  const catatanMasalah = masalah && (
    <p className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${tandaiMasalah ? 'text-red-600' : 'text-amber-600'}`}>
      <Ikon nama="galat" className="w-4 h-4" />{kapital(masalah)}
    </p>
  )

  const lencanaNomor = nomor !== undefined && (
    <span className="shrink-0 w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">
      {nomor}
    </span>
  )

  // ── Diam ──
  if (!aktif) {
    return (
      <div ref={kartuRef} onClick={onAktifkan} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onAktifkan() }}
        className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition-colors active:bg-slate-50 ${
          tandaiMasalah && masalah ? 'border-red-300' : 'border-slate-100'}`}>
        <div className="flex gap-2.5">
          {lencanaNomor}
          <p className={`flex-1 min-w-0 text-sm font-medium whitespace-pre-wrap break-words ${
            soal.pertanyaan.trim() ? 'text-slate-800' : 'text-slate-400'}`}>
            {soal.pertanyaan.trim() || 'Pertanyaan'}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {pilihan.map((p, j) => {
            const kunci = j === jawabanBenar
            return (
              <div key={j} className="flex items-center gap-2.5">
                <Huruf i={j} warna={kunci ? 'bg-emerald-500 border-emerald-500 text-white' : undefined} />
                <span className={`flex-1 min-w-0 text-sm break-words ${
                  !p.trim() ? 'text-slate-300 italic' : kunci ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>
                  {p.trim() || 'Opsi kosong'}
                </span>
              </div>
            )
          })}
        </div>
        {catatanMasalah}
      </div>
    )
  }

  // ── Kunci jawaban ──
  if (modeKunci) {
    return (
      <div ref={kartuRef} className="bg-white rounded-2xl border border-indigo-300 ring-2 ring-indigo-100 shadow-sm overflow-hidden">
        <div className="p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Ikon nama="kunciJawaban" className="w-4.5 h-4.5 text-indigo-500" />Pilih jawaban yang benar
          </p>
          <div className="mt-3 flex gap-2.5">
            {lencanaNomor}
            <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 whitespace-pre-wrap break-words">
              {soal.pertanyaan.trim() || 'Pertanyaan'}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {pilihan.map((p, j) => {
              const benar = j === jawabanBenar
              return (
                <button key={j} type="button" onClick={() => onUbah({ jawabanBenar: benar ? null : j })}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    benar ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200 active:bg-slate-50'}`}>
                  <Huruf i={j} warna={benar ? 'bg-emerald-500 border-emerald-500 text-white' : undefined} />
                  <span className={`flex-1 min-w-0 text-sm break-words ${
                    benar ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`}>
                    {p.trim() || 'Opsi kosong'}
                  </span>
                  {benar && <Ikon nama="centang" className="w-4 h-4 text-emerald-600" tebal={2.4} />}
                </button>
              )
            })}
          </div>
        </div>
        <div className="border-t border-slate-100 flex justify-end px-3 py-2">
          <Button size="sm" onClick={() => setModeKunci(false)}>Selesai</Button>
        </div>
      </div>
    )
  }

  // ── Sunting ──
  return (
    <div ref={kartuRef} className="bg-white rounded-2xl border border-indigo-300 ring-2 ring-indigo-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex gap-2.5">
          {lencanaNomor}
          <TeksOtomatis ref={pertanyaanRef} value={soal.pertanyaan} placeholder="Tulis pertanyaan"
            onChange={e => onUbah({ pertanyaan: e.target.value })}
            className="flex-1 min-w-0 resize-none bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal outline-none border border-slate-200 focus:border-indigo-400 focus:bg-white transition-colors" />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {pilihan.map((p, j) => (
            <div key={j} className="flex items-center gap-2.5 pl-0.5">
              <Huruf i={j} warna={j === jawabanBenar ? 'bg-emerald-500 border-emerald-500 text-white' : undefined} />
              <input ref={el => { opsiRefs.current[j] = el }} value={p} placeholder={`Opsi ${j + 1}`}
                aria-label={`Opsi ${j + 1}`}
                onChange={e => ubahOpsi(j, e.target.value)}
                onKeyDown={e => tombolOpsi(e, j)}
                onPaste={e => tempelOpsi(e, j)}
                className="flex-1 min-w-0 px-3 py-2 text-sm text-slate-700 bg-white rounded-xl border border-slate-200 outline-none focus:border-indigo-400 transition-colors" />
              {pilihan.length > 1 && (
                <TombolIkon nama="tutup" label={`Hapus opsi ${j + 1}`} onClick={() => hapusOpsi(j)}
                  ukuran="w-4 h-4" className="w-8 h-8 shrink-0" />
              )}
            </div>
          ))}
          {pilihan.length < MAKS_PILIHAN && (
            <button type="button" onClick={() => sisipkanOpsi(pilihan.length - 1, [`Opsi ${pilihan.length + 1}`])}
              className="self-start inline-flex items-center gap-1.5 ml-7.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
              <Ikon nama="tambah" className="w-3.5 h-3.5" tebal={2.4} />Tambahkan opsi
            </button>
          )}
        </div>
        {tandaiMasalah && catatanMasalah}
      </div>

      <div className="border-t border-slate-100 flex items-center gap-0.5 px-2 py-1.5">
        <button type="button" onClick={() => setModeKunci(true)}
          className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-xs font-semibold transition-colors ${
            jawabanBenar === null
              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              : 'text-indigo-600 hover:bg-indigo-50'}`}>
          <Ikon nama="kunciJawaban" className="w-4 h-4" />
          {jawabanBenar === null ? 'Kunci belum dipilih' : `Kunci: ${HURUF_OPSI[jawabanBenar] ?? jawabanBenar + 1}`}
        </button>
        <span className="flex-1" />
        <TombolIkon nama="naik" label="Pindah ke atas" onClick={onNaik} disabled={!bisaNaik} ukuran="w-4 h-4" className="w-9 h-9" />
        <TombolIkon nama="turun" label="Pindah ke bawah" onClick={onTurun} disabled={!bisaTurun} ukuran="w-4 h-4" className="w-9 h-9" />
        <span className="w-px h-5 bg-slate-100 mx-0.5" />
        <TombolIkon nama="duplikat" label="Duplikat" onClick={onDuplikat} ukuran="w-4 h-4" className="w-9 h-9" />
        <TombolIkon nama="hapus" label="Hapus" onClick={onHapus} ukuran="w-4 h-4" className="w-9 h-9 hover:text-red-600 hover:bg-red-50" />
      </div>
    </div>
  )
}
