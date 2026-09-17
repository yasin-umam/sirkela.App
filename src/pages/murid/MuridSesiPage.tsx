import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useKembali, useNav } from '../../context/NavContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { PageFallback } from '../../components/PageFallback'
import { KerjakanSesi } from './KerjakanSesi'
import { gabungSesi, setNamaPeserta, type SesiRingkas } from '../../lib/sesiMurid'
import { bacaSesiPending, hapusSesiPending, ekstrakKodeDariTeks } from '../../lib/sesiCapture'
import { mintaLayarPenuh } from '../../lib/kunciLayar'
import { NAMA_APLIKASI } from '../../lib/aplikasi'

// jsQR membawa decoder Reed-Solomon lengkap -- cuma dibutuhkan pada satu ketukan
// "Scan QR", jadi tidak ikut dimuat murid yang mengetik kode manual.
const ScannerQr = lazy(() => import('../../components/ScannerQr').then(m => ({ default: m.ScannerQr })))

// ─── Konfirmasi sebelum mulai ────────────────────────────────────────────────
// Yang membatasi murid bukan perangkat lunaknya -- PWA tidak bisa mencegah siapa
// pun pindah aplikasi -- melainkan kesadaran bahwa ada yang mencatat, ditambah
// guru di ruangan. Itu cuma bekerja kalau muridnya TAHU, jadi apa yang dicatat
// DAN apa yang tidak dinyatakan terus terang di sini.
//
// Nama diisi di sini, bukan di layar kode: diprefill dari nama yang terakhir
// diketik di perangkat ini, tapi WAJIB dikonfirmasi -- HP sering dipakai
// bergantian.
function KonfirmasiMulai({ sesi, namaAwal, onMulai, onBatal }: {
  sesi: SesiRingkas; namaAwal: string; onMulai: () => void; onBatal: () => void
}) {
  const { updateNama } = useAuth()
  const [nama, setNama] = useState(namaAwal)
  const [mengirim, setMengirim] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mulai() {
    if (!nama.trim() || mengirim) return
    // SINKRON, sebelum await apa pun: Fullscreen API cuma mau dipanggil dari gestur.
    if (sesi.kunciLayar) mintaLayarPenuh()
    setMengirim(true); setError(null)
    try {
      await setNamaPeserta(sesi.id, nama)
      // Diingat di profil anonim: murid yang me-refresh lalu bergabung ulang
      // tidak mengetik namanya lagi. Gagal pun tidak apa -- nama sesinya sudah
      // tersimpan di atas.
      if (nama.trim() !== namaAwal.trim()) void updateNama(nama)
      onMulai()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan nama')
      setMengirim(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 flex flex-col px-5 py-8 gap-5">
      <div className="text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Siap memulai</p>
        <h2 className="font-bold text-slate-800 text-xl mt-1">{sesi.judul}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {sesi.durasiMenit} menit
          {sesi.jumlahKonten > 0 && ` · ${sesi.jumlahKonten} bagian`}
        </p>
      </div>

      <Card accent className="flex flex-col gap-2">
        <Input
          label="Nama kamu"
          placeholder="Nama lengkap"
          value={nama}
          onChange={e => { setNama(e.target.value); setError(null) }}
          autoComplete="name"
          error={error ?? undefined}
        />
        <p className="text-xs text-slate-400">Nama ini yang akan muncul di daftar hasil gurumu.</p>
      </Card>

      {/* Aturan kunci dinyatakan SEBELUM Mulai. "Waktu tetap berjalan" wajib
          tertulis: itu satu-satunya akibat kunci yang benar-benar merugikan murid. */}
      {sesi.kunciLayar && (
        <Card className="flex flex-col gap-2 border-amber-200 bg-amber-50">
          <p className="text-sm font-bold text-amber-900">🔒 Sesi ini memakai kunci layar</p>
          <p className="text-sm text-amber-800 leading-relaxed">
            Kalau kamu keluar dari layar ini atau membuka aplikasi lain, layarmu
            terkunci sampai gurumu membukanya. <strong>Waktu tetap berjalan</strong> selama terkunci.
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-bold text-slate-700">Selama sesi ini, guru bisa melihat:</p>
        <ul className="flex flex-col gap-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="text-slate-300">•</span>
            <span>kalau kamu <strong>keluar dari layar ini</strong> atau <strong>membuka aplikasi lain</strong> di sampingnya</span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-300">•</span>
            <span>kalau perangkatmu <strong>berhenti mengirim sinyal</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-300">•</span>
            <span>jawaban yang kamu pilih, tersimpan otomatis</span>
          </li>
        </ul>
        <p className="text-sm font-bold text-slate-700 mt-1">Yang tidak terlihat:</p>
        <p className="text-sm text-slate-500">Aplikasi apa yang kamu buka, isi layarmu, atau apa pun di luar halaman ini.</p>
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
          Catatan ini tidak mengubah nilaimu sendiri — gurumu yang membacanya dan menilai.
        </p>
      </Card>

      <div className="flex flex-col gap-2 mt-auto">
        <Button variant="primary" size="lg" fullWidth disabled={!nama.trim() || mengirim} onClick={() => void mulai()}>
          {mengirim ? <><Spinner size={18} />Menyimpan...</> : 'Saya mengerti, Mulai'}
        </Button>
        <Button variant="ghost" fullWidth onClick={onBatal} disabled={mengirim}>Batal</Button>
      </div>
    </div>
  )
}

export function MuridSesiPage() {
  const { user, masukTamu, logout } = useAuth()
  const { goTo } = useNav()
  const [kode, setKode] = useState('')
  const [memproses, setMemproses] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sesi, setSesi] = useState<SesiRingkas | null>(null)
  const [dikonfirmasi, setDikonfirmasi] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const gabungDenganKode = useCallback(async (kodeDipakai: string) => {
    if (!kodeDipakai.trim()) return
    setMemproses(true); setError(null)
    try {
      // Identitas dibuat di sini, tepat sebelum dibutuhkan -- bukan saat aplikasi
      // dibuka, supaya guru yang cuma lewat pintu depan tidak meninggalkan akun
      // anonim. Nama layarnya tetap 'murid', jadi halaman ini tidak di-mount ulang.
      const errTamu = await masukTamu()
      if (errTamu) { setError(errTamu); return }
      setSesi(await gabungSesi(kodeDipakai))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal bergabung')
    } finally {
      setMemproses(false)
    }
  }, [masukTamu])

  async function gabung() {
    if (memproses) return
    await gabungDenganKode(kode)
  }

  function scanBerhasil(teks: string) {
    setShowScanner(false)
    const kodeHasil = ekstrakKodeDariTeks(teks)
    if (!kodeHasil) {
      setError('QR yang dipindai bukan kode sesi — coba lagi atau ketik manual.')
      return
    }
    setKode(kodeHasil)
    void gabungDenganKode(kodeHasil)
  }
  const onDeteksi = useCallback(scanBerhasil, [gabungDenganKode])

  // ── Link langsung dari guru (?sesi=ABC-123) ──
  // Kalau gagal (kedaluwarsa, sesi ditutup), kolomnya TETAP terisi dan pesannya
  // tampil. Dipagari ref: percobaan otomatis hanya sekali seumur mount.
  const sudahCobaOtomatis = useRef(false)
  useEffect(() => {
    if (sudahCobaOtomatis.current) return
    const pending = bacaSesiPending()
    if (!pending) return
    sudahCobaOtomatis.current = true
    // Dihapus SEBELUM dicoba: kode yang gagal terus akan membajak tiap kali
    // aplikasi dibuka.
    hapusSesiPending()
    setKode(pending)
    void gabungDenganKode(pending)
  }, [gabungDenganKode])

  function keluarSesi() {
    setSesi(null); setDikonfirmasi(false); setKode('')
  }

  // Jawaban sudah dinilai = identitas anonim ini tidak dibutuhkan lagi. Dibuang
  // SEKARANG, bukan saat "Kembali" ditekan (murid bisa langsung menutup tab),
  // supaya teman yang memakai HP yang sama sesudahnya bergabung sebagai orang
  // baru -- bukan mewarisi baris sesi_murid, jawaban, dan nilai yang sudah
  // terkunci di identitas ini (A3). Sebelum mengirim, identitas SENGAJA
  // dipertahankan: refresh atau keluar sebentar kembali ke jawaban sendiri.
  const lepasIdentitas = useCallback(() => {
    if (user?.role === 'murid') void logout()
  }, [user, logout])

  // Sesi yang sedang dikerjakan sengaja TIDAK ditangani di sini: mundur dari sana
  // jatuh ke konfirmasi dua-ketuk ("tekan sekali lagi untuk keluar"), pagar yang
  // tepat untuk sentuhan tak sengaja. Di sesi BERKUNCI, KerjakanSesi memakai
  // tekanannya sendiri.
  useKembali(() => {
    if (showScanner) { setShowScanner(false); return true }
    if (sesi && !dikonfirmasi) { keluarSesi(); return true }
    return false
  })

  if (showScanner) {
    return (
      <Suspense fallback={<PageFallback />}>
        <ScannerQr onDeteksi={onDeteksi} onTutup={() => setShowScanner(false)} />
      </Suspense>
    )
  }

  if (sesi && dikonfirmasi) {
    return <KerjakanSesi sesi={sesi} onKeluar={keluarSesi} onTerkirim={lepasIdentitas} />
  }

  if (sesi) {
    return (
      <KonfirmasiMulai
        sesi={sesi}
        namaAwal={user?.nama ?? ''}
        onMulai={() => setDikonfirmasi(true)}
        onBatal={keluarSesi}
      />
    )
  }

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="bg-indigo-600 px-4 pt-10 pb-6">
        {user?.nama ? (
          <>
            <p className="text-indigo-200 text-xs">Halo,</p>
            <h1 className="text-white font-bold text-lg">{user.nama}</h1>
          </>
        ) : (
          <>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">{NAMA_APLIKASI}</p>
            <h1 className="text-white font-bold text-lg">Gabung ke sesi kelas</h1>
          </>
        )}
      </div>

      <div className="flex-1 px-4 py-6 flex flex-col gap-4 desktop:max-w-md desktop:w-full desktop:mx-auto">
        <Card accent className="flex flex-col items-center gap-2 py-6 text-center">
          <h2 className="font-bold text-slate-800 text-lg">Masukkan Kode Sesi</h2>
          <p className="text-sm text-slate-500">Minta kode dari gurumu. Tidak perlu akun atau login.</p>
        </Card>

        <Button variant="primary" size="lg" fullWidth onClick={() => { setError(null); setShowScanner(true) }}>
          Scan QR dari Guru
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">atau ketik kode</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <Card>
          <div className="flex flex-col gap-3">
            <input
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-center text-xl font-mono font-bold tracking-[0.2em] text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ABC-123"
              maxLength={7}
              inputMode="text"
              autoCapitalize="characters"
              value={kode}
              onChange={e => { setKode(e.target.value.toUpperCase()); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') void gabung() }}
            />
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <Button variant="primary" size="lg" fullWidth disabled={!kode.trim() || memproses} onClick={() => void gabung()}>
              {memproses ? <><Spinner size={18} />Mencari sesi...</> : 'Gabung'}
            </Button>
          </div>
        </Card>

        <p className="text-xs text-slate-400 text-center">Kode hanya berlaku selama sesinya masih dibuka gurumu.</p>

        <div className="mt-auto pt-6 text-center">
          <span className="text-sm text-slate-500">Kamu guru? </span>
          <button type="button" onClick={() => goTo({ name: 'login' })}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Masuk
          </button>
        </div>
      </div>
    </div>
  )
}
