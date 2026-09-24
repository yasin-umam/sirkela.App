import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { supabase } from '../../lib/supabase'
import { jamMenit, labelWaktu } from '../../lib/soal'
import { Ikon } from '../../components/ui/Ikon'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { statusSesi } from './SesiPage'

// ─── Tab Riwayat ─────────────────────────────────────────────────────────────
// Arsip semua yang pernah dibuat guru, dengan bentuk yang sama dengan
// RiwayatPage Luang: bilah putih di puncak, pil penyaring di bawahnya, lalu
// satu daftar kartu.
//
// Dua pil, bukan satu daftar campur: formulir dan sesi memang dua benda yang
// berbeda umurnya. Formulir hidup terus dan disunting berkali-kali; sesi lahir
// sekali saat Kirim, punya kode sendiri, lalu selesai. Menggabungkannya di satu
// daftar berurutan waktu membuat guru harus membaca tiap baris dulu untuk tahu
// mana yang bisa ia sunting.

type Pil = 'formulir' | 'sesi'

export function RiwayatPage({ onBukaFormulir, onBukaSesi }: {
  onBukaFormulir: (formulirId: string) => void
  onBukaSesi: (sesiId: string) => void
}) {
  const { user } = useAuth()
  const { daftar, memuat } = useFormulir()
  const { semuaSesi } = useSesi()
  const [pil, setPil] = useState<Pil>('formulir')
  // Formulir yang PERNAH dikirim ke sebuah Super Sesi -- cuma penanda ringan,
  // bukan status penuh (itu ada di layar kepala sekolah). super_sesi_soal_guru_select
  // sudah menyaring ke kiriman milik guru ini sendiri.
  const [superSesiKirim, setSuperSesiKirim] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    let batal = false
    void supabase.from('super_sesi_soal').select('formulir_id').eq('guru_mapel_id', user.id)
      .then(({ data }) => {
        if (batal) return
        setSuperSesiKirim(new Set(
          ((data ?? []) as { formulir_id: string | null }[]).map(r => r.formulir_id).filter((id): id is string => !!id)
        ))
      })
    return () => { batal = true }
  }, [user])

  const berjalan = new Set(
    semuaSesi.filter(s => s.status === 'aktif').map(s => s.formulirId).filter((id): id is string => !!id)
  )

  const PIL: { id: Pil; label: string; jumlah: number }[] = [
    { id: 'formulir', label: 'Formulir', jumlah: daftar.length },
    { id: 'sesi', label: 'Sesi', jumlah: semuaSesi.length },
  ]

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="bg-white border-b border-slate-100 px-4 h-12 flex items-center shrink-0 shadow-sm">
        <span className="text-sm font-bold text-slate-800">Riwayat</span>
      </div>

      <div className="h-2 bg-slate-50 shrink-0" />

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 pb-24">
        <div className="flex gap-2 pt-4 pb-3">
          {PIL.map(p => {
            const nyala = pil === p.id
            return (
              <button key={p.id} type="button" onClick={() => setPil(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  nyala ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 active:bg-slate-50'}`}>
                {p.label}
                <span className={nyala ? 'text-indigo-200' : 'text-slate-300'}> {p.jumlah}</span>
              </button>
            )
          })}
        </div>

        {pil === 'formulir' ? (
          memuat && daftar.length === 0 ? (
            <div className="py-16 flex justify-center text-indigo-500"><Spinner size={26} /></div>
          ) : daftar.length === 0 ? (
            <Kosong ikon="soal" judul="Belum ada formulir"
              pesan="Formulir yang kamu tulis atau impor muncul di sini." />
          ) : (
            <div className="flex flex-col gap-2">
              {daftar.map(f => (
                <button key={f.id} type="button" onClick={() => onBukaFormulir(f.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm active:bg-slate-50 transition-colors">
                  <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                    <Ikon nama="dokumen" className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">
                      {f.judul.trim() || 'Formulir tanpa judul'}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {f.jumlahSoal} pertanyaan · {labelWaktu(f.diperbaruiPada)}
                    </span>
                  </span>
                  {berjalan.has(f.id) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Ada sesi yang sedang dibuka" />
                  )}
                  {superSesiKirim.has(f.id) && (
                    <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" title="Pernah dikirim ke Super Sesi" />
                  )}
                  <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
                </button>
              ))}
            </div>
          )
        ) : semuaSesi.length === 0 ? (
          <Kosong ikon="sesi" judul="Belum ada sesi"
            pesan="Buka formulirmu lalu tekan Kirim. Sesi lahir dengan kodenya sendiri." />
        ) : (
          <div className="flex flex-col gap-2">
            {semuaSesi.map(s => {
              const st = statusSesi(s)
              return (
                <button key={s.id} type="button" onClick={() => onBukaSesi(s.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm active:bg-slate-50 transition-colors">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    s.status === 'aktif' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Ikon nama="sesi" className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{s.judul}</span>
                    <span className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 font-mono">{s.kodeJoin}</span>
                      <Badge warna={st.warna}>{st.label}</Badge>
                      <span className="text-[10px] text-slate-400">{s.muridJoined.length} murid</span>
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {labelWaktu(s.dibuatPada)} {jamMenit(s.dibuatPada)}
                      {/* Sesi yatim tidak bisa lagi dibuka dari formulirnya --
                          baris ini satu-satunya jalan ke nilainya, jadi
                          keadaannya dikatakan. */}
                      {!s.formulirId && <span className="text-slate-300"> · formulir dihapus</span>}
                    </span>
                  </span>
                  <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Kosong({ ikon, judul, pesan }: { ikon: 'soal' | 'sesi'; judul: string; pesan: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
        <Ikon nama={ikon} className="w-8 h-8 text-indigo-300" tebal={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-600">{judul}</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">{pesan}</p>
      </div>
    </div>
  )
}
