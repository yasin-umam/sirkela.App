import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import type { IsiSoal, Soal } from '../../types'
import { useKembali } from '../../context/NavContext'
import { MAKS_PILIHAN, masalahSoal } from '../../lib/soal'
import { Gelembung, HURUF_OPSI } from '../../components/Gelembung'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { TeksOtomatis } from '../../components/ui/TeksOtomatis'
import { Button } from '../../components/ui/Button'

// ─── Satu kartu pertanyaan di editor ─────────────────────────────────────────
// Tiga wujud:
//   diam    -- ringkas; ketuk untuk menyunting
//   sunting -- bingkai & cincin biru, kolom pertanyaan & opsi bisa diketik
//   kunci   -- "Kunci jawaban": ketuk opsi yang benar, lalu Selesai
//
// Kunci SENGAJA dipilih di mode terpisah, bukan dengan mengetuk gelembung opsi
// saat menyunting: gelembung itu di mode sunting cuma penanda huruf, dan guru
// tidak boleh diam-diam mengganti kunci waktu bermaksud memperbaiki ketikan.
//
// Gelembung huruf sama dengan yang dilihat murid (Gelembung) -- guru yang
// menandai kunci "B" melihat B yang sama. Kunci selalu hijau + centang.

function kapital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
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
  /** true setelah Kirim ditolak: masalah ditandai jingga tebal, bukan tipis. */
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
    <p className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-jingga-gelap">
      <Ikon nama="galat" className="w-4 h-4" />{kapital(masalah)}
    </p>
  )

  const lencanaNomor = nomor !== undefined && (
    <span className={`shrink-0 mt-0.5 rounded-lg px-2 py-0.5 font-mono text-[13px] font-medium text-white ${
      aktif ? 'bg-biru' : 'bg-tinta'}`}>
      {String(nomor).padStart(2, '0')}
    </span>
  )

  // ── Diam ──
  if (!aktif) {
    return (
      <div ref={kartuRef} onClick={onAktifkan} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onAktifkan() }}
        className={`bg-white rounded-[18px] p-4 cursor-pointer transition-colors active:bg-isian ${
          tandaiMasalah && masalah ? 'border-[1.5px] border-jingga' : 'border border-garis'}`}>
        <div className="flex gap-3 items-start">
          {lencanaNomor}
          <p className={`flex-1 min-w-0 text-[15px] font-semibold leading-snug whitespace-pre-wrap break-words ${
            soal.pertanyaan.trim() ? 'text-tinta' : 'text-teks-3'}`}>
            {soal.pertanyaan.trim() || 'Pertanyaan'}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {pilihan.map((p, j) => {
            const kunci = j === jawabanBenar
            return (
              <div key={j} className="flex items-center gap-2.5">
                <Gelembung indeks={j} status={kunci ? 'benar' : 'kosong'} />
                <span className={`flex-1 min-w-0 text-[14.5px] break-words ${
                  !p.trim() ? 'text-teks-3 italic' : kunci ? 'text-tinta font-bold' : 'text-tinta-2'}`}>
                  {p.trim() || 'Opsi kosong'}
                </span>
                {kunci && <span className="text-xs font-bold text-hijau shrink-0">Kunci</span>}
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
      <div ref={kartuRef} className="bg-white rounded-[18px] border border-biru ring-4 ring-biru-tint overflow-hidden">
        <div className="p-4">
          <p className="flex items-center gap-2 text-[15px] font-extrabold text-tinta">
            <Ikon nama="kunciJawaban" className="w-5 h-5 text-biru" />Pilih jawaban yang benar
          </p>
          <div className="mt-3 flex gap-3 items-start">
            {lencanaNomor}
            <p className="flex-1 min-w-0 text-[15px] font-semibold leading-snug text-tinta whitespace-pre-wrap break-words">
              {soal.pertanyaan.trim() || 'Pertanyaan'}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {pilihan.map((p, j) => {
              const benar = j === jawabanBenar
              return (
                <button key={j} type="button" onClick={() => onUbah({ jawabanBenar: benar ? null : j })}
                  role="radio" aria-checked={benar}
                  className={`flex items-center gap-3 min-h-12 px-3.5 py-2 rounded-[14px] border-[1.5px] text-left transition-colors ${
                    benar ? 'bg-hijau-tint border-hijau' : 'bg-white border-garis active:bg-isian'}`}>
                  <Gelembung indeks={j} ukuran="lg" status={benar ? 'benar' : 'kosong'} />
                  <span className={`flex-1 min-w-0 text-[15px] break-words ${benar ? 'text-tinta font-bold' : 'text-tinta'}`}>
                    {p.trim() || 'Opsi kosong'}
                  </span>
                  {benar && <span className="text-xs font-bold text-hijau shrink-0">Kunci</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="border-t border-garis-2 flex justify-end px-3 py-2">
          <Button size="sm" onClick={() => setModeKunci(false)}>Selesai</Button>
        </div>
      </div>
    )
  }

  // ── Sunting ──
  return (
    <div ref={kartuRef} className="bg-white rounded-[18px] border border-biru ring-4 ring-biru-tint overflow-hidden">
      <div className="p-4">
        <div className="flex gap-3 items-start">
          {lencanaNomor}
          <TeksOtomatis ref={pertanyaanRef} value={soal.pertanyaan} placeholder="Tulis pertanyaan"
            onChange={e => onUbah({ pertanyaan: e.target.value })}
            className="flex-1 min-w-0 -mt-1 resize-none bg-isian rounded-xl px-3 py-2.5 text-[15px] leading-snug font-semibold text-tinta placeholder:text-teks-3 placeholder:font-normal outline-none border-[1.5px] border-garis focus:border-biru focus:bg-white transition-colors" />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {pilihan.map((p, j) => (
            <div key={j} className="flex items-center gap-2">
              <Gelembung indeks={j} ukuran="md" status={j === jawabanBenar ? 'benar' : 'kosong'} />
              <input ref={el => { opsiRefs.current[j] = el }} value={p} placeholder={`Opsi ${j + 1}`}
                aria-label={`Opsi ${j + 1}`}
                onChange={e => ubahOpsi(j, e.target.value)}
                onKeyDown={e => tombolOpsi(e, j)}
                onPaste={e => tempelOpsi(e, j)}
                className="flex-1 min-w-0 h-11.5 px-3 text-[15px] text-tinta bg-white rounded-xl border-[1.5px] border-garis outline-none focus:border-biru placeholder:text-teks-3 transition-colors" />
              {pilihan.length > 1 && (
                <TombolIkon nama="tutup" label={`Hapus opsi ${j + 1}`} onClick={() => hapusOpsi(j)}
                  ukuran="w-4 h-4" className="w-9 h-9 shrink-0" />
              )}
            </div>
          ))}
          {pilihan.length < MAKS_PILIHAN && (
            <button type="button" onClick={() => sisipkanOpsi(pilihan.length - 1, [`Opsi ${pilihan.length + 1}`])}
              className="self-start inline-flex items-center gap-1.5 ml-8.5 h-10 px-2 rounded-lg text-sm font-bold text-biru hover:bg-biru-tint">
              <Ikon nama="tambah" className="w-4 h-4" tebal={2.4} />Tambahkan opsi
            </button>
          )}
        </div>
        {tandaiMasalah && catatanMasalah}
      </div>

      <div className="border-t border-garis-2 flex items-center gap-0.5 px-2 py-1.5">
        <button type="button" onClick={() => setModeKunci(true)}
          className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-[10px] text-[13px] font-bold transition-colors ${
            jawabanBenar === null
              ? 'text-jingga-gelap bg-jingga-tint hover:bg-jingga-garis/50'
              : 'text-biru bg-biru-tint hover:bg-biru-muda/50'}`}>
          <Ikon nama="kunciJawaban" className="w-4 h-4" />
          {jawabanBenar === null ? 'Kunci belum dipilih' : `Kunci: ${HURUF_OPSI[jawabanBenar] ?? jawabanBenar + 1}`}
        </button>
        <span className="flex-1" />
        <TombolIkon nama="naik" label="Pindah ke atas" onClick={onNaik} disabled={!bisaNaik} ukuran="w-4 h-4" className="w-10 h-10" />
        <TombolIkon nama="turun" label="Pindah ke bawah" onClick={onTurun} disabled={!bisaTurun} ukuran="w-4 h-4" className="w-10 h-10" />
        <span className="w-px h-5 bg-garis mx-0.5" />
        <TombolIkon nama="duplikat" label="Duplikat" onClick={onDuplikat} ukuran="w-4 h-4" className="w-10 h-10" />
        <TombolIkon nama="hapus" label="Hapus" onClick={onHapus} ukuran="w-4 h-4" className="w-10 h-10 text-jingga-gelap hover:text-jingga-gelap hover:bg-jingga-tint" />
      </div>
    </div>
  )
}
