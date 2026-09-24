import { useEffect, useState } from 'react'
import type { PengajuanKepsek, SekolahAdmin } from '../../types'
import { useKembali } from '../../context/NavContext'
import {
  ambilPengajuanKepsek, putuskanPengajuanKepsek, ambilSemuaSekolah, buatSekolah,
} from '../../lib/admin'
import { labelWaktu } from '../../lib/soal'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Dialog } from '../../components/ui/Dialog'

// ─── Admin (layar penuh, cuma tampil untuk satu email tertentu) ─────────────
// Cabang render TERPISAH di GuruHome (sama pola dengan EditorFormulir), bukan
// sub-halaman ProfilePage lagi -- dibuka lewat DUA pintu (pintasan header
// MenuPage untuk pemakaian sehari-hari, baris "Admin" di tab Saya sebagai
// cadangan), satu state `admin` di GuruHome. Gerbang SEBENARNYA tetap di
// server (adalah_admin_utama() di tiap RPC), sama prinsip dengan peran
// guru/murid/kepala_sekolah di seluruh app ini: UI cuma menyembunyikan,
// bukan mengamankan. Karena cabang terpisah, tombol kembalinya sendiri di
// sini (tidak ada `<Penjaga>` ProfilePage yang menanganinya lagi).
//
// Dua pil: Persetujuan (validasi pengajuan jadi kepala sekolah -- alasan
// utama layar ini dibuat) dan Sekolah (bikin baris `sekolah` baru + kodenya,
// supaya onboarding sekolah baru tidak lagi harus lewat SQL editor).

type Pil = 'persetujuan' | 'sekolah'

export function AdminPage({ onKembali }: { onKembali: () => void }) {
  const [pil, setPil] = useState<Pil>('persetujuan')

  useKembali(() => { onKembali(); return true })

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="px-2 py-1 flex items-center gap-2 shrink-0">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
          <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
        </button>
        <span className="text-sm font-semibold text-slate-700">Admin</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-3 pb-24 flex flex-col gap-4">
        <div className="flex gap-2">
          {([
            ['persetujuan', 'Persetujuan Kepala Sekolah'],
            ['sekolah', 'Sekolah'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPil(id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                pil === id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 active:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {pil === 'persetujuan' ? <PersetujuanKepsek /> : <DaftarSekolah />}
      </div>
    </div>
  )
}

// ─── Persetujuan Kepala Sekolah ───────────────────────────────────────────────

function PersetujuanKepsek() {
  const [daftar, setDaftar] = useState<PengajuanKepsek[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState<string | null>(null)

  async function muat() {
    try {
      setDaftar(await ambilPengajuanKepsek())
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar.')
    }
  }

  useEffect(() => { void muat() }, [])

  async function putuskan(id: string, setuju: boolean) {
    setMemproses(id); setGalat(null)
    try {
      await putuskanPengajuanKepsek(id, setuju)
      await muat()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memproses. Coba lagi.')
    } finally {
      setMemproses(null)
    }
  }

  const menunggu = daftar?.filter(p => p.status === 'menunggu') ?? []
  const riwayat = daftar?.filter(p => p.status !== 'menunggu') ?? []

  if (daftar === null) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {galat && <p className="text-sm text-red-600">{galat}</p>}

      <div>
        <p className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          Menunggu ({menunggu.length})
        </p>
        {menunggu.length === 0 ? (
          <p className="text-xs text-slate-400 px-1">Tidak ada pengajuan menunggu.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {menunggu.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.guruNama}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.sekolahNama} · {labelWaktu(p.dibuatPada)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled={memproses === p.id}
                    onClick={() => void putuskan(p.id, false)}>Tolak</Button>
                  <Button size="sm" disabled={memproses === p.id}
                    onClick={() => void putuskan(p.id, true)}>
                    {memproses === p.id ? 'Memproses…' : 'Setujui'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {riwayat.length > 0 && (
        <div>
          <p className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Riwayat</p>
          <div className="flex flex-col gap-2">
            {riwayat.map(p => (
              <div key={p.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.guruNama}</p>
                  <p className="text-xs text-slate-400 truncate">{p.sekolahNama}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  p.status === 'disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {p.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sekolah ──────────────────────────────────────────────────────────────────
// Onboarding sekolah baru TANPA SQL editor: admin bikin baris `sekolah` +
// kodenya di sini, lalu bagikan kodenya ke calon kepala sekolah/guru pertama
// sekolah itu supaya mereka bisa mendaftar (RegisterPage) dan mengajukan diri
// (lihat pil Persetujuan).

function DaftarSekolah() {
  const [daftar, setDaftar] = useState<SekolahAdmin[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [membuat, setMembuat] = useState(false)

  async function muat() {
    try {
      setDaftar(await ambilSemuaSekolah())
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar.')
    }
  }

  useEffect(() => { void muat() }, [])

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => setMembuat(true)} className="self-start">
        <Ikon nama="tambah" className="w-4 h-4" />Sekolah baru
      </Button>

      {galat && <p className="text-sm text-red-600">{galat}</p>}

      {daftar === null ? (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : daftar.length === 0 ? (
        <p className="text-xs text-slate-400 px-1">Belum ada sekolah. Buat satu supaya guru bisa mendaftar.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {daftar.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{s.nama}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 shrink-0">
                  {s.jumlahGuru} staf
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg">
                  {s.kodeSekolah}
                </span>
                <span className="text-[10px] text-slate-400">dibuat {labelWaktu(s.dibuatPada).toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {membuat && (
        <DialogBuatSekolah onTutup={() => setMembuat(false)}
          onDibuat={() => { setMembuat(false); void muat() }} />
      )}
    </div>
  )
}

function DialogBuatSekolah({ onTutup, onDibuat }: { onTutup: () => void; onDibuat: () => void }) {
  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function buat() {
    setSibuk(true); setGalat(null)
    try {
      await buatSekolah(nama.trim(), kode.trim())
      onDibuat()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat sekolah. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Dialog judul="Sekolah baru" onTutup={sibuk ? undefined : onTutup}
      aksi={<>
        <Button variant="ghost" onClick={onTutup} disabled={sibuk}>Batal</Button>
        <Button onClick={() => void buat()} disabled={sibuk}>{sibuk ? 'Membuat…' : 'Buat'}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        <Input label="Nama Sekolah" placeholder="mis. SMA Negeri 1 Contoh" value={nama}
          onChange={e => setNama(e.target.value)} autoFocus />
        <Input label="Kode Sekolah" placeholder="mis. SMA1-CONTOH" value={kode}
          onChange={e => setKode(e.target.value.toUpperCase())} />
        <p className="text-xs text-slate-400 -mt-2">
          Guru & kepala sekolah memakai kode ini di layar Daftar untuk terhubung ke sekolah ini.
        </p>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
      </div>
    </Dialog>
  )
}
