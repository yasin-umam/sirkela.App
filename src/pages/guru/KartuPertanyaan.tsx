import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import type { IsiSoal, Soal } from '../../types'
import { useKembali } from '../../context/NavContext'
import { MAKS_PILIHAN, masalahSoal } from '../../lib/soal'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { TeksOtomatis } from '../../components/ui/TeksOtomatis'
import { Button } from '../../components/ui/Button'

// ─── Satu kartu pertanyaan di editor ─────────────────────────────────────────
// Tiga wujud, sama dengan Google Form:
//   diam    -- ringkas; ketuk untuk menyunting
//   sunting -- garis biru di kiri, kolom pertanyaan & opsi bisa diketik
//   kunci   -- "Kunci jawaban": ketuk opsi yang benar, lalu Selesai
//
// Kunci SENGAJA dipilih di mode terpisah, bukan dengan mengetuk lingkaran opsi
// saat menyunting: di Google Form lingkaran itu cuma hiasan, dan guru yang
// terbiasa di sana tidak boleh diam-diam mengganti kunci waktu mengetuk opsi.

function kapital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Lingkaran({ warna = 'border-slate-300', isi }: { warna?: string; isi?: string }) {
  return (
    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${warna}`}>
      {isi && <span className={`w-2.5 h-2.5 rounded-full ${isi}`} />}
    </span>
  )
}

export function KartuPertanyaan({
  soal, aktif, gulir, tandaiMasalah, bisaNaik, bisaTurun,
  onAktifkan, onGulirSelesai, onUbah, onDuplikat, onHapus, onNaik, onTurun,
}: {
  soal: Soal
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

  // Opsi baru langsung terseleksi: mengetik menimpa "Opsi 3", persis Google Form.
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
    <p className={`mt-3 flex items-center gap-1.5 text-xs ${tandaiMasalah ? 'text-salah' : 'text-amber-700'}`}>
      <Ikon nama="galat" className="w-4 h-4" />{kapital(masalah)}
    </p>
  )

  // ── Diam ──
  if (!aktif) {
    return (
      <div ref={kartuRef} onClick={onAktifkan} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onAktifkan() }}
        className={`bg-white rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
          tandaiMasalah && masalah ? 'border-salah' : 'border-garis'}`}>
        <div className="p-5 desktop:p-6">
          <p className={`text-base whitespace-pre-wrap break-words ${soal.pertanyaan.trim() ? 'text-teks' : 'text-teks-2'}`}>
            {soal.pertanyaan.trim() || 'Pertanyaan'}
          </p>
          <div className="mt-3 flex flex-col">
            {pilihan.map((p, j) => (
              <div key={j} className="flex items-center gap-3 py-1.5">
                <Lingkaran />
                <span className={`flex-1 min-w-0 text-sm break-words ${p.trim() ? 'text-teks' : 'text-teks-2 italic'}`}>
                  {p.trim() || 'Opsi kosong'}
                </span>
                {j === jawabanBenar && <Ikon nama="centang" className="w-5 h-5 text-benar" />}
              </div>
            ))}
          </div>
          {catatanMasalah}
        </div>
      </div>
    )
  }

  // ── Kunci jawaban ──
  if (modeKunci) {
    return (
      <div ref={kartuRef} className="relative bg-white rounded-lg border border-garis shadow-md overflow-hidden">
        <div className="absolute left-0 inset-y-0 w-1.5 bg-fokus" />
        <div className="pl-6 pr-5 desktop:pl-7 desktop:pr-6 pt-5 pb-3">
          <p className="flex items-center gap-2 text-base text-teks">
            <Ikon nama="kunciJawaban" className="w-5 h-5 text-teks-2" />Pilih jawaban yang benar:
          </p>
          <p className="mt-4 text-base text-teks whitespace-pre-wrap break-words">{soal.pertanyaan.trim() || 'Pertanyaan'}</p>
          <div className="mt-3 flex flex-col gap-1">
            {pilihan.map((p, j) => {
              const benar = j === jawabanBenar
              return (
                <button key={j} type="button" onClick={() => onUbah({ jawabanBenar: benar ? null : j })}
                  className={`flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-md text-left transition-colors ${
                    benar ? 'bg-green-50' : 'hover:bg-slate-900/4'}`}>
                  <Lingkaran warna={benar ? 'border-benar' : 'border-slate-400'} isi={benar ? 'bg-benar' : undefined} />
                  <span className={`flex-1 min-w-0 text-sm break-words ${benar ? 'text-benar font-medium' : 'text-teks'}`}>
                    {p.trim() || 'Opsi kosong'}
                  </span>
                  {benar && <Ikon nama="centang" className="w-5 h-5 text-benar" />}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mx-5 desktop:mx-6 border-t border-garis flex justify-end py-2">
          <Button variant="teks" onClick={() => setModeKunci(false)} className="text-fokus! hover:bg-blue-50!">Selesai</Button>
        </div>
      </div>
    )
  }

  // ── Sunting ──
  return (
    <div ref={kartuRef} className="relative bg-white rounded-lg border border-garis shadow-md overflow-hidden">
      <div className="absolute left-0 inset-y-0 w-1.5 bg-fokus" />
      <div className="pl-6 pr-4 desktop:pl-7 desktop:pr-5 pt-5 pb-3">
        <TeksOtomatis ref={pertanyaanRef} value={soal.pertanyaan} placeholder="Pertanyaan"
          onChange={e => onUbah({ pertanyaan: e.target.value })}
          className="w-full resize-none bg-isian rounded-t-md px-4 pt-3 pb-3 text-base text-teks placeholder:text-teks-2 outline-none border-b border-slate-400 focus:border-b-2 focus:border-indigo-600 focus:pb-2.75" />

        <div className="mt-4 flex flex-col">
          {pilihan.map((p, j) => (
            <div key={j} className="flex items-center gap-3 min-h-11">
              <Lingkaran />
              <input ref={el => { opsiRefs.current[j] = el }} value={p} placeholder={`Opsi ${j + 1}`}
                aria-label={`Opsi ${j + 1}`}
                onChange={e => ubahOpsi(j, e.target.value)}
                onKeyDown={e => tombolOpsi(e, j)}
                onPaste={e => tempelOpsi(e, j)}
                className="flex-1 min-w-0 py-1.5 text-sm text-teks bg-transparent outline-none border-b border-transparent hover:border-garis focus:border-b-2 focus:border-indigo-600" />
              {j === jawabanBenar && <Ikon nama="centang" className="w-5 h-5 text-benar" />}
              {pilihan.length > 1 && (
                <TombolIkon nama="tutup" label={`Hapus opsi ${j + 1}`} onClick={() => hapusOpsi(j)} ukuran="w-5 h-5" />
              )}
            </div>
          ))}
          {pilihan.length < MAKS_PILIHAN && (
            <div className="flex items-center gap-3 min-h-11">
              <Lingkaran />
              <button type="button" onClick={() => sisipkanOpsi(pilihan.length - 1, [`Opsi ${pilihan.length + 1}`])}
                className="py-1.5 text-sm text-teks-2 border-b border-transparent hover:border-garis">
                Tambahkan opsi
              </button>
            </div>
          )}
        </div>
        {tandaiMasalah && catatanMasalah}
      </div>

      <div className="mx-4 desktop:mx-6 border-t border-garis flex items-center gap-0.5 py-1.5">
        <button type="button" onClick={() => setModeKunci(true)}
          className="inline-flex items-center gap-1.5 h-9 px-2 rounded-md text-sm font-medium text-fokus hover:bg-blue-50">
          <Ikon nama="kunciJawaban" className="w-5 h-5" />
          Kunci jawaban
        </button>
        {jawabanBenar === null && <span className="w-2 h-2 rounded-full bg-amber-500" title="Kunci jawaban belum dipilih" />}
        <span className="flex-1" />
        <TombolIkon nama="naik" label="Pindah ke atas" onClick={onNaik} disabled={!bisaNaik} ukuran="w-5 h-5" />
        <TombolIkon nama="turun" label="Pindah ke bawah" onClick={onTurun} disabled={!bisaTurun} ukuran="w-5 h-5" />
        <span className="w-px h-6 bg-garis mx-1" />
        <TombolIkon nama="duplikat" label="Duplikat" onClick={onDuplikat} ukuran="w-5 h-5" />
        <TombolIkon nama="hapus" label="Hapus" onClick={onHapus} ukuran="w-5 h-5" />
      </div>
    </div>
  )
}
