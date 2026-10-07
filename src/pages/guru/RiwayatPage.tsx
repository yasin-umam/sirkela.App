import { useState } from 'react'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { jamMenit, labelWaktu } from '../../lib/soal'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { sesiBisaDihapus, statusSesi } from '../../lib/keadaanSesi'
import { useDesktop } from '../../lib/useDesktop'
import { useKirimanSuper } from '../../lib/useKirimanSuper'
import { Ikon } from '../../components/ui/Ikon'
import { Spinner } from '../../components/ui/Spinner'
import { KonfirmasiHapus } from '../../components/KonfirmasiHapus'
import { Badge } from '../../components/ui/Badge'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { RiwayatDesktop } from './RiwayatDesktop'

// ─── Tab Riwayat (HP) ────────────────────────────────────────────────────────
// Arsip semua yang pernah dibuat guru: judul besar, dua pil, lalu SATU kartu
// daftar berpemisah (bukan tumpukan kartu terpisah). Baris bertumpuk.
// DESKTOP (≥ 1024px) dialihkan ke RiwayatDesktop: tabel + panel detail dengan
// pencarian -- strukturnya terlalu beda untuk dijadikan satu markup responsif.
//
// Dua pil, bukan satu daftar campur: formulir dan sesi memang dua benda yang
// berbeda umurnya. Formulir hidup terus dan disunting berkali-kali; sesi lahir
// sekali saat Kirim, punya kode sendiri, lalu selesai. Menggabungkannya di satu
// daftar berurutan waktu membuat guru harus membaca tiap baris dulu untuk tahu
// mana yang bisa ia sunting.

type Pil = 'formulir' | 'sesi'

// Hapus riwayat (H1/H2): formulir kapan pun; sesi lewat sesiBisaDihapus() (lib/keadaanSesi).
type TargetHapus =
  | { jenis: 'formulir'; id: string; judul: string; jumlahSoal: number }
  | { jenis: 'sesi'; id: string; judul: string; kode: string; jumlahMurid: number }

/** Sel di kanan baris (bukan di dalam tombol baris: tombol tak boleh bersarang). */
function SelHapus({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="w-12 shrink-0 border-l border-garis-2 flex items-center justify-center text-teks-3 hover:bg-jingga-tint hover:text-jingga-gelap active:bg-jingga-tint active:text-jingga-gelap transition-colors">
      <Ikon nama="hapus" className="w-4.5 h-4.5" />
    </button>
  )
}

function Chevron() {
  return <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
}

export function RiwayatPage({ onBukaFormulir, onBukaSesi }: {
  onBukaFormulir: (formulirId: string) => void
  onBukaSesi: (sesiId: string) => void
}) {
  const desktop = useDesktop()
  return desktop
    ? <RiwayatDesktop onBukaFormulir={onBukaFormulir} onBukaSesi={onBukaSesi} />
    : <RiwayatHp onBukaFormulir={onBukaFormulir} onBukaSesi={onBukaSesi} />
}

function RiwayatHp({ onBukaFormulir, onBukaSesi }: {
  onBukaFormulir: (formulirId: string) => void
  onBukaSesi: (sesiId: string) => void
}) {
  const { daftar, memuat, hapusFormulir } = useFormulir()
  const { semuaSesi, hapusSesi } = useSesi()
  const [pil, setPil] = useState<Pil>('formulir')
  const [hapus, setHapus] = useState<TargetHapus | null>(null)
  // Formulir yang PERNAH dikirim ke sebuah Super Sesi -- cuma penanda ringan,
  // bukan status penuh (itu ada di layar kepala sekolah).
  const superSesiKirim = useKirimanSuper()

  const berjalan = new Set(
    semuaSesi.filter(s => s.status === 'aktif').map(s => s.formulirId).filter((id): id is string => !!id)
  )

  const PIL: { id: Pil; label: string; jumlah: number }[] = [
    { id: 'formulir', label: 'Formulir', jumlah: daftar.length },
    { id: 'sesi', label: 'Sesi', jumlah: semuaSesi.length },
  ]

  return (
    <div className="flex flex-col h-full bg-alas">
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-5 pb-28 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <div className="pt-6 pb-4">
          <Eyebrow className="text-[11px]">{NAMA_APLIKASI}</Eyebrow>
          <h1 className="mt-1 text-[34px] leading-tight font-extrabold tracking-tight text-tinta">Riwayat</h1>
        </div>

        <div className="bg-garis rounded-[14px] p-1 flex gap-1">
          {PIL.map(p => {
            const nyala = pil === p.id
            return (
              <button key={p.id} type="button" onClick={() => setPil(p.id)} aria-pressed={nyala}
                className={`flex-1 h-10.5 rounded-[11px] text-sm font-bold transition-colors ${
                  nyala ? 'bg-tinta text-white' : 'text-tinta-2 active:bg-garis-2'}`}>
                {p.label}
                <span className={`ml-1.5 font-medium ${nyala ? 'text-biru-muda' : 'text-teks-3'}`}>{p.jumlah}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          {pil === 'formulir' ? (
            memuat && daftar.length === 0 ? (
              <div className="py-16 flex justify-center text-biru"><Spinner size={26} /></div>
            ) : daftar.length === 0 ? (
              <Kosong ikon="soal" judul="Belum ada formulir"
                pesan="Formulir yang kamu tulis atau impor muncul di sini." />
            ) : (
              <div className="bg-white rounded-[18px] border border-garis overflow-hidden divide-y divide-garis-2">
                {daftar.map(f => (
                  <div key={f.id} className="flex items-stretch">
                  <button type="button" onClick={() => onBukaFormulir(f.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3.5 active:bg-isian transition-colors">
                    <span className="w-11 h-11 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
                      <Ikon nama="dokumen" className="w-5.5 h-5.5" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                      <span className="text-[15px] font-bold leading-snug text-tinta break-words">
                        {f.judul.trim() || 'Formulir tanpa judul'}
                      </span>
                      <span className="text-[13px] text-teks-3">
                        {f.jumlahSoal} pertanyaan · {labelWaktu(f.diperbaruiPada)}
                      </span>
                      {(berjalan.has(f.id) || superSesiKirim.has(f.id)) && (
                        <span className="flex flex-wrap gap-1.5 mt-1">
                          {berjalan.has(f.id) && <Badge warna="hijau" titik>Berjalan</Badge>}
                          {superSesiKirim.has(f.id) && <Badge warna="biru">Super Sesi</Badge>}
                        </span>
                      )}
                    </span>
                    <Chevron />
                  </button>
                  <SelHapus label={`Hapus formulir ${f.judul.trim() || 'tanpa judul'}`}
                    onClick={() => setHapus({ jenis: 'formulir', id: f.id, judul: f.judul.trim() || 'Formulir tanpa judul', jumlahSoal: f.jumlahSoal })} />
                  </div>
                ))}
              </div>
            )
          ) : semuaSesi.length === 0 ? (
            <Kosong ikon="sesi" judul="Belum ada sesi"
              pesan="Buka formulirmu lalu tekan Kirim. Sesi lahir dengan kodenya sendiri." />
          ) : (
            <div className="bg-white rounded-[18px] border border-garis overflow-hidden divide-y divide-garis-2">
              {semuaSesi.map(s => {
                const st = statusSesi(s)
                return (
                  <div key={s.id} className="flex items-stretch">
                  <button type="button" onClick={() => onBukaSesi(s.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3.5 active:bg-isian transition-colors">
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      s.status === 'aktif' ? 'bg-hijau-tint text-hijau' : 'bg-garis-2 text-teks-3'}`}>
                      <Ikon nama="sesi" className="w-5.5 h-5.5" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                      <span className="text-[15px] font-bold leading-snug text-tinta break-words">{s.judul}</span>
                      <span className="text-[13px] text-teks-3">
                        <span className="font-mono">{s.kodeJoin}</span> · {s.muridJoined.length} murid
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <Badge warna={st.warna} titik={st.label === 'Berjalan'}>{st.label}</Badge>
                        <span className="text-xs text-teks-3">
                          {labelWaktu(s.dibuatPada)} {jamMenit(s.dibuatPada)}
                          {!s.formulirId && ' · formulir dihapus'}
                        </span>
                      </span>
                    </span>
                    <Chevron />
                  </button>
                  {sesiBisaDihapus(s) && (
                    <SelHapus label={`Hapus sesi ${s.judul}`}
                      onClick={() => setHapus({ jenis: 'sesi', id: s.id, judul: s.judul, kode: s.kodeJoin, jumlahMurid: s.muridJoined.length })} />
                  )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {hapus && (
        <KonfirmasiHapus
          judul={hapus.jenis === 'formulir' ? 'Hapus formulir ini?' : 'Hapus sesi ini?'}
          pesan={hapus.jenis === 'formulir' ? (
            <>
              “{hapus.judul}” dan {hapus.jumlahSoal} pertanyaannya dihapus. Sesi yang sudah lahir dari formulir ini tetap ada.
              <strong className="block mt-3 text-tinta">Tidak bisa dibatalkan.</strong>
            </>
          ) : (
            <>
              “{hapus.judul}” (kode {hapus.kode}) dihapus bersama {hapus.jumlahMurid} murid yang bergabung, jawaban, dan nilainya.
              <strong className="block mt-3 text-tinta">Tidak bisa dibatalkan.</strong>
            </>
          )}
          onHapus={() => hapus.jenis === 'formulir' ? hapusFormulir(hapus.id) : hapusSesi(hapus.id)}
          onTutup={() => setHapus(null)} />
      )}
    </div>
  )
}

function Kosong({ ikon, judul, pesan }: { ikon: 'soal' | 'sesi'; judul: string; pesan: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-biru-tint flex items-center justify-center">
        <Ikon nama={ikon} className="w-8 h-8 text-biru" tebal={1.5} />
      </div>
      <div>
        <p className="text-[15px] font-bold text-tinta">{judul}</p>
        <p className="text-[13px] text-teks-3 mt-1 max-w-xs leading-relaxed">{pesan}</p>
      </div>
    </div>
  )
}
