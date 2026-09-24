import { useEffect, useState } from 'react'
import type { SuperSesi } from '../../types'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { useKembali } from '../../context/NavContext'
import { labelWaktu } from '../../lib/soal'
import { Ikon } from '../../components/ui/Ikon'
import { Badge } from '../../components/ui/Badge'
import { DialogBuatSuperSesi } from '../kepsek/DialogBuatSuperSesi'
import { DetailSuperSesi } from '../kepsek/DetailSuperSesi'

// ─── Layar Super Sesi (takeover dari kartu Super Sesi di Menu) ───────────────
// Dulu ini KepsekHome, layar penuh TERPISAH dengan bilah aplikasinya sendiri
// (logo + badge peran + tombol keluar) karena kepala sekolah dapat AppScreen
// sendiri. Sejak kepala sekolah pindah berbagi GuruHome dengan guru (2026-09-24,
// lihat NavContext), isinya dipindah ke sini dengan bilah kepala pola SesiPage
// (panah kembali + judul) -- bilah aplikasi & tombol keluar lama sudah
// berlebih, GuruHome sudah menyediakan keduanya (tab Saya).

function statusBadge(s: SuperSesi['status']): { label: string; warna: 'hijau' | 'kuning' | 'slate' } {
  if (s === 'selesai') return { label: 'Selesai', warna: 'slate' }
  if (s === 'berjalan') return { label: 'Berjalan', warna: 'hijau' }
  return { label: 'Mengumpulkan', warna: 'kuning' }
}

export function SuperSesiPage({ onKeluar, onLayarPenuh }: {
  onKeluar: () => void
  /** true selama satu Super Sesi difokuskan -- bilah tab bawah disembunyikan. */
  onLayarPenuh: (v: boolean) => void
}) {
  const { semuaSuperSesi, memuat, fokus, fokuskan } = useSuperSesi()
  const [membuat, setMembuat] = useState(false)

  useEffect(() => {
    onLayarPenuh(!!fokus)
    return () => onLayarPenuh(false)
  }, [fokus, onLayarPenuh])

  useKembali(() => {
    if (membuat) { setMembuat(false); return true }
    if (fokus) { fokuskan(null); return true }
    onKeluar()
    return true
  })

  if (fokus) return <DetailSuperSesi superSesi={fokus} onKembali={() => fokuskan(null)} />

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="px-2 py-1 flex items-center gap-2 shrink-0 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <button type="button" aria-label="Kembali" onClick={onKeluar}
          className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
          <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
        </button>
        <Ikon nama="sesi" className="w-4.5 h-4.5 text-indigo-600" />
        <span className="text-sm font-semibold text-slate-700">Super Sesi</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 pb-24">
        <div className="flex flex-col gap-4 pt-4 desktop:max-w-2xl desktop:mx-auto">
          <p className="text-xs text-slate-500 leading-relaxed">
            Kumpulkan soal ulangan dari guru mapel, tugaskan pengawas per kelas, lalu mulai serentak.
          </p>

          <button type="button" onClick={() => setMembuat(true)}
            className="w-full bg-linear-to-br from-indigo-600 to-indigo-700 active:from-indigo-700 active:to-indigo-800 rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-colors shadow-lg shadow-indigo-200/70">
            <span className="w-10 h-10 rounded-xl bg-white/20 border border-white/20 text-white flex items-center justify-center shrink-0">
              <Ikon nama="tambah" className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Buat Super Sesi</p>
              <p className="text-[11px] text-indigo-200">Ulangan baru untuk dikumpulkan dari guru mapel</p>
            </div>
            <Ikon nama="kanan" className="w-4 h-4 text-indigo-300 shrink-0" tebal={2} />
          </button>

          {memuat && semuaSuperSesi.length === 0 ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : semuaSuperSesi.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Ikon nama="sesi" className="w-8 h-8 text-indigo-300" tebal={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Belum ada Super Sesi</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Buat satu, lalu bagikan ke guru mapel supaya mereka bisa mengirim soal ulangan ke sini.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {semuaSuperSesi.map(s => {
                const st = statusBadge(s.status)
                return (
                  <button key={s.id} type="button" onClick={() => fokuskan(s.id)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm active:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Ikon nama="sesi" className="w-5 h-5" tebal={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.judul}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge warna={st.warna}>{st.label}</Badge>
                        <span className="text-[10px] text-slate-400">{labelWaktu(s.dibuatPada)}</span>
                      </div>
                    </div>
                    <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {membuat && (
        <DialogBuatSuperSesi onTutup={() => setMembuat(false)}
          onDibuat={id => { setMembuat(false); fokuskan(id) }} />
      )}
    </div>
  )
}
