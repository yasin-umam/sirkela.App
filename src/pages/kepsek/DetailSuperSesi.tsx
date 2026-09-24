import { useState } from 'react'
import type { SuperSesi, SubmisiSuperSesi, MuridSuperSesi } from '../../types'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { useKembali } from '../../context/NavContext'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'

export function DetailSuperSesi({ superSesi, onKembali }: {
  superSesi: SuperSesi
  onKembali: () => void
}) {
  const { submisi, memuatSubmisi, mulaiSuperSesi } = useSuperSesi()
  const [konfirmasiMulai, setKonfirmasiMulai] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useKembali(() => {
    if (konfirmasiMulai) { if (!sibuk) setKonfirmasiMulai(false); return true }
    return false
  })

  const mengumpulkan = superSesi.status === 'mengumpulkan'
  // Tidak ada lagi pengecekan "semua kiriman sudah punya pengawas" -- sejak
  // klaim bebas, siapa yang mengawas ditentukan belakangan oleh guru sendiri.
  const belumAdaKiriman = !submisi || submisi.length === 0

  async function mulai() {
    setSibuk(true); setGalat(null)
    try {
      await mulaiSuperSesi(superSesi.id)
      setKonfirmasiMulai(false)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memulai. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="px-2 py-1 flex items-center gap-2 shrink-0">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
          <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
        </button>
        <span className="text-sm font-semibold text-slate-700 truncate">{superSesi.judul}</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 flex flex-col gap-4">
        <div className="rounded-2xl bg-linear-to-br from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-200 p-4">
          <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide">
            {mengumpulkan ? 'Mengumpulkan kiriman' : superSesi.status === 'berjalan' ? 'Sedang berjalan' : 'Selesai'}
          </p>
          <h3 className="font-bold text-lg mt-0.5 break-words">{superSesi.judul}</h3>
          {superSesi.deskripsi && <p className="text-indigo-100 text-sm mt-1">{superSesi.deskripsi}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <span className="text-sm font-semibold text-slate-700">Kiriman guru mapel</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              submisi && submisi.length > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              {submisi?.length ?? 0}
            </span>
          </div>

          {memuatSubmisi && submisi === null ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : !submisi || submisi.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6 text-center px-4">
              <Ikon nama="dokumen" className="w-8 h-8 text-slate-200" tebal={1.5} />
              <p className="text-xs text-slate-400">Belum ada guru mapel yang mengirim soal ke sini</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {submisi.map(s => <BarisSubmisi key={s.id} submisi={s} />)}
            </div>
          )}
        </div>

        {galat && <p className="text-sm text-red-600 px-1">{galat}</p>}

        {mengumpulkan && (
          <Button size="lg" fullWidth disabled={belumAdaKiriman} onClick={() => setKonfirmasiMulai(true)}>
            <Ikon nama="kirim" className="w-4 h-4" />Mulai Super Sesi
          </Button>
        )}
      </div>

      {konfirmasiMulai && (
        <LembarKonfirmasi
          judul="Mulai Super Sesi sekarang?"
          pesan="Soal akan didistribusikan jadi kelas yang bisa langsung diambil guru mana pun di sekolahmu -- siapa yang mengklaim duluan, dialah pengawasnya. Kiriman baru tidak lagi bisa masuk sesudah ini."
          labelAksi="Mulai"
          sibuk={sibuk}
          onAksi={() => void mulai()}
          onBatal={() => setKonfirmasiMulai(false)}
        />
      )}
    </div>
  )
}

function BarisSubmisi({ submisi }: { submisi: SubmisiSuperSesi }) {
  const [terbuka, setTerbuka] = useState(false)

  // Cuma sesi Super Sesi yang SUDAH lahir & masih berjalan yang punya sesuatu
  // untuk diawasi -- lihat SS2/K1 di CLAUDE.md.
  const bisaDiawasi = submisi.sesiId !== null && submisi.sesiStatus === 'aktif'
  const jumlahTerkunci = submisi.murid.filter(m => m.terkunciPada !== null).length

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <button type="button" disabled={!bisaDiawasi} onClick={() => setTerbuka(v => !v)}
        className="w-full flex items-center gap-3 text-left disabled:cursor-default">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Ikon nama="soal" className="w-4.5 h-4.5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">
            {submisi.mapel || submisi.judul}{submisi.kelas && <span className="text-slate-400 font-normal"> · {submisi.kelas}</span>}
          </p>
          <p className="text-[11px] text-slate-400">Dikirim oleh {submisi.guruMapelNama}</p>
        </div>
        {submisi.sesiId ? (
          submisi.pengawasId ? (
            <Badge warna={submisi.sesiStatus === 'aktif' ? 'hijau' : 'slate'}>
              {submisi.sesiStatus === 'aktif' ? 'Berjalan' : 'Selesai'}
            </Badge>
          ) : (
            <Badge warna="kuning">Menunggu diklaim</Badge>
          )
        ) : (
          <Badge warna="slate">Menunggu dimulai</Badge>
        )}
        {bisaDiawasi && (
          <Ikon nama={terbuka ? 'bawah' : 'kanan'} className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
        )}
      </button>

      {submisi.sesiId && (
        <div className="ml-12 flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
          <span>Pengawas: {submisi.pengawasNama ?? 'menunggu guru mengklaim'}</span>
          {submisi.kodeJoin && <span className="font-mono text-indigo-500">· {submisi.kodeJoin}</span>}
          <span>· {submisi.jumlahMurid} murid</span>
          {jumlahTerkunci > 0 && (
            <span className="font-bold text-amber-700">· {jumlahTerkunci} terkunci</span>
          )}
        </div>
      )}

      {bisaDiawasi && terbuka && <PengawasanKelas submisi={submisi} />}
    </div>
  )
}

// ─── Pengawasan satu kelas (murid keluar/terkunci) ───────────────────────────
// Wewenang buka kunci untuk sesi Super Sesi ADA DI SINI, bukan di pengawas
// (permintaan pemilik produk) -- pengawas tetap lihat sesinya seperti biasa
// (mulai/akhiri, jawaban, nilai), tapi tombol buka kunci di SesiPage disembunyikan
// untuk sesi jenis ini, lihat catatan di sana.

function PengawasanKelas({ submisi }: { submisi: SubmisiSuperSesi }) {
  const { aturKunciLayarSuper, bukaKunciSemuaSuper } = useSuperSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const jumlahTerkunci = submisi.murid.filter(m => m.terkunciPada !== null).length

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  return (
    <div className="ml-12 flex flex-col gap-2 pt-1">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <Ikon nama="kunci" className={`w-3.5 h-3.5 ${submisi.kunciLayar ? 'text-amber-600' : 'text-slate-400'}`} />
          Kunci layar {submisi.kunciLayar ? 'aktif' : 'nonaktif'}
        </span>
        <div className="flex items-center gap-1.5">
          {jumlahTerkunci > 0 && (
            <Button size="sm" variant="secondary" disabled={sibuk}
              onClick={() => void jalankan(() => bukaKunciSemuaSuper(submisi.sesiId!))}>
              Buka semua
            </Button>
          )}
          <Button size="sm" variant={submisi.kunciLayar ? 'danger' : 'secondary'} disabled={sibuk}
            onClick={() => void jalankan(() => aturKunciLayarSuper(submisi.sesiId!, !submisi.kunciLayar))}>
            {submisi.kunciLayar ? 'Matikan' : 'Nyalakan'}
          </Button>
        </div>
      </div>

      {submisi.murid.length === 0 ? (
        <p className="text-xs text-slate-400 px-1">Belum ada murid bergabung.</p>
      ) : (
        <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {submisi.murid.map(m => <BarisMuridSuper key={m.muridId} murid={m} sesiId={submisi.sesiId!} />)}
        </div>
      )}
      {galat && <p className="text-[11px] text-red-600 px-1">{galat}</p>}
    </div>
  )
}

function BarisMuridSuper({ murid, sesiId }: { murid: MuridSuperSesi; sesiId: string }) {
  const { bukaKunciMuridSuper } = useSuperSesi()
  const [membuka, setMembuka] = useState(false)
  const [gagal, setGagal] = useState(false)
  const terkunci = murid.terkunciPada !== null

  async function buka() {
    setMembuka(true); setGagal(false)
    try { await bukaKunciMuridSuper(sesiId, murid.muridId) }
    catch { setGagal(true) }
    finally { setMembuka(false) }
  }

  const sinyal = [
    murid.keluarLayar > 0 && `${murid.keluarLayar}× keluar layar`,
    murid.hilangFokus > 0 && `${murid.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${terkunci ? 'bg-amber-50' : ''}`}>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium text-slate-700 truncate">{murid.nama}</span>
        {(sinyal || terkunci) && (
          <span className="block text-[10px] text-amber-700">
            {terkunci && 'Terkunci'}{terkunci && sinyal && ' · '}{sinyal}
          </span>
        )}
        {gagal && <span className="block text-[10px] text-red-600">Gagal membuka kunci</span>}
      </span>
      {terkunci && (
        <Button size="sm" variant="secondary" disabled={membuka} onClick={() => void buka()}>
          {membuka ? '...' : 'Buka'}
        </Button>
      )}
    </div>
  )
}
