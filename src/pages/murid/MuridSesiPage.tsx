import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useKembali, useNav } from '../../context/NavContext'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Ikon } from '../../components/ui/Ikon'
import { Logo } from '../../components/Logo'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { Gelembung } from '../../components/Gelembung'
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
      <div className="flex items-center gap-1.5 -ml-2.5">
        <button type="button" aria-label="Kembali" onClick={onBatal} disabled={mengirim}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 disabled:opacity-50">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <Eyebrow>Sebelum mulai</Eyebrow>
      </div>

      <KartuKepalaMurid judul={sesi.judul} deskripsi={sesi.deskripsi}>
        <span className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5"><Ikon nama="dokumen" className="w-4 h-4" />{sesi.jumlahSoal} pertanyaan</span>
          <span className="inline-flex items-center gap-1.5"><Ikon nama="jam" className="w-4 h-4" />{sesi.durasiMenit} menit</span>
        </span>
      </KartuKepalaMurid>

      <div className={`bg-white rounded-2xl border p-4 ${error ? 'border-jingga' : 'border-garis'}`}>
        <label htmlFor="nama-murid" className="block text-[15px] font-bold text-tinta">Nama kamu</label>
        <p className="text-[13px] text-teks-3 mt-0.5">Nama ini yang muncul di daftar hasil gurumu.</p>
        <input id="nama-murid" value={nama} placeholder="Tulis nama lengkapmu" autoComplete="name"
          onChange={e => { setNama(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') void mulai() }}
          className="mt-3 w-full h-13 px-4 rounded-xl border-[1.5px] border-pinggir-2 bg-white text-tinta placeholder:text-teks-3 outline-none focus:border-biru focus:ring-2 focus:ring-biru/20 transition-colors" />
        {error && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-jingga-gelap">
            <Ikon nama="galat" className="w-4 h-4" />{error}
          </p>
        )}
      </div>

      {/* Aturan kunci dinyatakan SEBELUM Mulai. "Waktu tetap berjalan" wajib
          tertulis: itu satu-satunya akibat kunci yang benar-benar merugikan murid. */}
      {sesi.kunciLayar && (
        <div className="bg-jingga-tint rounded-2xl border border-jingga-garis p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-white text-jingga flex items-center justify-center shrink-0">
            <Ikon nama="kunci" className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-jingga-gelap">Sesi ini memakai kunci layar</p>
            <p className="text-[13.5px] text-tinta mt-1 leading-relaxed">
              Kalau kamu keluar dari layar ini atau membuka aplikasi lain, layarmu terkunci sampai gurumu
              membukanya. <strong className="font-extrabold">Waktu tetap berjalan</strong> selama terkunci.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-garis p-4 flex flex-col gap-3">
        <p className="text-[15px] font-bold text-tinta">Selama sesi, gurumu bisa melihat</p>
        <ul className="flex flex-col gap-2.5 text-sm text-tinta-2 leading-snug">
          <li className="flex gap-2.5"><Ikon nama="lihat" className="w-4.5 h-4.5 text-biru mt-px" />Kalau kamu keluar dari layar ini atau membuka aplikasi lain</li>
          <li className="flex gap-2.5"><Ikon nama="lihat" className="w-4.5 h-4.5 text-biru mt-px" />Kalau perangkatmu berhenti mengirim sinyal</li>
          <li className="flex gap-2.5"><Ikon nama="lihat" className="w-4.5 h-4.5 text-biru mt-px" />Jawaban yang kamu pilih, tersimpan otomatis</li>
        </ul>
        <div className="h-px bg-garis-2" />
        <p className="text-[15px] font-bold text-tinta">Tidak terlihat</p>
        <p className="flex gap-2.5 text-sm text-tinta-2 leading-snug">
          <Ikon nama="silang" className="w-4.5 h-4.5 text-teks-3 mt-px" />
          Aplikasi apa yang kamu buka, isi layarmu, atau apa pun di luar halaman ini
        </p>
        <p className="text-[12.5px] text-teks-3 leading-relaxed">
          Catatan ini tidak mengubah nilaimu. Gurumu yang membaca dan menilai.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 pt-1 pb-8">
        <Button size="lg" fullWidth disabled={!nama.trim() || mengirim} onClick={() => void mulai()}>
          {mengirim ? <><Spinner size={16} />Menyimpan...</> : 'Saya mengerti, mulai'}
        </Button>
        <Button variant="ghost" fullWidth onClick={onBatal} disabled={mengirim}>Batal</Button>
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
  // Kode sesi berbentuk KARCIS: bidang isian di atas, garis sobekan putus-putus
  // dengan dua lekuk di tepi, lalu tombol Gabung di bagian sobekannya.
  // Desktop (≥ 1024px, mis. PC lab): dua kolom -- judul & tiga langkah di kiri,
  // karcis di kanan. Murid di lab tidak punya kamera untuk memindai QR, jadi
  // langkahnya menyebut mengetik kode.
  return (
    <div className="min-h-full bg-alas px-5 py-6 flex flex-col lg:px-14 lg:py-8">
      <div className="flex items-center justify-between">
        <Logo ukuran="w-9 h-9" kelasTeks="text-sm" />
        <p className="hidden lg:block text-[14.5px] text-tinta-2">
          Kamu guru?{' '}
          <button type="button" onClick={() => goTo({ name: 'login' })} className="font-bold text-biru hover:underline">Masuk</button>
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-6 w-full max-w-md mx-auto py-8 lg:max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-x-24 lg:items-center">
        <div>
          <Eyebrow>Gabung sesi</Eyebrow>
          <h1 className="mt-2.5 text-[34px] leading-[1.08] font-extrabold tracking-tight text-tinta lg:mt-3.5 lg:text-6xl lg:leading-[1.04] lg:tracking-tighter">
            {user?.nama ? `Halo, ${user.nama}` : 'Masukkan kode dari gurumu'}
          </h1>
          <p className="mt-2 text-[15px] text-tinta-2 lg:mt-3.5 lg:text-lg">
            {user?.nama ? 'Masukkan kode dari gurumu. ' : ''}Tidak perlu akun atau login.
          </p>
          <ol className="hidden lg:flex flex-col gap-5.5 mt-11">
            {([['A', 'Dapatkan kode dari gurumu', 'Tertulis di papan tulis atau layar proyektor kelas.'],
               ['B', 'Ketik kode di kotak ini', 'Tujuh karakter, contohnya MTK-482.'],
               ['C', 'Isi namamu, lalu mulai', 'Jawabanmu tersimpan otomatis selama mengerjakan.']] as const).map(([h, t, k], i) => (
              <li key={h} className="flex items-start gap-4">
                <Gelembung indeks={i} ukuran="lg" />
                <span>
                  <span className="block text-base font-bold text-tinta">{t}</span>
                  <span className="block text-[14.5px] text-teks-3 mt-0.5">{k}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-6">
          <div className={`bg-white rounded-[20px] lg:rounded-3xl border ${error ? 'border-jingga' : 'border-garis'}`}>
            <div className="px-5 pt-5 pb-1 lg:px-8 lg:pt-7.5 lg:pb-1.5">
              <label htmlFor="kode-sesi" className="block font-mono text-xs uppercase tracking-[0.14em] text-teks-3">Kode sesi</label>
              <input
                id="kode-sesi"
                className="mt-2 block w-full pt-1.5 pb-2.5 border-0 border-b-[3px] border-biru bg-transparent text-center font-mono text-[42px] lg:text-[64px] font-medium tracking-[0.14em] uppercase text-tinta placeholder:text-pinggir-2 outline-none rounded-none lg:border-b-4"
                placeholder="ABC-123"
                maxLength={7}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                value={kode}
                onChange={e => { setKode(e.target.value.toUpperCase()); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') void gabung() }}
              />
            </div>

            <div aria-hidden className="relative h-7.5 lg:h-9">
              <div className="absolute left-5 right-5 top-3.5 lg:left-8 lg:right-8 lg:top-4.5 border-t-2 border-dashed border-garis" />
              <div className="absolute -left-3 top-0.75 w-6 h-6 lg:-left-3.75 lg:top-0.75 lg:w-7.5 lg:h-7.5 rounded-full bg-alas" />
              <div className="absolute -right-3 top-0.75 w-6 h-6 lg:-right-3.75 lg:top-0.75 lg:w-7.5 lg:h-7.5 rounded-full bg-alas" />
            </div>

            <div className="px-5 pb-5 lg:px-8 lg:pb-7.5">
              {error && (
                <p className="mb-3 flex items-start gap-1.5 text-[13px] font-medium text-jingga-gelap">
                  <Ikon nama="galat" className="w-4 h-4 shrink-0 mt-px" />{error}
                </p>
              )}
              <div className="flex gap-2.5">
                <Button size="lg" fullWidth disabled={!kode.trim() || memproses} onClick={() => void gabung()} className="lg:h-15 lg:text-lg">
                  {memproses ? <><Spinner size={16} />Mencari sesi...</> : <>Gabung<Ikon nama="kanan" className="w-4.5 h-4.5" tebal={2.4} /></>}
                </Button>
                {/* Pemindai QR butuh kamera: disembunyikan di desktop, tempat
                    kamera jarang ada dan kode gampang diketik. */}
                <Button size="lg" variant="secondary" onClick={() => { setError(null); setShowScanner(true) }}
                  aria-label="Pindai QR" className="shrink-0 w-14 px-0 lg:hidden">
                  <Ikon nama="qr" className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-[13px] text-teks-3 leading-relaxed">
            Kode hanya berlaku selama sesinya masih dibuka gurumu.
          </p>
        </div>
      </div>

      <p className="text-center text-sm text-tinta-2 lg:hidden">
        Kamu guru?{' '}
        <button type="button" onClick={() => goTo({ name: 'login' })}
          className="font-bold text-biru hover:underline">
          Masuk
        </button>
      </p>
    </div>
  )
}
