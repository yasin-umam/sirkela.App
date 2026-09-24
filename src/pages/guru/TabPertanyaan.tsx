import { useCallback, useEffect, useState } from 'react'
import type { Soal } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { JUDUL_BAWAAN, masalahFormulir } from '../../lib/soal'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { TeksOtomatis } from '../../components/ui/TeksOtomatis'
import { KartuPertanyaan } from './KartuPertanyaan'

// ─── Tab Pertanyaan: editor formulir ─────────────────────────────────────────
// Satu kartu aktif sekaligus. Pertanyaan baru disisipkan TEPAT di bawah kartu
// yang aktif (bukan di ujung) dan langsung jadi aktif -- pola yang sudah ada
// sejak versi Google Form dan tidak ada alasan mengubahnya: guru yang menyadari
// ada soal terlewat menyisipkannya di tempatnya, bukan di akhir lalu menggeser.
//
// Yang berubah 2026-09-22 cuma wujudnya: kartu Luang (sudut 16px, bayangan
// halus) menggantikan kartu Google Form, dan kartu yang sedang disunting
// ditandai CINCIN indigo, bukan lagi garis biru di tepi kirinya.

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
    return <div className="py-20 flex justify-center text-indigo-500"><Spinner size={28} /></div>
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
  const masalahForm = masalahFormulir(aktif)

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 desktop:py-6 flex flex-col gap-3">
      {/* ── Kartu kepala: judul, kelas, mapel & deskripsi ── */}
      <div onClick={() => setFokus('kepala')}
        className={`bg-white rounded-2xl border shadow-sm px-4 py-4 flex flex-col gap-1 transition-shadow ${
          kepalaAktif ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100'}`}>
        <TeksOtomatis value={aktif.judul} placeholder="Judul formulir" aria-label="Judul formulir"
          onChange={e => ubahFormulir({ judul: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
          onBlur={() => { if (!aktif.judul.trim()) ubahFormulir({ judul: JUDUL_BAWAAN }) }}
          className="w-full resize-none bg-transparent py-1 text-lg font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-bold outline-none" />
        <div className="flex gap-2 mt-0.5">
          <input value={aktif.kelas} placeholder="Kelas" aria-label="Kelas"
            onChange={e => ubahFormulir({ kelas: e.target.value })}
            className="min-w-0 flex-1 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none border border-slate-200 focus:border-indigo-400 transition-colors" />
          <input value={aktif.mapel} placeholder="Mapel" aria-label="Mata pelajaran"
            onChange={e => ubahFormulir({ mapel: e.target.value })}
            className="min-w-0 flex-1 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none border border-slate-200 focus:border-indigo-400 transition-colors" />
        </div>
        <TeksOtomatis value={aktif.deskripsi} placeholder="Deskripsi (opsional), dibaca murid sebelum mulai"
          aria-label="Deskripsi formulir"
          onChange={e => ubahFormulir({ deskripsi: e.target.value })}
          className="w-full resize-none bg-transparent py-1 mt-1 text-sm text-slate-600 placeholder:text-slate-400 outline-none" />
        {masalahForm && (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <Ikon nama="galat" className="w-3.5 h-3.5 shrink-0" />
            {masalahForm.charAt(0).toUpperCase() + masalahForm.slice(1)} (wajib sebelum Simpan)
          </p>
        )}
      </div>

      {/* A6 dikatakan di tempat guru mengedit, bukan di dokumentasi. */}
      {berjalan.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Ikon nama="sesi" className="w-5 h-5 text-emerald-600 mt-0.5" />
          <p className="text-xs text-emerald-900 leading-relaxed">
            Sesi <strong className="font-mono font-bold">{berjalan.map(s => s.kodeJoin).join(', ')}</strong> sedang
            dibuka. Perubahan di sini tidak mengubah soal yang sedang dikerjakan murid. Tekan Kirim lagi untuk sesi baru.
          </p>
        </div>
      )}

      {soal.map((s, i) => (
        <KartuPertanyaan
          key={s.id}
          nomor={i + 1}
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
        <div className="border-2 border-dashed border-slate-200 rounded-2xl px-5 py-10 flex flex-col items-center gap-3 text-center">
          <Ikon nama="soal" className="w-8 h-8 text-slate-300" tebal={1.5} />
          <p className="text-sm font-semibold text-slate-500">Formulir ini belum punya pertanyaan</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={tambah}><Ikon nama="tambah" className="w-4 h-4" />Tambah pertanyaan</Button>
            <Button size="sm" variant="secondary" onClick={onImpor}><Ikon nama="impor" className="w-4 h-4" />Impor soal</Button>
          </div>
        </div>
      )}

      {/* Bilah alat mengambang: menempel di bawah saat menggulir. Di layar lebar
          tegak di KANAN kolom; di HP mendatar di tengah -- di pojok kanan ia
          menutupi tombol hapus kartu yang sedang disunting. Tulis manual (pena)
          dan Impor soal bersebelahan di sini -- dua cara sama-sama menambah
          pertanyaan, jadi tombolnya bertetangga alih-alih Impor sendirian di
          menu titik-tiga header.
          Disembunyikan selama formulir masih kosong: tombol "Tambah pertanyaan"/
          "Impor soal" di kartu kosong di atas sudah cukup, dua pasang tombol
          yang sama-sama terlihat cuma bikin bingung. Muncul lagi begitu ada
          soal pertama. */}
      {soal.length > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center min-[900px]:justify-end pointer-events-none min-[900px]:-mr-16">
          <div className="pointer-events-auto flex min-[900px]:flex-col bg-white rounded-2xl border border-slate-100 shadow-lg p-1">
            <TombolIkon nama="pensil" label="Tulis pertanyaan" onClick={tambah} ukuran="w-5.5 h-5.5" />
            <TombolIkon nama="gabung" label="Impor soal" onClick={onImpor} ukuran="w-5.5 h-5.5" />
          </div>
        </div>
      )}

      {urungkan && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 flex items-center gap-3 rounded-xl bg-slate-800 pl-4 pr-2 py-2 text-sm font-medium text-white shadow-lg">
          Pertanyaan dihapus
          <button type="button" onClick={pulihkan} className="px-2.5 py-1.5 rounded-lg font-bold text-indigo-300 hover:bg-white/10">
            Urungkan
          </button>
        </div>
      )}
    </div>
  )
}
