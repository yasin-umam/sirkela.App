import { useState } from 'react'
import type { Soal } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { uraikanTempelan } from '../../lib/tempelSoal'
import { imporPdf } from '../../lib/imporPdf'
import { generateSoal, MAKS_JUMLAH_SOAL, MAKS_PANJANG_TOPIK, type Kesulitan } from '../../lib/generateSoal'
import { buatUuid } from '../../lib/soal'
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
      className="w-full bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 active:bg-slate-50 active:scale-[0.99] transition-all flex items-center gap-3.5 p-4 text-left">
      <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <Ikon nama={ikon} className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-700">{judul}</span>
        <span className="block text-xs text-slate-400 mt-0.5 leading-snug">{keterangan}</span>
      </span>
    </button>
  )
}

const JUMLAH_CEPAT = [5, 10, 15, 20]
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
  const [metode, setMetode] = useState<Metode | null>(metodeAwal ?? null)
  const [teks, setTeks] = useState('')
  const [berkas, setBerkas] = useState<File | null>(null)
  const [mengonversi, setMengonversi] = useState(false)
  const [topik, setTopik] = useState('')
  const [jumlah, setJumlah] = useState(5)
  const [kesulitan, setKesulitan] = useState<Kesulitan>('sedang')
  const [draf, setDraf] = useState<Soal[] | null>(null)
  const [dilewati, setDilewati] = useState<{ alasan: string; jumlah: number }[]>([])
  const [fokusDraf, setFokusDraf] = useState<string | null>(null)
  const [gulirDraf, setGulirDraf] = useState<{ id: string; cara: 'fokus' | 'lihat' } | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  function terimaHasil(soal: { pertanyaan: string; pilihan: string[]; jawabanBenar: number | null }[], dilewatiBaru: { alasan: string; jumlah: number }[]) {
    setDraf(soal.map((s, i): Soal => ({ id: buatUuid(), formulirId: '', pertanyaan: s.pertanyaan, pilihan: s.pilihan, jawabanBenar: s.jawabanBenar, urutan: i })))
    setDilewati(dilewatiBaru)
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
      const r = await generateSoal(topik, jumlah, kesulitan)
      terimaHasil(r.soal, r.dilewati)
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
    setDraf(d => [...(d ?? []), { id, formulirId: '', pertanyaan: '', pilihan: ['Opsi 1', 'Opsi 2'], jawabanBenar: null, urutan: d?.length ?? 0 }])
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
            <>Betulkan kalau ada yang salah dibaca, lalu periksa <strong className="font-semibold text-slate-700">Kunci
              jawaban</strong> tiap soal. Tebakan AI belum tentu benar.</>
          ) : metode === 'ai' ? (
            <>Betulkan kalau ada yang kurang pas, lalu periksa <strong className="font-semibold text-slate-700">Kunci
              jawaban</strong> tiap soal. AI menulis kuncinya sendiri, tapi bisa salah hitung atau salah fakta.</>
          ) : (
            <>Betulkan kalau ada yang salah pisah, lalu tandai <strong className="font-semibold text-slate-700">Kunci
              jawaban</strong> tiap soal. Teks tempelan tidak pernah membawa kuncinya.</>
          )}
        </p>
        {dilewati.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
        {galat && <p className="mt-3 text-sm text-red-600">{galat}</p>}
      </Dialog>
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
        <p>
          AI menulis soal pilihan ganda dari topik yang kamu tentukan. Beda dari Impor PDF, di sini AI
          MENGARANG soal baru, bukan membaca dokumen yang sudah ada. Periksa kuncinya di layar berikutnya.
        </p>
        <label className="block mt-4 text-sm font-semibold text-slate-700">Topik atau materi</label>
        <textarea value={topik} onChange={e => { setTopik(e.target.value); setGalat(null) }} autoFocus rows={3}
          maxLength={MAKS_PANJANG_TOPIK}
          placeholder="Contoh: Perkalian pecahan untuk kelas 5 SD"
          className="mt-1.5 w-full resize-y py-2.5 px-3 bg-slate-50 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 outline-none border border-slate-200 focus:border-indigo-400 transition-colors" />

        <label className="block mt-4 text-sm font-semibold text-slate-700">Jumlah soal</label>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {JUMLAH_CEPAT.map(n => (
            <button key={n} type="button" onClick={() => setJumlah(n)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                jumlah === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
              {n}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-400 shrink-0">Atau isi manual</span>
          <input type="number" inputMode="numeric" min={1} max={MAKS_JUMLAH_SOAL} value={jumlah}
            onChange={e => setJumlah(Math.min(MAKS_JUMLAH_SOAL, Math.max(1, Number(e.target.value) || 1)))}
            onWheel={e => e.currentTarget.blur()}
            className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-right text-slate-800 outline-none focus:border-indigo-400" />
          <span className="text-xs text-slate-400">soal</span>
        </label>

        <label className="block mt-4 text-sm font-semibold text-slate-700">Tingkat kesulitan</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {KESULITAN.map(k => (
            <button key={k.id} type="button" onClick={() => setKesulitan(k.id)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                kesulitan === k.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
              {k.label}
            </button>
          ))}
        </div>

        {mengonversi && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Spinner size={16} />Menulis {jumlah} soal dengan AI, bisa sampai satu menit…
          </p>
        )}
        {galat && <p className="mt-3 text-sm text-red-600">{galat}</p>}
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
        <p>
          Unggah PDF berisi soal pilihan ganda dari Microsoft 365, Google Form yang diekspor jadi PDF, atau
          dokumen lain. AI yang membacanya di server; kunci jawaban tetap kamu yang menandai di layar berikutnya.
        </p>
        <label className={`mt-4 flex flex-col items-center justify-center gap-2 h-36 rounded-2xl border-2 border-dashed transition-colors px-4 text-center ${
          mengonversi ? 'border-slate-200' : 'border-slate-200 hover:border-indigo-400 cursor-pointer'}`}>
          <Ikon nama="dokumen" className="w-8 h-8 text-indigo-500" tebal={1.5} />
          <span className="text-sm font-medium text-slate-700 break-all">{berkas ? berkas.name : 'Pilih berkas PDF'}</span>
          {berkas && <span className="text-xs text-slate-400">{(berkas.size / 1024 / 1024).toFixed(1)} MB</span>}
          <input type="file" accept="application/pdf" className="hidden" disabled={mengonversi}
            onChange={e => { setBerkas(e.target.files?.[0] ?? null); setGalat(null) }} />
        </label>
        {mengonversi && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Spinner size={16} />Membaca PDF dengan AI, bisa sampai satu menit…
          </p>
        )}
        {galat && <p className="mt-3 text-sm text-red-600">{galat}</p>}
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
        <p>
          Buka Google Form-nya (link <strong className="font-semibold text-slate-700">responden</strong>, bukan edit), tekan{' '}
          <strong className="font-semibold text-slate-700">Ctrl+A</strong> lalu{' '}
          <strong className="font-semibold text-slate-700">Ctrl+C</strong>, dan tempel semuanya di sini. Pisahkan tiap
          soal dengan baris kosong: baris pertama pertanyaannya, baris-baris berikutnya pilihannya.
        </p>
        <textarea value={teks} onChange={e => { setTeks(e.target.value); setGalat(null) }} autoFocus rows={10}
          placeholder={'Contoh:\n\nSiapa presiden pertama Indonesia?\nSoekarno\nHatta\nSoeharto\n\nIbu kota Indonesia?\nJakarta\nBandung'}
          className="mt-4 w-full resize-y py-2.5 px-3 bg-slate-50 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 outline-none border border-slate-200 focus:border-indigo-400 transition-colors" />
        <p className="mt-3 text-xs">Kunci jawaban tidak ikut tersalin dari Google Form. Kamu menandainya sendiri di layar berikutnya.</p>
        {galat && <p className="mt-3 text-sm text-red-600">{galat}</p>}
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
