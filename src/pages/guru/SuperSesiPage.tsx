import { useEffect, useState } from 'react'
import type { SuperSesi } from '../../types'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { useKembali } from '../../context/NavContext'
import { labelWaktu } from '../../lib/soal'
import { Ikon } from '../../components/ui/Ikon'
import { Badge, type WarnaBadge } from '../../components/ui/Badge'
import { DialogBuatSuperSesi } from '../kepsek/DialogBuatSuperSesi'
import { DetailSuperSesi } from '../kepsek/DetailSuperSesi'

// ─── Layar Super Sesi (takeover dari kartu Super Sesi di Menu) ───────────────
// Dulu ini KepsekHome, layar penuh TERPISAH dengan bilah aplikasinya sendiri
// (logo + badge peran + tombol keluar) karena kepala sekolah dapat AppScreen
// sendiri. Sejak kepala sekolah pindah berbagi GuruHome dengan guru (2026-09-24,
// lihat NavContext), isinya dipindah ke sini dengan bilah kepala pola SesiPage
// (panah kembali + judul) -- bilah aplikasi & tombol keluar lama sudah
// berlebih, GuruHome sudah menyediakan keduanya (tab Saya).

function statusBadge(s: SuperSesi['status']): { label: string; warna: WarnaBadge } {
  if (s === 'selesai') return { label: 'Selesai', warna: 'slate' }
  if (s === 'berjalan') return { label: 'Berjalan', warna: 'hijau' }
  return { label: 'Mengumpulkan', warna: 'biru' }
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
    <div className="flex flex-col h-full bg-alas">
      <div className="h-14 pl-1.5 pr-4 flex items-center gap-1 shrink-0 bg-white border-b border-garis lg:hidden">
        <button type="button" aria-label="Kembali" onClick={onKeluar}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 transition-colors">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <span className="text-base font-bold text-tinta">Super Sesi</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 pb-24">
        <div className="flex flex-col gap-4 pt-4 desktop:max-w-2xl desktop:mx-auto lg:max-w-6xl lg:px-12 lg:pt-10 lg:gap-6">
          <div className="hidden lg:block">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-teks-3">Kepala sekolah</p>
            <h1 className="mt-2 text-[38px] leading-tight font-extrabold tracking-tight text-tinta">Super Sesi</h1>
          </div>
          <p className="text-[13.5px] text-tinta-2 leading-relaxed px-1">
            Kumpulkan soal ulangan dari guru mapel, lalu mulai serentak. Kelasnya bisa diambil guru mana pun
            di sekolahmu, dan kamu mengawasi semua kelas dari sini.
          </p>

          <button type="button" onClick={() => setMembuat(true)}
            className="w-full lg:max-w-xl bg-biru active:bg-biru-gelap rounded-[18px] p-4 lg:p-5 flex items-center gap-3.5 text-left transition-colors">
            <span className="w-11.5 h-11.5 rounded-[13px] bg-white/18 text-white flex items-center justify-center shrink-0">
              <Ikon nama="tambah" className="w-6 h-6" tebal={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-extrabold tracking-tight text-white">Buat Super Sesi</p>
              <p className="text-[13px] text-biru-muda mt-0.5">Ulangan baru untuk dikumpulkan dari guru mapel</p>
            </div>
            <Ikon nama="kanan" className="w-4.5 h-4.5 text-biru-muda shrink-0" tebal={2.2} />
          </button>

          {memuat && semuaSuperSesi.length === 0 ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-biru-muda border-t-biru rounded-full animate-spin" />
            </div>
          ) : semuaSuperSesi.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
              <div className="w-16 h-16 rounded-2xl bg-biru-tint flex items-center justify-center">
                <Ikon nama="perisai" className="w-8 h-8 text-biru" tebal={1.5} />
              </div>
              <div>
                <p className="text-[15px] font-bold text-tinta">Belum ada Super Sesi</p>
                <p className="text-[13px] text-teks-3 mt-1 max-w-xs leading-relaxed">
                  Buat satu, lalu bagikan ke guru mapel supaya mereka bisa mengirim soal ulangan ke sini.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[18px] border border-garis overflow-hidden divide-y divide-garis-2">
              {semuaSuperSesi.map(s => {
                const st = statusBadge(s.status)
                return (
                  <button key={s.id} type="button" onClick={() => fokuskan(s.id)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3.5 active:bg-isian transition-colors">
                    <div className="w-11 h-11 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
                      <Ikon nama="perisai" className="w-5.5 h-5.5" tebal={1.8} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                      <p className="text-[15px] font-bold leading-snug text-tinta break-words">{s.judul}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge warna={st.warna} titik={s.status === 'berjalan'}>{st.label}</Badge>
                        <span className="text-xs text-teks-3">{labelWaktu(s.dibuatPada)}</span>
                      </div>
                    </div>
                    <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
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
