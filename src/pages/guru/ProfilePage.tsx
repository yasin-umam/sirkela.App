import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { useKembali } from '../../context/NavContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { NAMA_APLIKASI } from '../../lib/aplikasi'

// ─── Tab Saya ────────────────────────────────────────────────────────────────
// Bentuknya mengikuti ProfilePage Luang: kartu profil di puncak, lalu grup baris
// berlabel di dalam kartu putih. Isinya dipangkas ke apa yang aplikasi ini
// benar-benar punya -- tidak ada kredit, paket, referral, notifikasi, mode
// malam, atau hapus akun; semuanya memang tidak ikut disalin dari Luang.
//
// Ini juga rumah yang disiapkan untuk SETELAN OTORISASI (siapa boleh membuka
// dan menilai sesi milik siapa) yang akan dibangun menyusul. Barisnya sudah
// ada dan sengaja ditandai belum aktif, bukan disembunyikan: tempatnya sudah
// diputuskan, isinya yang belum.

type SubHalaman = 'akun' | null

function GrupBaris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow className="px-1">{label}</Eyebrow>
      <div className="bg-white rounded-[18px] border border-garis overflow-clip divide-y divide-garis-2">
        {children}
      </div>
    </div>
  )
}

function Baris({ ikon, label, keterangan, kanan, onClick, bahaya, redup }: {
  ikon: NamaIkon
  label: string
  keterangan?: string
  kanan?: ReactNode
  onClick?: () => void
  bahaya?: boolean
  redup?: boolean
}) {
  const isi = (
    <>
      <Ikon nama={ikon} className={`w-4.5 h-4.5 shrink-0 ${
        bahaya ? 'text-jingga' : redup ? 'text-pinggir-2' : 'text-teks-3'}`} />
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-bold ${
          bahaya ? 'text-jingga-gelap' : redup ? 'text-teks-3' : 'text-tinta'}`}>{label}</span>
        {keterangan && <span className="block text-[13px] text-teks-3 mt-0.5 leading-snug">{keterangan}</span>}
      </span>
      {kanan}
    </>
  )
  const kelas = 'w-full flex items-center gap-3 px-4 py-3.5 min-h-14 text-left transition-colors'
  if (!onClick) return <div className={kelas}>{isi}</div>
  return <button type="button" onClick={onClick} className={`${kelas} active:bg-isian`}>{isi}</button>
}

function Chevron() {
  return <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
}

export function ProfilePage({ onKeluar, onLayarPenuh }: {
  onKeluar: () => void
  /** Sub-halaman Akun Saya terbuka -- bilah tab bawah ikut disembunyikan,
   *  sama pola dengan navHidden di Luang. */
  onLayarPenuh: (v: boolean) => void
}) {
  const { user } = useAuth()
  const { daftar } = useFormulir()
  const { semuaSesi } = useSesi()
  const [sub, setSub] = useState<SubHalaman>(null)
  useEffect(() => {
    onLayarPenuh(sub !== null)
    return () => onLayarPenuh(false)
  }, [sub, onLayarPenuh])

  useKembali(() => {
    if (!sub) return false
    setSub(null)
    return true
  })

  if (sub === 'akun') return <AkunSaya onKembali={() => setSub(null)} />

  const totalSoal = daftar.reduce((n, f) => n + f.jumlahSoal, 0)

  return (
    <div className="flex flex-col h-full bg-alas">
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-5 pt-6 pb-28 flex flex-col gap-4 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <div>
          <Eyebrow className="text-[11px]">{NAMA_APLIKASI}</Eyebrow>
          <h1 className="mt-1 text-[34px] leading-tight font-extrabold tracking-tight text-tinta">Saya</h1>
        </div>

        {/* Kartu profil -- diketuk untuk membuka Akun Saya. */}
        <button type="button" onClick={() => setSub('akun')}
          className="bg-white rounded-[18px] border border-garis px-4 py-3.5 flex items-center gap-3 text-left active:bg-isian transition-colors">
          <span className="w-12 h-12 rounded-[14px] bg-tinta text-white flex items-center justify-center text-lg font-extrabold shrink-0">
            {(user?.nama ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-extrabold tracking-tight text-tinta truncate">{user?.nama}</p>
            <p className="text-[13px] text-teks-3 truncate">{user?.email}</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-biru-tint text-biru shrink-0">
            {user?.role === 'kepala_sekolah' ? 'Kepala sekolah' : 'Guru'}
          </span>
          <Chevron />
        </button>

        {/* Angka, bukan hiasan: guru yang baru masuk di perangkat lain memakai
            ini untuk memastikan akunnya benar sebelum menulis apa pun. */}
        <div className="grid grid-cols-3 gap-2">
          {([
            ['Formulir', daftar.length],
            ['Pertanyaan', totalSoal],
            ['Sesi', semuaSesi.length],
          ] as const).map(([label, n]) => (
            <div key={label} className="bg-white rounded-[18px] border border-garis py-3.5 text-center">
              <p className="text-[28px] font-extrabold tracking-tight leading-tight text-tinta">{n}</p>
              <p className="text-[12.5px] text-teks-3 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <GrupBaris label="Akun">
          <Baris ikon="setelan" label="Akun Saya" kanan={<Chevron />} onClick={() => setSub('akun')} />
          <Baris ikon="surat" label="Email" keterangan={user?.email}
            kanan={<span className="text-xs text-teks-3 shrink-0">tidak bisa diubah</span>} />
        </GrupBaris>

        <GrupBaris label="Akses">
          <Baris ikon="perisai" label="Setelan otorisasi" redup
            keterangan="Siapa boleh membuka dan menilai sesi milikmu. Belum dibangun, akan muncul di sini."
            kanan={<span className="text-xs font-bold text-tinta-2 bg-garis-2 px-2.5 py-1 rounded-full shrink-0">Segera</span>} />
        </GrupBaris>

        <GrupBaris label="Lainnya">
          <Baris ikon="keluar" label="Keluar" bahaya onClick={onKeluar} />
        </GrupBaris>

        <p className="text-center text-xs text-teks-3 pt-2">{NAMA_APLIKASI}</p>
      </div>
    </div>
  )
}

// ─── Akun Saya (sub-halaman layar penuh) ─────────────────────────────────────

function AkunSaya({ onKembali }: { onKembali: () => void }) {
  const { user, updateNama } = useAuth()
  const [nama, setNama] = useState(user?.nama ?? '')
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [tersimpan, setTersimpan] = useState(false)

  const berubah = nama.trim() !== (user?.nama ?? '').trim() && nama.trim() !== ''

  async function simpan() {
    setMenyimpan(true); setGalat(null)
    const err = await updateNama(nama)
    setMenyimpan(false)
    if (err) { setGalat(err); return }
    setTersimpan(true)
    setTimeout(() => setTersimpan(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-alas">
      <div className="h-14 pl-1.5 pr-4 flex items-center gap-1 shrink-0 bg-white border-b border-garis">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 transition-colors">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <span className="text-base font-bold text-tinta">Akun Saya</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 flex flex-col gap-3">
        <div className="bg-white rounded-2xl border border-garis p-4 flex flex-col gap-3">
          <Input label="Nama" value={nama} onChange={e => { setNama(e.target.value); setGalat(null) }}
            autoComplete="name" placeholder="Nama yang dilihat muridmu" />
          <p className="text-[11px] text-teks-3 -mt-1">
            Nama ini muncul di daftar hasil dan pesan bagikan sesi.
          </p>
          {galat && <p className="text-xs text-jingga-gelap">{galat}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!berubah || menyimpan} onClick={() => void simpan()}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
            {tersimpan && <span className="text-xs font-medium text-hijau">Tersimpan</span>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-garis p-4">
          <p className="text-sm font-semibold text-tinta">Email</p>
          <p className="text-sm text-teks-3 mt-1">{user?.email}</p>
          <p className="text-[11px] text-teks-3 mt-2 leading-relaxed">
            Email dipakai untuk masuk dan mengatur ulang password. Mengubahnya belum didukung.
          </p>
        </div>
      </div>
    </div>
  )
}
