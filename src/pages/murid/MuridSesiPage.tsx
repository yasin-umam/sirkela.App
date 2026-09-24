import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useKembali, useNav } from '../../context/NavContext'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Ikon } from '../../components/ui/Ikon'
import { Logo } from '../../components/Logo'
import { PageFallback } from '../../components/PageFallback'
import { HalamanMurid, KartuKepalaMurid } from '../../components/LayarMurid'
import { KerjakanSesi } from './KerjakanSesi'
import { gabungSesi, setNamaPeserta, type SesiRingkas } from '../../lib/sesiMurid'
import { bacaSesiPending, hapusSesiPending, ekstrakKodeDariTeks } from '../../lib/sesiCapture'
import { mintaLayarPenuh } from '../../lib/kunciLayar'

// jsQR membawa decoder Reed-Solomon lengkap -- cuma dibutuhkan pada satu ketukan
// "Pindai QR", jadi tidak ikut dimuat murid yang mengetik kode manual.
const ScannerQr = lazy(() => import('../../components/ScannerQr').then(m => ({ default: m.ScannerQr })))

// ─── Konfirmasi sebelum mulai ────────────────────────────────────────────────
// Yang membatasi murid bukan perangkat lunaknya -- web tidak bisa mencegah siapa
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
    <HalamanMurid>
      <KartuKepalaMurid judul={sesi.judul} deskripsi={sesi.deskripsi}>
        {sesi.jumlahSoal} pertanyaan · {sesi.durasiMenit} menit
      </KartuKepalaMurid>

      <div className={`bg-white rounded-2xl border shadow-sm p-4 ${error ? 'border-red-300' : 'border-slate-100'}`}>
        <label htmlFor="nama-murid" className="block text-sm font-semibold text-slate-700">Nama kamu</label>
        <p className="text-xs text-slate-400 mt-0.5">Nama ini yang muncul di daftar hasil gurumu.</p>
        <input id="nama-murid" value={nama} placeholder="Tulis nama lengkapmu" autoComplete="name"
          onChange={e => { setNama(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') void mulai() }}
          className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
        {error && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
            <Ikon nama="galat" className="w-4 h-4" />{error}
          </p>
        )}
      </div>

      {/* Aturan kunci dinyatakan SEBELUM Mulai. "Waktu tetap berjalan" wajib
          tertulis: itu satu-satunya akibat kunci yang benar-benar merugikan murid. */}
      {sesi.kunciLayar && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Ikon nama="kunci" className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">Sesi ini memakai kunci layar</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Kalau kamu keluar dari layar ini atau membuka aplikasi lain, layarmu terkunci sampai gurumu
              membukanya. <strong className="font-bold">Waktu tetap berjalan</strong> selama terkunci.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-slate-700">Selama sesi ini, guru bisa melihat:</p>
        <ul className="mt-2 flex flex-col gap-1.5 list-disc pl-5 text-xs text-slate-600 leading-relaxed">
          <li>kalau kamu <strong className="font-semibold">keluar dari layar ini</strong> atau <strong className="font-semibold">membuka aplikasi lain</strong> di sampingnya</li>
          <li>kalau perangkatmu <strong className="font-semibold">berhenti mengirim sinyal</strong></li>
          <li>jawaban yang kamu pilih, tersimpan otomatis</li>
        </ul>
        <p className="text-sm font-semibold text-slate-700 mt-4">Yang tidak terlihat:</p>
        <p className="mt-1 text-xs text-slate-500">Aplikasi apa yang kamu buka, isi layarmu, atau apa pun di luar halaman ini.</p>
        <p className="text-[11px] text-slate-400 border-t border-slate-100 mt-3 pt-3">
          Catatan ini tidak mengubah nilaimu sendiri. Gurumu yang membacanya dan menilai.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1 pb-8">
        <Button size="lg" disabled={!nama.trim() || mengirim} onClick={() => void mulai()}>
          {mengirim ? <><Spinner size={16} />Menyimpan...</> : 'Saya mengerti, mulai'}
        </Button>
        <Button size="lg" variant="ghost" onClick={onBatal} disabled={mengirim}>Batal</Button>
      </div>
    </HalamanMurid>
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
      setError('QR yang dipindai bukan kode sesi. Coba lagi atau ketik manual.')
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

  // ── Pintu depan aplikasi ──
  return (
    <HalamanMurid className="flex flex-col justify-center">
      <div className="flex justify-center pt-6 pb-2">
        <Logo ukuran="w-11 h-11" kelasTeks="text-xl" />
      </div>

      <div className="text-center px-2 pb-1">
        <h1 className="text-lg font-bold text-slate-800">
          {user?.nama ? `Halo, ${user.nama}` : 'Gabung ke sesi kelas'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Masukkan kode dari gurumu. Tidak perlu akun atau login.</p>
      </div>

      <div className={`bg-white rounded-2xl border shadow-sm p-4 ${error ? 'border-red-300' : 'border-slate-100'}`}>
        <label htmlFor="kode-sesi" className="block text-sm font-semibold text-slate-700">Kode sesi</label>
        <input
          id="kode-sesi"
          className="mt-3 w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center font-mono text-2xl font-bold tracking-[0.2em] uppercase text-slate-800 placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
          placeholder="ABC-123"
          maxLength={7}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          value={kode}
          onChange={e => { setKode(e.target.value.toUpperCase()); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') void gabung() }}
        />
        {error && (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
            <Ikon nama="galat" className="w-4 h-4 shrink-0 mt-px" />{error}
          </p>
        )}
        <p className="text-[11px] text-slate-400 mt-2.5">Kode hanya berlaku selama sesinya masih dibuka gurumu.</p>

        <div className="mt-4 flex gap-2">
          <Button size="lg" fullWidth disabled={!kode.trim() || memproses} onClick={() => void gabung()}>
            {memproses ? <><Spinner size={16} />Mencari sesi...</> : 'Gabung'}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => { setError(null); setShowScanner(true) }}
            aria-label="Pindai QR" className="shrink-0">
            <Ikon nama="qr" className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="pt-6 pb-4 text-center text-sm text-slate-500">
        Kamu guru?{' '}
        <button type="button" onClick={() => goTo({ name: 'login' })}
          className="font-semibold text-indigo-600 hover:underline">
          Masuk
        </button>
      </div>
    </HalamanMurid>
  )
}
