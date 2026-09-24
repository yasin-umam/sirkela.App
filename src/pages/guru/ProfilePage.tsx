import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { StatusPengajuanKepsek } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { useKembali } from '../../context/NavContext'
import { EMAIL_ADMIN_UTAMA, ajukanKepalaSekolah, ambilPengajuanSaya, sekolahPunyaKepsek } from '../../lib/admin'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { labelWaktu } from '../../lib/soal'

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
      <p className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-clip divide-y divide-slate-100">
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
        bahaya ? 'text-red-400' : redup ? 'text-slate-300' : 'text-slate-400'}`} />
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium ${
          bahaya ? 'text-red-500' : redup ? 'text-slate-400' : 'text-slate-700'}`}>{label}</span>
        {keterangan && <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">{keterangan}</span>}
      </span>
      {kanan}
    </>
  )
  const kelas = 'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors'
  if (!onClick) return <div className={kelas}>{isi}</div>
  return <button type="button" onClick={onClick} className={`${kelas} active:bg-slate-50`}>{isi}</button>
}

function Chevron() {
  return <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
}

export function ProfilePage({ onKeluar, onLayarPenuh, onBukaAdmin }: {
  onKeluar: () => void
  /** Sub-halaman Akun Saya terbuka -- bilah tab bawah ikut disembunyikan,
   *  sama pola dengan navHidden di Luang. */
  onLayarPenuh: (v: boolean) => void
  /** Layar Admin hidup di GuruHome (cabang terpisah, sama pola dengan editor)
   *  -- baris "Admin" di bawah cuma pintu KEDUA ke situ, pintu pertama ada di
   *  pintasan header MenuPage. Satu state di GuruHome, bukan dua. */
  onBukaAdmin: () => void
}) {
  const { user } = useAuth()
  const { daftar } = useFormulir()
  const { semuaSesi } = useSesi()
  const [sub, setSub] = useState<SubHalaman>(null)
  const [statusPengajuan, setStatusPengajuan] = useState<StatusPengajuanKepsek | null>(null)
  const [mengajukan, setMengajukan] = useState(false)
  const [galatPengajuan, setGalatPengajuan] = useState<string | null>(null)
  // Bawaan `true`: sebelum RPC-nya selesai dimuat, ajakan "Ajukan jadi Kepala
  // Sekolah" TIDAK kelihatan sekilas lalu hilang lagi kalau ternyata sekolahnya
  // sudah terisi -- lebih baik telat muncul daripada berkedip.
  const [sekolahAdaKepsek, setSekolahAdaKepsek] = useState(true)

  useEffect(() => {
    onLayarPenuh(sub !== null)
    return () => onLayarPenuh(false)
  }, [sub, onLayarPenuh])

  useKembali(() => {
    if (!sub) return false
    setSub(null)
    return true
  })

  useEffect(() => {
    if (!user) return
    let batal = false
    void ambilPengajuanSaya(user.id).then(s => { if (!batal) setStatusPengajuan(s) })
    void sekolahPunyaKepsek().then(v => { if (!batal) setSekolahAdaKepsek(v) })
    return () => { batal = true }
  }, [user])

  async function ajukan() {
    setMengajukan(true); setGalatPengajuan(null)
    try {
      await ajukanKepalaSekolah()
      setStatusPengajuan({ status: 'menunggu', dibuatPada: new Date().toISOString() })
    } catch (e) {
      setGalatPengajuan(e instanceof Error ? e.message : 'Gagal mengajukan. Coba lagi.')
    } finally {
      setMengajukan(false)
    }
  }

  if (sub === 'akun') return <AkunSaya onKembali={() => setSub(null)} />

  const totalSoal = daftar.reduce((n, f) => n + f.jumlahSoal, 0)

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="bg-white border-b border-slate-100 px-4 h-12 flex items-center shrink-0 shadow-sm">
        <span className="text-sm font-bold text-slate-800">Saya</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 pt-4 pb-24 flex flex-col gap-3">
        {/* Kartu profil -- diketuk untuk membuka Akun Saya. */}
        <button type="button" onClick={() => setSub('akun')}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 text-left active:bg-slate-50 transition-colors">
          <span className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {(user?.nama ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.nama}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 shrink-0">Guru</span>
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
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm py-3 text-center">
              <p className="text-lg font-bold text-slate-800 tabular-nums">{n}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <GrupBaris label="Akun">
          <Baris ikon="setelan" label="Akun Saya" kanan={<Chevron />} onClick={() => setSub('akun')} />
          <Baris ikon="surat" label="Email" keterangan={user?.email}
            kanan={<span className="text-[11px] text-slate-300 shrink-0">tidak bisa diubah</span>} />
        </GrupBaris>

        <GrupBaris label="Akses">
          <Baris ikon="perisai" label="Setelan otorisasi" redup
            keterangan="Siapa boleh membuka dan menilai sesi milikmu. Belum dibangun, akan muncul di sini."
            kanan={<span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">Segera</span>} />
        </GrupBaris>

        {/* Swadaya: guru mengajukan diri, admin tunggal yang menyetujui (lihat
            grup Admin di bawah, cuma tampil untuk satu email tertentu) --
            promosi manual lewat SQL editor tetap ada sebagai jalur cadangan.
            Ajakan "Ajukan..." disembunyikan begitu sekolahnya SUDAH punya
            kepala_sekolah (satu sekolah = satu kepala sekolah) -- tapi
            pengajuan yang masih menunggu atau sudah disetujui MILIK GURU INI
            SENDIRI tetap tampil, itu bukan ajakan baru. Server (RPC
            ajukan_kepala_sekolah/putuskan_pengajuan_kepsek) menolak juga kalau
            ini dilewati lewat REST mentah -- ini cuma soal tampilan. */}
        {(sekolahAdaKepsek ? statusPengajuan?.status === 'menunggu' || statusPengajuan?.status === 'disetujui' : true) && (
          <GrupBaris label="Kepala Sekolah">
            {!statusPengajuan || statusPengajuan.status === 'ditolak' ? (
              <Baris ikon="perisai" label={mengajukan ? 'Mengajukan…' : 'Ajukan jadi Kepala Sekolah'}
                keterangan={statusPengajuan?.status === 'ditolak'
                  ? 'Pengajuan sebelumnya ditolak, boleh coba lagi'
                  : 'Kumpulkan & distribusikan soal ulangan lintas guru lewat Super Sesi'}
                onClick={mengajukan ? undefined : () => void ajukan()} kanan={<Chevron />} />
            ) : statusPengajuan.status === 'menunggu' ? (
              <Baris ikon="jam" label="Menunggu persetujuan admin" redup
                keterangan={`Diajukan ${labelWaktu(statusPengajuan.dibuatPada).toLowerCase()}`} />
            ) : (
              <Baris ikon="centangLingkar" label="Disetujui jadi Kepala Sekolah"
                keterangan="Keluar lalu masuk lagi untuk melihat kartu Super Sesi di Menu" />
            )}
            {galatPengajuan && <p className="px-4 pb-3 -mt-1 text-xs text-red-600">{galatPengajuan}</p>}
          </GrupBaris>
        )}

        {user?.email === EMAIL_ADMIN_UTAMA && (
          <GrupBaris label="Admin">
            <Baris ikon="perisai" label="Admin"
              keterangan="Setujui pengajuan kepala sekolah, kelola sekolah"
              kanan={<Chevron />} onClick={onBukaAdmin} />
          </GrupBaris>
        )}

        <GrupBaris label="Lainnya">
          <Baris ikon="keluar" label="Keluar" bahaya onClick={onKeluar} />
        </GrupBaris>

        <p className="text-center text-[11px] text-slate-300 pt-2">{NAMA_APLIKASI}</p>
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
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="px-2 py-1 flex items-center gap-2 shrink-0">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
          <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
        </button>
        <span className="text-sm font-semibold text-slate-700">Akun Saya</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 flex flex-col gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
          <Input label="Nama" value={nama} onChange={e => { setNama(e.target.value); setGalat(null) }}
            autoComplete="name" placeholder="Nama yang dilihat muridmu" />
          <p className="text-[11px] text-slate-400 -mt-1">
            Nama ini muncul di daftar hasil dan pesan bagikan sesi.
          </p>
          {galat && <p className="text-xs text-red-600">{galat}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!berubah || menyimpan} onClick={() => void simpan()}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
            {tersimpan && <span className="text-xs font-medium text-emerald-600">Tersimpan</span>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-slate-700">Email</p>
          <p className="text-sm text-slate-500 mt-1">{user?.email}</p>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Email dipakai untuk masuk dan mengatur ulang password. Mengubahnya belum didukung.
          </p>
        </div>
      </div>
    </div>
  )
}
