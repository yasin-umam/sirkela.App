import { useState, type ReactNode } from 'react'
import type { Soal } from '../../types'
import { useDesktop } from '../../lib/useDesktop'
import { useFormulir } from '../../context/FormulirContext'
import { uraikanTempelan } from '../../lib/tempelSoal'
import { imporPdf } from '../../lib/imporPdf'
import { generateSoal, MAKS_JUMLAH_SOAL, MAKS_PANJANG_TOPIK, MAKS_PANJANG_TP, MAKS_JUMLAH_OPSI, type Kesulitan } from '../../lib/generateSoal'
import { buatUuid } from '../../lib/soal'
import { normalisasiSoal } from '../../lib/teksMatematika'
import { HURUF_OPSI } from '../../components/Gelembung'
import { pastikanRumusValid } from '../../lib/katexMuat'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { Spinner } from '../../components/ui/Spinner'
import { KartuPertanyaan } from './KartuPertanyaan'

// ─── Membawa soal dari luar formulir ──────────────────────────────────────────
// Tiga CARA, dipilih guru di layar pertama:
//   teks -- tempel teks dari halaman RESPONDEN Google Form (Ctrl+A, Ctrl+C).
//           Tanpa OAuth, tanpa API apa pun -- lihat tempelSoal.ts.
//   pdf  -- unggah PDF (ekspor Microsoft 365, Google Form, atau dokumen soal
//           lain); dibaca AI di SERVER lewat Edge Function impor-pdf, supaya
//           kunci OpenRouter tidak pernah ke klien -- lihat lib/imporPdf.ts.
//   ai   -- guru menulis topik, AI MENGARANG soal dari nol di SERVER lewat
//           Edge Function generate-soal -- lihat lib/generateSoal.ts. Beda dari
//           dua cara di atas: tidak ada dokumen sumber sama sekali, lihat
//           "Generate dari Topik (AI)" di CLAUDE.md untuk kenapa ini ditambahkan
//           belakangan (2026-09-22) dan kenapa sebelumnya sengaja tidak ada.
//
// Kunci jawaban TIDAK PERNAH langsung dipercaya dari ketiga cara (teks tidak
// pernah membawanya sama sekali; tebakan AI dari PDF belum tentu benar; AI yang
// mengarang topik bisa salah hitung/salah fakta sendiri) -- makanya layar
// Tinjau di bawah berupa kartu KartuPertanyaan yang BISA disunting penuh, bukan
// cuma daftar ringkas: guru membetulkan blok yang salah pisah atau salah baca,
// dan menandai/memeriksa kuncinya di situ, sebelum apa pun ditulis ke database.

type Metode = 'teks' | 'pdf' | 'ai'

function PilihanCara({ ikon, judul, keterangan, onClick }: {
  ikon: NamaIkon; judul: string; keterangan: string; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full bg-white rounded-2xl border border-garis hover:border-biru active:bg-isian active:scale-[0.99] transition-all flex items-center gap-3.5 p-4 text-left">
      <span className="w-11 h-11 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
        <Ikon nama={ikon} className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-tinta">{judul}</span>
        <span className="block text-xs text-teks-3 mt-0.5 leading-snug">{keterangan}</span>
      </span>
    </button>
  )
}

const CARA_PANEL: { id: Metode; ikon: NamaIkon; judul: string; keterangan: string }[] = [
  { id: 'ai', ikon: 'ai', judul: 'Generate dari topik', keterangan: 'AI menulis soal baru dari nol' },
  { id: 'teks', ikon: 'impor', judul: 'Tempel dari Google Form', keterangan: 'Salin teks halaman responden' },
  { id: 'pdf', ikon: 'dokumen', judul: 'Unggah PDF', keterangan: 'Dibaca AI, maksimal 15 MB' },
]

/**
 * Bingkai desktop (≥ 1024px) untuk tiga cara membawa soal: daftar cara di kiri,
 * isian cara terpilih di kanan. Isinya (`children`) PERSIS yang dipakai Dialog di
 * HP -- cuma bingkainya yang beda. Layar Tinjau tetap Dialog biasa.
 */
function PanelImporDesktop({ metode, onMetode, sibuk, judul, onTutup, label, nonaktif, onAksi, children }: {
  metode: Metode
  onMetode: (m: Metode) => void
  /** Sedang membaca/menulis di server: tidak boleh ganti cara atau menutup. */
  sibuk: boolean
  judul: string
  onTutup: () => void
  label: string
  nonaktif: boolean
  onAksi: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-tinta/55" onClick={sibuk ? undefined : onTutup} />
      <div role="dialog" aria-modal aria-labelledby="judul-impor"
        className="lembar-masuk relative w-full max-w-240 max-h-[calc(100%-2rem)] flex bg-white rounded-[22px] shadow-xl overflow-hidden">
        <div className="w-75 shrink-0 bg-isian border-r border-garis-2 p-4 flex flex-col gap-1.5">
          <h2 id="judul-impor" className="px-2 pt-2 pb-2.5 text-xl font-extrabold tracking-tight text-tinta">Bawa soal masuk</h2>
          <div role="tablist" aria-label="Cara membawa soal" className="flex flex-col gap-1.5">
            {CARA_PANEL.map(c => {
              const nyala = c.id === metode
              return (
                <button key={c.id} type="button" role="tab" aria-selected={nyala} disabled={sibuk && !nyala}
                  onClick={() => onMetode(c.id)}
                  className={`flex items-start gap-3 p-3 rounded-[14px] border-[1.5px] text-left transition-colors disabled:opacity-50 ${
                    nyala ? 'bg-white border-biru' : 'border-transparent hover:bg-white/70'}`}>
                  <span className={`w-9.5 h-9.5 rounded-[11px] flex items-center justify-center shrink-0 ${
                    nyala ? 'bg-biru text-white' : 'bg-biru-tint text-biru'}`}>
                    <Ikon nama={c.ikon} className="w-5 h-5" />
                  </span>
                  <span>
                    <span className={`block text-[14.5px] text-tinta ${nyala ? 'font-extrabold' : 'font-bold'}`}>{c.judul}</span>
                    <span className="block text-[12.5px] leading-snug text-teks-3 mt-0.5">{c.keterangan}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <ol className="list-none m-0 px-2 pt-3.5 border-t border-garis-2 flex flex-col gap-2.5 text-[13px]">
            {[['Pilih sumber soal', true], ['Tinjau dan periksa kunci', false], ['Impor ke formulir', false]].map(([t, nyala], i) => (
              <li key={i} className={`flex items-center gap-2.5 ${nyala ? 'font-bold text-biru' : 'text-teks-3'}`}>
                <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-xs font-extrabold ${
                  nyala ? 'bg-biru text-white' : 'border-[1.5px] border-pinggir-2'}`}>{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-1 shrink-0">
            <h3 className="text-xl font-extrabold tracking-tight text-tinta">{judul}</h3>
            <button type="button" aria-label="Tutup" onClick={onTutup} disabled={sibuk}
              className="-mr-2 -mt-1 w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-teks-3 hover:bg-garis-2 hover:text-tinta transition-colors disabled:opacity-40">
              <Ikon nama="tutup" className="w-5 h-5" tebal={2} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar px-7 pb-3 text-sm text-tinta-2 leading-relaxed">{children}</div>
          <div className="px-6 pt-2 pb-5 flex justify-end gap-2 shrink-0">
            <Button variant="ghost" onClick={onTutup} disabled={sibuk}>Batal</Button>
            <Button onClick={onAksi} disabled={nonaktif}>{label}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const JUMLAH_CEPAT = [5, 10, 15, 20]
const JUMLAH_OPSI_PILIHAN = [4, MAKS_JUMLAH_OPSI] // 4 (A-D) atau 5 (A-E)
const KESULITAN: { id: Kesulitan; label: string }[] = [
  { id: 'mudah', label: 'Mudah' },
  { id: 'sedang', label: 'Sedang' },
  { id: 'sulit', label: 'Sulit' },
]

export function DialogImpor({ tujuan, metodeAwal, onTutup, onSelesai }: {
  /** 'baru' = jadi formulir sendiri; 'ini' = ditambahkan ke akhir formulir aktif. */
  tujuan: 'baru' | 'ini'
  /**
   * Cara yang SUDAH dipilih pemanggil -- ubin "Tempel teks"/"Unggah PDF"/
   * "Generate dari topik" di Menu langsung menunjuk salah satunya, jadi layar
   * pemilih di bawah dilewati. Tombol "Kembali" di layar itu tetap
   * mengembalikannya ke pemilih: guru yang salah ketuk ubin tidak perlu
   * menutup dialog dan mulai lagi.
   */
  metodeAwal?: Metode
  onTutup: () => void
  onSelesai: (jumlah: number) => void
}) {
  const { buatFormulir, imporSoal } = useFormulir()
  const desktop = useDesktop()
  const [metode, setMetode] = useState<Metode | null>(metodeAwal ?? null)
  const [teks, setTeks] = useState('')
  const [berkas, setBerkas] = useState<File | null>(null)
  const [mengonversi, setMengonversi] = useState(false)
  const [topik, setTopik] = useState('')
  const [tp, setTp] = useState('')
  const [jumlah, setJumlah] = useState(5)
  const [jumlahOpsi, setJumlahOpsi] = useState(4)
  const [kesulitan, setKesulitan] = useState<Kesulitan>('sedang')
  const [draf, setDraf] = useState<Soal[] | null>(null)
  const [dilewati, setDilewati] = useState<{ alasan: string; jumlah: number }[]>([])
  const [fokusDraf, setFokusDraf] = useState<string | null>(null)
  const [gulirDraf, setGulirDraf] = useState<{ id: string; cara: 'fokus' | 'lihat' } | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  function terimaHasil(soal: { pertanyaan: string; pilihan: string[]; jawabanBenar: number | null }[], dilewatiBaru: { alasan: string; jumlah: number }[]) {
    setDraf(soal.map((s, i): Soal => ({ id: buatUuid(), formulirId: '', pertanyaan: s.pertanyaan, pilihan: s.pilihan, jawabanBenar: s.jawabanBenar, gambar: null, urutan: i })))
    setDilewati(dilewatiBaru)
  }

  // Generate dari topik menulis rumus sebagai LaTeX (ATURAN_LATEX_SOAL di
  // generate-soal/index.ts). normalisasiSoal memperbaiki backslash yang mentah
  // kena JSON.parse; pastikanRumusValid mencoba tiap rumus lewat KaTeX dan
  // menurunkannya ke Unicode kalau AI menulis LaTeX yang tidak valid -- guru
  // tidak boleh melihat rumus merah di layar Tinjau. Teks tempel & impor PDF
  // tidak lewat sini: keduanya bukan keluaran model yang diminta menulis LaTeX.
  async function rapikanTeksAi(teks: string): Promise<string> {
    return pastikanRumusValid(normalisasiSoal(teks))
  }
  async function rapikanSoalAi(soal: { pertanyaan: string; pilihan: string[]; jawabanBenar: number | null }[]) {
    return Promise.all(soal.map(async s => ({
      ...s,
      pertanyaan: await rapikanTeksAi(s.pertanyaan),
      pilihan: await Promise.all(s.pilihan.map(p => rapikanTeksAi(p))),
    })))
  }

  function uraikan() {
    const r = uraikanTempelan(teks)
    if (r.soal.length === 0) {
      setGalat('Tidak ada pertanyaan yang terbaca. Pisahkan tiap soal dengan baris kosong, dan pastikan tiap soal punya minimal 2 pilihan di baris-baris berikutnya.')
      return
    }
    setGalat(null)
    terimaHasil(r.soal, r.dilewati)
  }

  async function konversiPdf() {
    if (!berkas) return
    setMengonversi(true); setGalat(null)
    try {
      const r = await imporPdf(berkas)
      terimaHasil(r.soal, r.dilewati)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengimpor PDF')
    } finally {
      setMengonversi(false)
    }
  }

  async function generate() {
    if (!topik.trim()) return
    setMengonversi(true); setGalat(null)
    try {
      const r = await generateSoal(topik, jumlah, kesulitan, tp, jumlahOpsi)
      const soalRapi = await rapikanSoalAi(r.soal)
      terimaHasil(soalRapi, r.dilewati)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal generate soal')
    } finally {
      setMengonversi(false)
    }
  }

  function ubahDraf(id: string, ubahan: Partial<Soal>) {
    setDraf(d => d?.map(s => s.id === id ? { ...s, ...ubahan } : s) ?? d)
  }
  function hapusDraf(id: string) {
    setDraf(d => d?.filter(s => s.id !== id) ?? d)
    setFokusDraf(f => f === id ? null : f)
  }
  function duplikatDraf(id: string) {
    const list = draf
    if (!list) return
    const i = list.findIndex(s => s.id === id)
    if (i === -1) return
    const baru: Soal = { ...list[i], id: buatUuid() }
    const baris = [...list]
    baris.splice(i + 1, 0, baru)
    setDraf(baris)
    setFokusDraf(baru.id)
    setGulirDraf({ id: baru.id, cara: 'lihat' })
  }
  function pindahDraf(id: string, arah: -1 | 1) {
    setDraf(d => {
      if (!d) return d
      const list = [...d]
      const i = list.findIndex(s => s.id === id)
      const j = i + arah
      if (i === -1 || j < 0 || j >= list.length) return d
      ;[list[i], list[j]] = [list[j], list[i]]
      return list
    })
  }
  function tambahDraf() {
    const id = buatUuid()
    setDraf(d => [...(d ?? []), { id, formulirId: '', pertanyaan: '', pilihan: ['Opsi 1', 'Opsi 2'], jawabanBenar: null, gambar: null, urutan: d?.length ?? 0 }])
    setFokusDraf(id)
    setGulirDraf({ id, cara: 'fokus' })
  }

  async function impor() {
    if (!draf || draf.length === 0) return
    setMenyimpan(true); setGalat(null)
    try {
      if (tujuan === 'baru') await buatFormulir()
      await imporSoal(draf.map(s => ({ pertanyaan: s.pertanyaan, pilihan: s.pilihan, jawabanBenar: s.jawabanBenar })))
      onSelesai(draf.length)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan soal')
      setMenyimpan(false)
    }
  }

  // Isi tiga layar sumber, dipakai dua bingkai: Dialog biasa (HP) dan panel dua kolom (desktop).
  const badanAi = (
    <>
      <p>
        AI menulis soal pilihan ganda dari topik yang kamu tentukan. Beda dari Impor PDF, di sini AI
        MENGARANG soal baru, bukan membaca dokumen yang sudah ada. Periksa kuncinya di layar berikutnya.
      </p>
      <label className="block mt-4 text-sm font-semibold text-tinta">Topik atau materi</label>
      <textarea value={topik} onChange={e => { setTopik(e.target.value); setGalat(null) }} autoFocus rows={3}
        maxLength={MAKS_PANJANG_TOPIK}
        placeholder="Contoh: Perkalian pecahan untuk kelas 5 SD"
        className="mt-1.5 w-full resize-y py-2.5 px-3 bg-isian rounded-xl text-sm text-tinta placeholder:text-teks-3 outline-none border border-garis focus:border-biru transition-colors" />

      <label className="block mt-4 text-sm font-semibold text-tinta">Tujuan pembelajaran <span className="font-normal text-teks-3">(opsional)</span></label>
      <textarea value={tp} onChange={e => { setTp(e.target.value); setGalat(null) }} rows={2}
        maxLength={MAKS_PANJANG_TP}
        placeholder="Contoh: Murid dapat menghitung volume kubus dan balok"
        className="mt-1.5 w-full resize-y py-2.5 px-3 bg-isian rounded-xl text-sm text-tinta placeholder:text-teks-3 outline-none border border-garis focus:border-biru transition-colors" />

      <label className="block mt-4 text-sm font-semibold text-tinta">Jumlah soal</label>
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        {JUMLAH_CEPAT.map(n => (
          <button key={n} type="button" onClick={() => setJumlah(n)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              jumlah === n ? 'bg-biru text-white border-biru' : 'bg-white text-tinta-2 border-garis hover:border-biru'}`}>
            {n}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 mt-2">
        <span className="text-xs text-teks-3 shrink-0">Atau isi manual</span>
        <input type="number" inputMode="numeric" min={1} max={MAKS_JUMLAH_SOAL} value={jumlah}
          onChange={e => setJumlah(Math.min(MAKS_JUMLAH_SOAL, Math.max(1, Number(e.target.value) || 1)))}
          onWheel={e => e.currentTarget.blur()}
          className="w-16 px-2 py-1.5 rounded-lg border border-garis text-sm text-right text-tinta outline-none focus:border-biru" />
        <span className="text-xs text-teks-3">soal</span>
      </label>

      <label className="block mt-4 text-sm font-semibold text-tinta">Jumlah pilihan jawaban</label>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {JUMLAH_OPSI_PILIHAN.map(n => (
          <button key={n} type="button" onClick={() => setJumlahOpsi(n)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              jumlahOpsi === n ? 'bg-biru text-white border-biru' : 'bg-white text-tinta-2 border-garis hover:border-biru'}`}>
            {n} ({HURUF_OPSI[0]}-{HURUF_OPSI[n - 1]})
          </button>
        ))}
      </div>

      <label className="block mt-4 text-sm font-semibold text-tinta">Tingkat kesulitan</label>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {KESULITAN.map(k => (
          <button key={k.id} type="button" onClick={() => setKesulitan(k.id)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              kesulitan === k.id ? 'bg-biru text-white border-biru' : 'bg-white text-tinta-2 border-garis hover:border-biru'}`}>
            {k.label}
          </button>
        ))}
      </div>

      {mengonversi && (
        <p className="mt-4 flex items-center gap-2 text-sm text-teks-3">
          <Spinner size={16} />Menulis {jumlah} soal dengan AI, bisa sampai satu menit…
        </p>
      )}
      {galat && <p className="mt-3 text-sm text-jingga-gelap">{galat}</p>}
    </>
  )

  const badanPdf = (
    <>
      <p>
        Unggah PDF berisi soal pilihan ganda dari Microsoft 365, Google Form yang diekspor jadi PDF, atau
        dokumen lain. AI yang membacanya di server; kunci jawaban tetap kamu yang menandai di layar berikutnya.
      </p>
      <label className={`mt-4 flex flex-col items-center justify-center gap-2 h-36 rounded-2xl border-2 border-dashed transition-colors px-4 text-center ${
        mengonversi ? 'border-garis' : 'border-garis hover:border-biru cursor-pointer'}`}>
        <Ikon nama="dokumen" className="w-8 h-8 text-biru" tebal={1.5} />
        <span className="text-sm font-medium text-tinta break-all">{berkas ? berkas.name : 'Pilih berkas PDF'}</span>
        {berkas && <span className="text-xs text-teks-3">{(berkas.size / 1024 / 1024).toFixed(1)} MB</span>}
        <input type="file" accept="application/pdf" className="hidden" disabled={mengonversi}
          onChange={e => { setBerkas(e.target.files?.[0] ?? null); setGalat(null) }} />
      </label>
      {mengonversi && (
        <p className="mt-3 flex items-center gap-2 text-sm text-teks-3">
          <Spinner size={16} />Membaca PDF dengan AI, bisa sampai satu menit…
        </p>
      )}
      {galat && <p className="mt-3 text-sm text-jingga-gelap">{galat}</p>}
    </>
  )

  const badanTeks = (
    <>
      <p>
        Buka Google Form-nya (link <strong className="font-semibold text-tinta">responden</strong>, bukan edit), tekan{' '}
        <strong className="font-semibold text-tinta">Ctrl+A</strong> lalu{' '}
        <strong className="font-semibold text-tinta">Ctrl+C</strong>, dan tempel semuanya di sini. Pisahkan tiap
        soal dengan baris kosong: baris pertama pertanyaannya, baris-baris berikutnya pilihannya.
      </p>
      <textarea value={teks} onChange={e => { setTeks(e.target.value); setGalat(null) }} autoFocus rows={10}
        placeholder={'Contoh:\n\nSiapa presiden pertama Indonesia?\nSoekarno\nHatta\nSoeharto\n\nIbu kota Indonesia?\nJakarta\nBandung'}
        className="mt-4 w-full resize-y py-2.5 px-3 bg-isian rounded-xl text-sm text-tinta placeholder:text-teks-3 outline-none border border-garis focus:border-biru transition-colors" />
      <p className="mt-3 text-xs">Kunci jawaban tidak ikut tersalin dari Google Form. Kamu menandainya sendiri di layar berikutnya.</p>
      {galat && <p className="mt-3 text-sm text-jingga-gelap">{galat}</p>}
    </>
  )

  // ── Layar: tinjau hasil (kartu bisa disunting -- kuncinya belum pasti) ──
  if (draf) {
    const n = draf.length
    return (
      <Dialog judul="Tinjau pertanyaan" onTutup={menyimpan ? undefined : onTutup} lebar="max-w-2xl"
        aksi={<>
          <Button variant="ghost" onClick={() => { setDraf(null); setGalat(null) }} disabled={menyimpan}>Kembali</Button>
          <Button onClick={() => void impor()} disabled={menyimpan || n === 0}>
            {menyimpan ? 'Mengimpor…' : `Impor ${n} pertanyaan`}
          </Button>
        </>}>
        <p>
          {metode === 'pdf' ? (
            <>Betulkan kalau ada yang salah dibaca, lalu periksa <strong className="font-semibold text-tinta">Kunci
              jawaban</strong> tiap soal. Tebakan AI belum tentu benar.</>
          ) : metode === 'ai' ? (
            <>Betulkan kalau ada yang kurang pas, lalu periksa <strong className="font-semibold text-tinta">Kunci
              jawaban</strong> tiap soal. AI menulis kuncinya sendiri, tapi bisa salah hitung atau salah fakta.</>
          ) : (
            <>Betulkan kalau ada yang salah pisah, lalu tandai <strong className="font-semibold text-tinta">Kunci
              jawaban</strong> tiap soal. Teks tempelan tidak pernah membawa kuncinya.</>
          )}
        </p>
        {dilewati.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-jingga-tipis px-3 py-2 text-xs text-jingga-gelap">
            <Ikon nama="galat" className="w-4 h-4 shrink-0 mt-px" />
            Dilewati: {dilewati.map(d => `${d.jumlah} blok ${d.alasan}`).join(', ')}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {draf.map((s, i) => (
            <KartuPertanyaan
              key={s.id}
              nomor={i + 1}
              soal={s}
              aktif={fokusDraf === s.id}
              gulir={gulirDraf?.id === s.id ? gulirDraf.cara : null}
              tandaiMasalah={false}
              bisaNaik={i > 0}
              bisaTurun={i < draf.length - 1}
              onAktifkan={() => setFokusDraf(s.id)}
              onGulirSelesai={() => setGulirDraf(null)}
              onUbah={ubahan => ubahDraf(s.id, ubahan)}
              onDuplikat={() => duplikatDraf(s.id)}
              onHapus={() => hapusDraf(s.id)}
              onNaik={() => pindahDraf(s.id, -1)}
              onTurun={() => pindahDraf(s.id, 1)}
            />
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={tambahDraf} className="mt-3">
          <Ikon nama="tambah" className="w-4 h-4" />Tambah pertanyaan
        </Button>
        {galat && <p className="mt-3 text-sm text-jingga-gelap">{galat}</p>}
      </Dialog>
    )
  }

  // ── Desktop: satu bingkai dua panel ──
  // Cara di kiri (ganti kapan saja tanpa "Kembali"), isian di kanan. Layar awal
  // pemilih tidak ada di sini: Generate dari topik langsung terpilih.
  if (desktop) {
    const m: Metode = metode ?? 'ai'
    const layar = {
      ai: {
        judul: 'Generate dari topik', badan: badanAi,
        label: mengonversi ? 'Menulis dengan AI…' : `Generate ${jumlah} soal`, nonaktif: !topik.trim() || mengonversi, aksi: () => void generate(),
      },
      teks: {
        judul: 'Tempel dari Google Form', badan: badanTeks,
        label: 'Lanjut', nonaktif: !teks.trim(), aksi: uraikan,
      },
      pdf: {
        judul: 'Unggah PDF', badan: badanPdf,
        label: mengonversi ? 'Membaca dengan AI…' : 'Lanjut', nonaktif: !berkas || mengonversi, aksi: () => void konversiPdf(),
      },
    }[m]
    return (
      <PanelImporDesktop metode={m} sibuk={mengonversi} judul={layar.judul}
        onMetode={ganti => { setMetode(ganti); setGalat(null) }} onTutup={onTutup}
        label={layar.label} nonaktif={layar.nonaktif} onAksi={layar.aksi}>
        {layar.badan}
      </PanelImporDesktop>
    )
  }

  // ── Layar: generate dari topik (AI mengarang) ──
  if (metode === 'ai') {
    return (
      <Dialog judul="Generate dari topik" onTutup={mengonversi ? undefined : onTutup} lebar="max-w-lg"
        aksi={<>
          <Button variant="ghost" onClick={() => { setMetode(null); setGalat(null) }} disabled={mengonversi}>Kembali</Button>
          <Button onClick={() => void generate()} disabled={!topik.trim() || mengonversi}>
            {mengonversi ? 'Menulis dengan AI…' : 'Lanjut'}
          </Button>
        </>}>
        {badanAi}
      </Dialog>
    )
  }

  // ── Layar: unggah PDF ──
  if (metode === 'pdf') {
    return (
      <Dialog judul="Unggah PDF soal" onTutup={mengonversi ? undefined : onTutup} lebar="max-w-lg"
        aksi={<>
          <Button variant="ghost" onClick={() => { setMetode(null); setBerkas(null); setGalat(null) }} disabled={mengonversi}>Kembali</Button>
          <Button onClick={() => void konversiPdf()} disabled={!berkas || mengonversi}>
            {mengonversi ? 'Membaca dengan AI…' : 'Lanjut'}
          </Button>
        </>}>
        {badanPdf}
      </Dialog>
    )
  }

  // ── Layar: tempel teks ──
  if (metode === 'teks') {
    return (
      <Dialog judul="Tempel soal dari Google Form" onTutup={onTutup} lebar="max-w-lg"
        aksi={<>
          <Button variant="ghost" onClick={() => setMetode(null)}>Kembali</Button>
          <Button onClick={uraikan} disabled={!teks.trim()}>Lanjut</Button>
        </>}>
        {badanTeks}
      </Dialog>
    )
  }

  // ── Layar awal: pilih cara ──
  return (
    <Dialog judul="Tambah pertanyaan" onTutup={onTutup} lebar="max-w-md"
      aksi={<Button variant="ghost" onClick={onTutup}>Batal</Button>}>
      <p>Pilih cara membawa soal ke formulir ini.</p>
      <div className="mt-4 flex flex-col gap-2.5">
        <PilihanCara ikon="ai" judul="Generate dari topik"
          keterangan="AI menulis soal baru dari topik yang kamu tentukan."
          onClick={() => setMetode('ai')} />
        <PilihanCara ikon="impor" judul="Tempel dari Google Form"
          keterangan="Salin teks dari halaman responden, tempel di sini."
          onClick={() => setMetode('teks')} />
        <PilihanCara ikon="dokumen" judul="Unggah PDF"
          keterangan="Microsoft 365, Google Form yang diekspor jadi PDF, atau dokumen soal lain. Dibaca AI."
          onClick={() => setMetode('pdf')} />
      </div>
    </Dialog>
  )
}
