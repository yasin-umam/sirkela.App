import { useCallback, useEffect, useState } from 'react'
import type { Soal } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { TeksOtomatis } from '../../components/ui/TeksOtomatis'
import { KartuPertanyaan } from './KartuPertanyaan'

// ─── Tab Pertanyaan: editor formulir ─────────────────────────────────────────
// Satu kartu aktif sekaligus. Pertanyaan baru disisipkan TEPAT di bawah kartu
// yang aktif (bukan di ujung) dan langsung jadi aktif -- pola Google Form.

const JUDUL_BAWAAN = 'Formulir tanpa judul'

export interface PermintaanSorot {
  soalId: string
  /** Berubah tiap permintaan, supaya menyorot soal yang sama dua kali tetap menggulir. */
  kali: number
}

export function TabPertanyaan({ sorot, onImpor }: {
  /** Dari dialog Kirim yang menolak: gulir ke soal ini & tandai semua masalah. */
  sorot: PermintaanSorot | null
  onImpor: () => void
}) {
  const { aktif, soal, memuatSoal, ubahFormulir, tambahSoal, ubahSoal, hapusSoal, duplikatSoal, pindahSoal } = useFormulir()
  const { semuaSesi } = useSesi()
  const [fokus, setFokus] = useState<string | null>(null)
  const [gulir, setGulir] = useState<{ id: string; cara: 'fokus' | 'lihat' } | null>(null)
  const [tandaiMasalah, setTandaiMasalah] = useState(false)
  const [urungkan, setUrungkan] = useState<{ soal: Soal; posisi: number } | null>(null)

  useEffect(() => {
    if (!sorot) return
    setFokus(sorot.soalId)
    setGulir({ id: sorot.soalId, cara: 'lihat' })
    setTandaiMasalah(true)
  }, [sorot])

  useEffect(() => {
    if (!urungkan) return
    const t = setTimeout(() => setUrungkan(null), 6000)
    return () => clearTimeout(t)
  }, [urungkan])

  const gulirSelesai = useCallback(() => setGulir(null), [])

  if (!aktif) return null
  if (memuatSoal) {
    return <div className="py-20 flex justify-center text-indigo-600"><Spinner size={28} /></div>
  }

  const berjalan = semuaSesi.filter(s => s.formulirId === aktif.id && s.status === 'aktif')

  function tambah() {
    const i = soal.findIndex(s => s.id === fokus)
    const id = tambahSoal(i === -1 ? soal.length : i + 1)
    setFokus(id)
    setGulir({ id, cara: 'fokus' })
  }

  function hapus(id: string) {
    const i = soal.findIndex(s => s.id === id)
    const dihapus = hapusSoal(id)
    if (!dihapus) return
    setUrungkan(dihapus)
    const tetangga = soal[i - 1] ?? soal[i + 1]
    setFokus(tetangga?.id ?? 'kepala')
  }

  function duplikat(id: string) {
    const baru = duplikatSoal(id)
    if (!baru) return
    setFokus(baru)
    setGulir({ id: baru, cara: 'lihat' })
  }

  function pulihkan() {
    if (!urungkan) return
    // Id yang sama: delete-nya sudah lebih dulu di antrean, insert ini menyusul.
    tambahSoal(urungkan.posisi, urungkan.soal, urungkan.soal.id)
    setFokus(urungkan.soal.id)
    setGulir({ id: urungkan.soal.id, cara: 'lihat' })
    setUrungkan(null)
  }

  const kepalaAktif = fokus === 'kepala'

  return (
    <div className="max-w-192.5 mx-auto px-3 py-3 desktop:py-6 flex flex-col gap-3">
      {/* ── Kartu kepala: judul & deskripsi ── */}
      <div onClick={() => setFokus('kepala')}
        className={`relative bg-white rounded-lg border border-garis overflow-hidden ${kepalaAktif ? 'shadow-md' : ''}`}>
        <div className="h-2.5 bg-indigo-600" />
        {kepalaAktif && <div className="absolute left-0 top-2.5 bottom-0 w-1.5 bg-fokus" />}
        <div className="px-5 desktop:px-6 pt-4 pb-5 flex flex-col gap-1">
          <TeksOtomatis value={aktif.judul} placeholder="Judul formulir" aria-label="Judul formulir"
            onChange={e => ubahFormulir({ judul: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
            onBlur={() => { if (!aktif.judul.trim()) ubahFormulir({ judul: JUDUL_BAWAAN }) }}
            className="w-full resize-none bg-transparent py-1 text-[28px] leading-tight text-teks outline-none border-b border-transparent hover:border-garis focus:border-b-2 focus:border-indigo-600" />
          <TeksOtomatis value={aktif.deskripsi} placeholder="Deskripsi formulir" aria-label="Deskripsi formulir"
            onChange={e => ubahFormulir({ deskripsi: e.target.value })}
            className="w-full resize-none bg-transparent py-1.5 text-sm text-teks placeholder:text-teks-2 outline-none border-b border-transparent hover:border-garis focus:border-b-2 focus:border-indigo-600" />
        </div>
      </div>

      {/* A6 dikatakan di tempat guru mengedit, bukan di dokumentasi. */}
      {berjalan.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-garis bg-white px-5 py-3">
          <Ikon nama="kirim" className="w-5 h-5 text-indigo-600 mt-0.5" />
          <p className="text-sm text-teks-2 leading-relaxed">
            Sesi <strong className="font-mono font-medium text-teks">{berjalan.map(s => s.kodeJoin).join(', ')}</strong> sedang
            dibuka. Perubahan di sini tidak mengubah soal yang sedang dikerjakan murid — tekan Kirim lagi untuk sesi baru.
          </p>
        </div>
      )}

      {soal.map((s, i) => (
        <KartuPertanyaan
          key={s.id}
          soal={s}
          aktif={fokus === s.id}
          gulir={gulir?.id === s.id ? gulir.cara : null}
          tandaiMasalah={tandaiMasalah}
          bisaNaik={i > 0}
          bisaTurun={i < soal.length - 1}
          onAktifkan={() => setFokus(s.id)}
          onGulirSelesai={gulirSelesai}
          onUbah={ubahan => ubahSoal(s.id, ubahan)}
          onDuplikat={() => duplikat(s.id)}
          onHapus={() => hapus(s.id)}
          onNaik={() => { pindahSoal(s.id, -1); setGulir({ id: s.id, cara: 'lihat' }) }}
          onTurun={() => { pindahSoal(s.id, 1); setGulir({ id: s.id, cara: 'lihat' }) }}
        />
      ))}

      {soal.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-garis px-5 py-10 flex flex-col items-center gap-4 text-center">
          <p className="text-base text-teks">Formulir ini belum punya pertanyaan</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={tambah}><Ikon nama="tambah" className="w-5 h-5" />Tambah pertanyaan</Button>
            <Button variant="secondary" onClick={onImpor}><Ikon nama="impor" className="w-5 h-5" />Impor soal</Button>
          </div>
        </div>
      )}

      {/* Bilah alat mengambang: menempel di bawah saat menggulir. Di layar lebar
          tegak di KANAN kolom seperti Google Form; di HP mendatar di tengah --
          di pojok kanan ia menutupi tombol hapus kartu yang sedang disunting. */}
      <div className="sticky bottom-3 z-20 flex justify-center min-[900px]:justify-end pointer-events-none min-[900px]:-mr-16">
        <div className="pointer-events-auto flex min-[900px]:flex-col bg-white rounded-lg border border-garis shadow-md p-1">
          <TombolIkon nama="tambahLingkar" label="Tambah pertanyaan" onClick={tambah} />
          <TombolIkon nama="impor" label="Impor soal" onClick={onImpor} />
        </div>
      </div>

      {urungkan && (
        <div className="fixed left-4 bottom-4 z-40 flex items-center gap-4 rounded bg-[#323232] pl-4 pr-2 py-2 text-sm text-white shadow-lg">
          Pertanyaan dihapus
          <button type="button" onClick={pulihkan} className="px-2 py-1.5 rounded font-medium text-indigo-300 hover:bg-white/10">
            Urungkan
          </button>
        </div>
      )}
    </div>
  )
}
