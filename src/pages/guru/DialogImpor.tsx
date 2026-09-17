import { useState } from 'react'
import type { Soal } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { uraikanTempelan } from '../../lib/tempelSoal'
import { buatUuid } from '../../lib/soal'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { KartuPertanyaan } from './KartuPertanyaan'

// ─── Impor dari Google Form lewat tempel teks (tempelSoal.ts) ────────────────
// Tanpa OAuth, tanpa API, tanpa setup Google Cloud apa pun: guru menyalin teks
// dari halaman RESPONDEN Google Form (Ctrl+A, Ctrl+C) dan menempelnya di satu
// kotak. Kunci jawaban tidak pernah ikut tersalin (itu ikon, bukan teks) --
// makanya layar Tinjau di bawah berupa kartu KartuPertanyaan yang BISA
// disunting penuh, bukan cuma daftar ringkas: guru membetulkan blok yang salah
// pisah dan menandai kuncinya di situ, sebelum apa pun ditulis ke database.

export function DialogImpor({ tujuan, onTutup, onSelesai }: {
  /** 'baru' = jadi formulir sendiri; 'ini' = ditambahkan ke akhir formulir aktif. */
  tujuan: 'baru' | 'ini'
  onTutup: () => void
  onSelesai: (jumlah: number) => void
}) {
  const { buatFormulir, imporSoal } = useFormulir()
  const [teks, setTeks] = useState('')
  const [draf, setDraf] = useState<Soal[] | null>(null)
  const [dilewati, setDilewati] = useState<{ alasan: string; jumlah: number }[]>([])
  const [fokusDraf, setFokusDraf] = useState<string | null>(null)
  const [gulirDraf, setGulirDraf] = useState<{ id: string; cara: 'fokus' | 'lihat' } | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  function uraikan() {
    const r = uraikanTempelan(teks)
    if (r.soal.length === 0) {
      setGalat('Tidak ada pertanyaan yang terbaca. Pisahkan tiap soal dengan baris kosong, dan pastikan tiap soal punya minimal 2 pilihan di baris-baris berikutnya.')
      return
    }
    setGalat(null)
    setDraf(r.soal.map((s, i): Soal => ({ id: buatUuid(), formulirId: '', pertanyaan: s.pertanyaan, pilihan: s.pilihan, jawabanBenar: s.jawabanBenar, urutan: i })))
    setDilewati(r.dilewati)
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

  // ── Layar: tinjau hasil (kartu bisa disunting -- kuncinya belum ada) ──
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
          Betulkan kalau ada yang salah pisah, lalu tandai <strong className="font-medium text-teks">Kunci jawaban</strong> tiap
          soal — teks tempelan tidak pernah membawa kuncinya.
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

  // ── Layar awal: tempel teks ──
  return (
    <Dialog judul="Tempel soal dari Google Form" onTutup={onTutup} lebar="max-w-lg"
      aksi={<>
        <Button variant="teks" onClick={onTutup}>Batal</Button>
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
