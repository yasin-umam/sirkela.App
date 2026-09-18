import { useState } from 'react'
import type { Soal } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { uraikanTempelan } from '../../lib/tempelSoal'
import { imporPdf } from '../../lib/imporPdf'
import { buatUuid } from '../../lib/soal'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { Spinner } from '../../components/ui/Spinner'
import { KartuPertanyaan } from './KartuPertanyaan'

// ─── Impor soal dari luar aplikasi ────────────────────────────────────────────
// Dua CARA, dipilih guru di layar pertama:
//   teks -- tempel teks dari halaman RESPONDEN Google Form (Ctrl+A, Ctrl+C).
//           Tanpa OAuth, tanpa API apa pun -- lihat tempelSoal.ts.
//   pdf  -- unggah PDF (ekspor Microsoft 365, Google Form, atau dokumen soal
//           lain); dibaca AI di SERVER lewat Edge Function impor-pdf, supaya
//           kunci OpenRouter tidak pernah ke klien -- lihat lib/imporPdf.ts.
//
// Kunci jawaban TIDAK PERNAH dipercaya dari kedua cara (teks tidak pernah
// membawanya sama sekali; tebakan AI dari PDF belum tentu benar) -- makanya
// layar Tinjau di bawah berupa kartu KartuPertanyaan yang BISA disunting
// penuh, bukan cuma daftar ringkas: guru membetulkan blok yang salah pisah
// atau salah baca, dan menandai kuncinya di situ, sebelum apa pun ditulis ke
// database.

export function DialogImpor({ tujuan, onTutup, onSelesai }: {
  /** 'baru' = jadi formulir sendiri; 'ini' = ditambahkan ke akhir formulir aktif. */
  tujuan: 'baru' | 'ini'
  onTutup: () => void
  onSelesai: (jumlah: number) => void
}) {
  const { buatFormulir, imporSoal } = useFormulir()
  const [metode, setMetode] = useState<'teks' | 'pdf' | null>(null)
  const [teks, setTeks] = useState('')
  const [berkas, setBerkas] = useState<File | null>(null)
  const [mengonversi, setMengonversi] = useState(false)
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
          <Button variant="teks" onClick={() => { setDraf(null); setGalat(null) }} disabled={menyimpan}>Kembali</Button>
          <Button onClick={() => void impor()} disabled={menyimpan || n === 0}>
            {menyimpan ? 'Mengimpor…' : `Impor ${n} pertanyaan`}
          </Button>
        </>}>
        <p>
          {metode === 'pdf' ? (
            <>Betulkan kalau ada yang salah dibaca, lalu periksa <strong className="font-medium text-teks">Kunci jawaban</strong> tiap
              soal — tebakan AI belum tentu benar.</>
          ) : (
            <>Betulkan kalau ada yang salah pisah, lalu tandai <strong className="font-medium text-teks">Kunci jawaban</strong> tiap
              soal — teks tempelan tidak pernah membawa kuncinya.</>
          )}
        </p>
        {dilewati.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs">
            <Ikon nama="galat" className="w-4 h-4 shrink-0 mt-0.5" />
            Dilewati: {dilewati.map(d => `${d.jumlah} blok ${d.alasan}`).join(', ')}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {draf.map((s, i) => (
            <KartuPertanyaan
              key={s.id}
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
        <Button variant="secondary" onClick={tambahDraf} className="mt-3">
          <Ikon nama="tambah" className="w-5 h-5" />Tambah pertanyaan
        </Button>
        {galat && <p className="mt-3 text-sm text-salah">{galat}</p>}
      </Dialog>
    )
  }

  // ── Layar: unggah PDF ──
  if (metode === 'pdf') {
    return (
      <Dialog judul="Unggah PDF soal" onTutup={mengonversi ? undefined : onTutup} lebar="max-w-lg"
        aksi={<>
          <Button variant="teks" onClick={() => { setMetode(null); setBerkas(null); setGalat(null) }} disabled={mengonversi}>Kembali</Button>
          <Button onClick={() => void konversiPdf()} disabled={!berkas || mengonversi}>
            {mengonversi ? 'Membaca dengan AI…' : 'Lanjut'}
          </Button>
        </>}>
        <p>
          Unggah PDF berisi soal pilihan ganda — dari Microsoft 365, Google Form yang diekspor jadi PDF, atau
          dokumen lain. AI yang membacanya di server; kunci jawaban tetap kamu yang menandai di layar berikutnya.
        </p>
        <label className={`mt-4 flex flex-col items-center justify-center gap-2 h-36 rounded-lg border-2 border-dashed transition-colors px-4 text-center ${
          mengonversi ? 'border-garis' : 'border-garis hover:border-indigo-600 cursor-pointer'}`}>
          <Ikon nama="dokumen" className="w-9 h-9 text-indigo-600" />
          <span className="text-sm text-teks break-all">{berkas ? berkas.name : 'Pilih berkas PDF'}</span>
          {berkas && <span className="text-xs text-teks-2">{(berkas.size / 1024 / 1024).toFixed(1)} MB</span>}
          <input type="file" accept="application/pdf" className="hidden" disabled={mengonversi}
            onChange={e => { setBerkas(e.target.files?.[0] ?? null); setGalat(null) }} />
        </label>
        {mengonversi && (
          <p className="mt-3 flex items-center gap-2 text-sm text-teks-2"><Spinner size={16} />Membaca PDF dengan AI, bisa sampai satu menit…</p>
        )}
        {galat && <p className="mt-3 text-sm text-salah">{galat}</p>}
      </Dialog>
    )
  }

  // ── Layar: tempel teks ──
  if (metode === 'teks') {
    return (
      <Dialog judul="Tempel soal dari Google Form" onTutup={onTutup} lebar="max-w-lg"
        aksi={<>
          <Button variant="teks" onClick={() => setMetode(null)}>Kembali</Button>
          <Button onClick={uraikan} disabled={!teks.trim()}>Lanjut</Button>
        </>}>
        <p>
          Buka Google Form-nya (link <strong className="font-medium text-teks">responden</strong>, bukan edit), tekan{' '}
          <strong className="font-medium text-teks">Ctrl+A</strong> lalu <strong className="font-medium text-teks">Ctrl+C</strong>,
          dan tempel semuanya di sini. Pisahkan tiap soal dengan baris kosong: baris pertama pertanyaannya, baris-baris
          berikutnya pilihannya.
        </p>
        <textarea value={teks} onChange={e => { setTeks(e.target.value); setGalat(null) }} autoFocus rows={10}
          placeholder={'Contoh:\n\nSiapa presiden pertama Indonesia?\nSoekarno\nHatta\nSoeharto\n\nIbu kota Indonesia?\nJakarta\nBandung'}
          className="mt-4 w-full resize-y py-2 px-3 bg-isian rounded-md text-sm text-teks placeholder:text-teks-2 outline-none border border-transparent focus:border-fokus" />
        <p className="mt-3 text-xs">Kunci jawaban tidak ikut tersalin dari Google Form — kamu menandainya sendiri di layar berikutnya.</p>
        {galat && <p className="mt-3 text-sm text-salah">{galat}</p>}
      </Dialog>
    )
  }

  // ── Layar awal: pilih cara impor ──
  return (
    <Dialog judul="Impor soal" onTutup={onTutup} lebar="max-w-md"
      aksi={<Button variant="teks" onClick={onTutup}>Batal</Button>}>
      <p>Pilih cara mengambil soal dari luar aplikasi ini.</p>
      <div className="mt-4 flex flex-col gap-3">
        <button type="button" onClick={() => setMetode('teks')}
          className="bg-white rounded-lg border border-garis hover:border-indigo-600 transition-colors flex items-center gap-4 p-4 text-left">
          <Ikon nama="impor" className="w-8 h-8 text-indigo-600 shrink-0" />
          <span>
            <span className="block text-sm font-medium text-teks">Tempel dari Google Form</span>
            <span className="block text-xs text-teks-2 mt-0.5">Salin teks dari halaman responden, tempel di sini.</span>
          </span>
        </button>
        <button type="button" onClick={() => setMetode('pdf')}
          className="bg-white rounded-lg border border-garis hover:border-indigo-600 transition-colors flex items-center gap-4 p-4 text-left">
          <Ikon nama="dokumen" className="w-8 h-8 text-indigo-600 shrink-0" />
          <span>
            <span className="block text-sm font-medium text-teks">Unggah PDF</span>
            <span className="block text-xs text-teks-2 mt-0.5">Microsoft 365, Google Form yang diekspor jadi PDF, atau dokumen soal lain. Dibaca AI.</span>
          </span>
        </button>
      </div>
    </Dialog>
  )
}
