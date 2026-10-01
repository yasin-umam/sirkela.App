import { useCallback, useEffect, useRef, useState } from 'react'
import { useKembali } from '../../context/NavContext'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Ikon } from '../../components/ui/Ikon'
import { HalamanMurid, KartuKepalaMurid, KartuSoalMurid } from '../../components/LayarMurid'
import { Spinner } from '../../components/ui/Spinner'
import { useZoomKontrol, TombolZoomMengambang } from '../../components/TombolZoom'
import {
  ambilIsiSesi, statusSesi, simpanJawaban, selesaikanSesi, denyut, catatPeristiwa,
  kirimAntrean, bersihkanAntrean, ratakanSoal, sekarangServerMs, pantauKunciSaya, adaPeristiwaTertunda,
  type SesiRingkas, type SoalSesi, type HasilSesi,
} from '../../lib/sesiMurid'
import {
  useSensorSesi, usePengunciPerangkat, bisaLayarPenuh, mintaLayarPenuh,
  JENIS_PENGUNCI, type JenisPeristiwa,
} from '../../lib/kunciLayar'

// Denyut lebih rapat daripada polling status: denyut cuma satu UPDATE kecil.
// Ambang "senyap" di layar guru (45 detik) = dua kali jarak denyut.
const JEDA_DENYUT_MS = 20_000
const JEDA_STATUS_MS = 15_000
// Selama terkunci status dijajak lebih rapat -- murid sedang menunggu guru
// menekan Buka. Realtime (pantauKunciSaya) biasanya lebih dulu sampai.
const JEDA_STATUS_TERKUNCI_MS = 3_000
// Kunci lokal yang tidak dikonfirmasi server selama ini, padahal antrean
// peristiwa kosong, dilepas: server memang tidak mengunci. Tanpa batas ini murid
// bisa tertahan di layar kunci yang tidak terlihat -- dan tidak bisa dibuka --
// dari layar guru.
const BATAS_KUNCI_LOKAL_MS = 20_000

type Fase = 'memuat' | 'menunggu' | 'kerjakan' | 'mengirim' | 'selesai' | 'gagal'

function Hitung({ tenggat, onHabis, besar = false }: {
  tenggat: string; onHabis: () => void
  /** Angka besar polos (layar terkunci) alih-alih pil di bilah atas. */
  besar?: boolean
}) {
  const tenggatMs = new Date(tenggat).getTime()
  const sisa = () => Math.max(0, Math.round((tenggatMs - sekarangServerMs()) / 1000))
  const [detik, setDetik] = useState(sisa)
  const sudahHabis = useRef(false)
  const onHabisRef = useRef(onHabis)
  onHabisRef.current = onHabis

  useEffect(() => {
    const id = setInterval(() => {
      const s = sisa()
      setDetik(s)
      // Hard-timeout lokal: jaring pengaman kalau polling status gagal persis
      // saat guru mengakhiri. Dipagari ref supaya tidak dipanggil tiap detik.
      if (s === 0 && !sudahHabis.current) { sudahHabis.current = true; onHabisRef.current() }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenggatMs])

  const menit = Math.floor(detik / 60)
  const mepet = detik < 300
  const teks = `${String(menit).padStart(2, '0')}:${String(detik % 60).padStart(2, '0')}`
  if (besar) {
    return (
      <div className={`font-mono text-[40px] font-medium leading-none tabular-nums ${mepet ? 'text-jingga' : 'text-tinta'}`}>
        {teks}
      </div>
    )
  }
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] font-mono text-[17px] font-medium tabular-nums shrink-0 ${
      mepet ? 'bg-jingga-tint text-jingga-gelap' : 'bg-biru-tint text-biru'}`}>
      <Ikon nama="jam" className="w-4 h-4" tebal={2.2} />{teks}
    </div>
  )
}

// ─── Layar terkunci ──────────────────────────────────────────────────────────
// Isi soal DISEMBUNYIKAN, bukan ditutup lapisan transparan: murid yang terkunci
// tidak boleh membaca soal lalu mencari jawabannya selagi menunggu. Hitung mundur
// tetap ikut dan tetap mengirim saat habis -- kunci tidak menyentuh nilai (K3).
function LayarTerkunci({ judul, tenggat, terkunciPada, onHabis }: {
  judul: string; tenggat: string | null; terkunciPada: string | null; onHabis: () => void
}) {
  const sejak = terkunciPada
    ? new Date(terkunciPada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div className="min-h-full bg-alas px-5 py-6 select-none flex flex-col justify-center">
      <div className="max-w-sm w-full mx-auto bg-white rounded-3xl border border-garis px-6 pt-8 pb-6 flex flex-col items-center gap-3.5 text-center">
        <span className="w-24 h-24 rounded-full bg-jingga-tint text-jingga flex items-center justify-center">
          <Ikon nama="kunci" className="w-11 h-11" tebal={1.7} />
        </span>
        {/* Stempel: penanda keadaan, bukan hiasan. */}
        <span className="-rotate-3 rounded-lg border-2 border-jingga px-3 py-1 font-mono text-[13px] font-medium tracking-[0.18em] text-jingga-gelap">
          TERKUNCI
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Layar terkunci</h1>
        <p className="text-[15px] text-tinta-2 leading-relaxed">
          Kamu keluar dari layar sesi <strong className="font-bold text-tinta">{judul}</strong>. Minta gurumu membuka kuncinya.
        </p>
        {tenggat && (
          <div className="w-full rounded-2xl border-2 border-dashed border-jingga-garis bg-jingga-tipis px-4 py-3.5 flex flex-col items-center gap-1">
            <span className="text-[13px] text-teks-3">Waktu tetap berjalan</span>
            <Hitung besar tenggat={tenggat} onHabis={onHabis} />
          </div>
        )}
        <p className="w-full border-t border-garis-2 pt-3.5 text-[13px] text-teks-3 leading-relaxed">
          {sejak && <>Terkunci sejak {sejak}. </>}Jawaban yang sudah kamu pilih tetap tersimpan.
        </p>
      </div>
    </div>
  )
}

export function KerjakanSesi({ sesi, onKeluar, onTerkirim }: {
  sesi: SesiRingkas
  onKeluar: () => void
  /** Sekali, begitu server menilai. Semua jajak & sensor sudah berhenti di fase ini. */
  onTerkirim?: () => void
}) {
  const [fase, setFase] = useState<Fase>('memuat')
  const [soalList, setSoalList] = useState<SoalSesi[]>([])
  const [jawaban, setJawaban] = useState<Record<string, number>>({})
  const [belumTersimpan, setBelumTersimpan] = useState<Set<string>>(new Set())
  const [tenggat, setTenggat] = useState<string | null>(sesi.tenggat)
  const zoomKtl = useZoomKontrol()
  const [hasil, setHasil] = useState<HasilSesi | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [konfirmasiKirim, setKonfirmasiKirim] = useState(false)

  // ── Kunci Layar Sesi ──
  // `kunciLayar` = nilai efektif dari server, diperbarui tiap status_sesi(): guru
  // bisa menyalakan/mematikannya di tengah sesi, dan sakelar darurat global bisa
  // mematikannya untuk semua orang.
  const [kunciLayar, setKunciLayar] = useState(sesi.kunciLayar)
  const [terkunci, setTerkunci] = useState(false)
  const [terkunciPada, setTerkunciPada] = useState<string | null>(null)
  const [layarPenuh, setLayarPenuh] = useState(() => !!document.fullscreenElement)
  // Murid sudah MELIHAT aturan kunci. Sesi yang berkunci sejak murid bergabung
  // sudah menampilkannya di "Siap memulai"; kunci yang dinyalakan di TENGAH sesi
  // baru dianggap diketahui setelah pemberitahuan diketuk. Sebelum itu layar
  // tidak mengunci dirinya sendiri, dan server menahan kunci pertama lewat
  // kunci_layar_jeda_detik().
  const [diberitahu, setDiberitahu] = useState(sesi.kunciLayar)
  // Pemicu render ulang saat fullscreen ditolak (lihat mintaLayarPenuh).
  const [, setFullscreenDitolak] = useState(0)
  const kunciLayarRef = useRef(kunciLayar)
  kunciLayarRef.current = kunciLayar
  const diberitahuRef = useRef(diberitahu)
  diberitahuRef.current = diberitahu
  const terkunciRef = useRef(terkunci)
  terkunciRef.current = terkunci
  // Server pernah MENGONFIRMASI kunci yang sedang tampil. Hanya transisi dari
  // "server bilang terkunci" ke "tidak" yang dibaca sebagai dibuka guru.
  const serverMengunciRef = useRef(false)
  const kunciLokalSejakRef = useRef(0)

  // Ref supaya listener & interval yang dipasang sekali tidak menangkap fase basi.
  const faseRef = useRef(fase)
  faseRef.current = fase

  // Sidik jari konten yang SEDANG dipegang layar ini. Ref, bukan state: yang
  // membacanya cuma interval polling.
  const versiRef = useRef<string>('')
  const menarikRef = useRef(false)
  const [kontenBaru, setKontenBaru] = useState(false)
  const onTerkirimRef = useRef(onTerkirim)
  onTerkirimRef.current = onTerkirim

  const kirim = useCallback(async () => {
    if (faseRef.current === 'mengirim' || faseRef.current === 'selesai') return
    setFase('mengirim')
    try {
      // Kosongkan antrean dulu -- jawaban terakhir yang belum terkirim harus
      // sampai SEBELUM server menghitung nilainya.
      await kirimAntrean(sesi.id)
      const h = await selesaikanSesi(sesi.id)
      bersihkanAntrean(sesi.id)
      setHasil(h)
      setFase('selesai')
      onTerkirimRef.current?.()
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal mengirim jawaban')
      setFase('kerjakan')
    }
  }, [sesi.id])

  // ── Muat isi sesi ──
  useEffect(() => {
    let batal = false
    async function muat() {
      try {
        const isi = await ambilIsiSesi(sesi.id)
        if (batal) return
        versiRef.current = isi.versiKonten
        setSoalList(ratakanSoal(isi.konten))
        setJawaban(isi.jawabanTersimpan)
        setFase(sesi.mulaiPada ? 'kerjakan' : 'menunggu')
      } catch (e) {
        if (batal) return
        setPesan(e instanceof Error ? e.message : 'Gagal memuat soal')
        setFase('gagal')
      }
    }
    void muat()
    return () => { batal = true }
  }, [sesi.id, sesi.mulaiPada])

  // ── Tarik ulang isi sesi setelah guru mengubahnya ──
  // Isi diGANTI seluruhnya (server mengirim daftar utuh). `jawaban` SENGAJA tidak
  // ikut ditimpa: pilihan yang belum sampai ke server akan lenyap dari layar.
  const segarkanKonten = useCallback(async () => {
    if (menarikRef.current) return
    menarikRef.current = true
    try {
      const isi = await ambilIsiSesi(sesi.id)
      versiRef.current = isi.versiKonten
      setSoalList(ratakanSoal(isi.konten))
      setKontenBaru(true)
    } catch { /* biarkan versi lama; percobaan berikutnya 15 detik lagi */ }
    finally { menarikRef.current = false }
  }, [sesi.id])

  // ── Status kunci dari server ──
  // Server selalu menang, dengan SATU pengecualian: layar yang baru terkunci lokal
  // tidak dibuka hanya karena server belum menerima peristiwanya (tab dibekukan
  // OS, atau murid mematikan data lalu pindah aplikasi). Tanpa pengecualian ini,
  // mematikan data seluler jadi cara membuka kunci sendiri.
  const terapkanStatusKunci = useCallback((s: { kunciLayar: boolean; terkunci: boolean; terkunciPada: string | null }) => {
    setKunciLayar(s.kunciLayar)
    if (s.terkunci) {
      serverMengunciRef.current = true
      terkunciRef.current = true
      setTerkunci(true)
      setTerkunciPada(s.terkunciPada)
      return
    }
    if (!terkunciRef.current) return
    const dibukaGuru = serverMengunciRef.current
    const kunciDimatikan = !s.kunciLayar
    const tidakDikonfirmasi = Date.now() - kunciLokalSejakRef.current > BATAS_KUNCI_LOKAL_MS
      && !adaPeristiwaTertunda(sesi.id)
    if (!dibukaGuru && !kunciDimatikan && !tidakDikonfirmasi) return
    serverMengunciRef.current = false
    terkunciRef.current = false
    setTerkunci(false)
    setTerkunciPada(null)
  }, [sesi.id])

  // ── Polling status: akhir sesi + waktu mulai + konten baru + kunci ──
  const periksaStatus = useCallback(async () => {
    try {
      const s = await statusSesi(sesi.id)
      if (s.status === 'selesai') { void kirim(); return }
      if (s.tenggat) setTenggat(s.tenggat)
      if (s.mulaiPada && faseRef.current === 'menunggu') setFase('kerjakan')
      if (s.versiKonten && s.versiKonten !== versiRef.current) void segarkanKonten()
      terapkanStatusKunci(s)
    } catch { /* sinyal putus -- hard-timeout lokal jadi jaring pengaman */ }
  }, [sesi.id, kirim, segarkanKonten, terapkanStatusKunci])
  const periksaStatusRef = useRef(periksaStatus)
  periksaStatusRef.current = periksaStatus

  useEffect(() => {
    if (fase !== 'kerjakan' && fase !== 'menunggu') return
    // Sekali LANGSUNG saat masuk: murid yang me-refresh selagi terkunci harus
    // melihat layar kunci sekarang, bukan 15 detik kemudian (K1).
    void periksaStatus()
    const id = setInterval(() => { void periksaStatus() }, terkunci ? JEDA_STATUS_TERKUNCI_MS : JEDA_STATUS_MS)
    return () => clearInterval(id)
  }, [fase, terkunci, periksaStatus])

  // ── Pembukaan kunci seketika lewat Realtime baris sendiri ──
  useEffect(() => {
    if (fase !== 'kerjakan' || !kunciLayar) return
    return pantauKunciSaya(sesi.id, terkunciPadaServer => {
      // Denyut juga meng-UPDATE baris ini tiap 20 detik. Status ditanyakan ulang
      // hanya kalau barisnya BERBEDA dari layar.
      if ((terkunciPadaServer !== null) !== terkunciRef.current) void periksaStatusRef.current()
    })
  }, [fase, kunciLayar, sesi.id])

  // ── Denyut kehadiran + kirim ulang antrean ──
  useEffect(() => {
    if (fase !== 'kerjakan') return
    void denyut(sesi.id)
    const id = setInterval(() => {
      void denyut(sesi.id)
      void kirimAntrean(sesi.id)
    }, JEDA_DENYUT_MS)
    return () => clearInterval(id)
  }, [fase, sesi.id])

  // ── Sensor: keluar layar & hilang fokus ──
  // Yang terbaca cuma "halaman saya berhenti terlihat / kehilangan fokus" --
  // BUKAN aplikasi apa yang dibuka. Murid sudah diberi tahu persis ini.
  const onPeristiwa = useCallback((jenis: JenisPeristiwa) => {
    if (faseRef.current !== 'kerjakan') return
    void catatPeristiwa(sesi.id, jenis)

    // Kunci SEKETIKA di layar, tanpa menunggu jaringan. Server tetap yang
    // memutuskan. Murid yang belum diberi tahu aturannya tidak dikunci layarnya
    // sendiri; kalau server tetap mengunci, layar kunci menyusul lewat status.
    if (kunciLayarRef.current && diberitahuRef.current && JENIS_PENGUNCI.has(jenis) && !terkunciRef.current) {
      kunciLokalSejakRef.current = Date.now()
      terkunciRef.current = true
      setTerkunci(true)
      setTerkunciPada(new Date(sekarangServerMs()).toISOString())
    }
    // Murid kembali: kirim yang tertahan lalu tanya status sekarang.
    if (jenis === 'kembali_layar' || jenis === 'kembali_fokus') {
      void kirimAntrean(sesi.id).then(() => periksaStatusRef.current())
    }
  }, [sesi.id])

  useSensorSesi({ aktif: fase === 'kerjakan', kunciLayar, onPeristiwa })
  // `mengirim` ikut dihitung: kiriman yang gagal kembali ke `kerjakan`, dan
  // melepas-lalu-memasang di antaranya berarti fullscreen hilang tanpa gestur
  // untuk memintanya lagi.
  usePengunciPerangkat(kunciLayar && diberitahu && (fase === 'kerjakan' || fase === 'mengirim'))

  // Kunci dimatikan = pemberitahuannya harus tampil lagi kalau dinyalakan ulang.
  useEffect(() => {
    if (!kunciLayar) setDiberitahu(false)
  }, [kunciLayar])

  useEffect(() => {
    if (fase !== 'kerjakan') return
    function onOnline() { void kirimAntrean(sesi.id) }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [fase, sesi.id])

  useEffect(() => {
    const onFullscreen = () => setLayarPenuh(!!document.fullscreenElement)
    const onDitolak = () => setFullscreenDitolak(n => n + 1)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('fullscreenerror', onDitolak)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('fullscreenerror', onDitolak)
    }
  }, [])

  // Sesi berkunci: tombol kembali TIDAK PERNAH menutup aplikasi selama
  // pengerjaan. Sesi tanpa kunci jatuh ke konfirmasi dua-ketuk seperti biasa.
  useKembali(() => {
    if (konfirmasiKirim) { setKonfirmasiKirim(false); return true }
    return kunciLayarRef.current && faseRef.current === 'kerjakan'
  })

  // Fullscreen butuh gestur, jadi tidak bisa dipasang ulang otomatis setelah
  // Back atau setelah kunci dibuka. Di tempat yang menolak fullscreen (WebView
  // di dalam aplikasi lain, iPhone), pita tidak muncul.
  const perluAktifkanKunci = kunciLayar && diberitahu && fase === 'kerjakan' && !terkunci && bisaLayarPenuh() && !layarPenuh

  // Ketukan "Mengerti" sekaligus gestur yang dibutuhkan fullscreen.
  function pahamiKunci() {
    mintaLayarPenuh()
    diberitahuRef.current = true
    setDiberitahu(true)
  }

  async function pilih(soalId: string, idx: number) {
    setJawaban(prev => ({ ...prev, [soalId]: idx }))
    setBelumTersimpan(prev => new Set(prev).add(soalId))
    const ok = await simpanJawaban(sesi.id, soalId, idx)
    setBelumTersimpan(prev => {
      const next = new Set(prev)
      if (ok) next.delete(soalId)
      return next
    })
  }

  if (fase === 'selesai' && hasil) {
    // Cincin nilai: busur biru di atas lintasan biru-tint (satu ramp, terang ke gelap).
    const LINGKAR = 2 * Math.PI * 76
    const isi = (Math.max(0, Math.min(100, hasil.nilai)) / 100) * LINGKAR
    return (
      <HalamanMurid className="flex flex-col justify-center">
        <div className="bg-white rounded-3xl border border-garis px-6 pt-7 pb-6 flex flex-col items-center gap-3.5 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-hijau-tint px-3 py-1.5 text-[12.5px] font-bold text-hijau">
            <Ikon nama="centang" className="w-3.5 h-3.5" tebal={3} />Jawaban kamu telah direkam
          </span>
          <div className="relative w-45 h-45">
            <svg viewBox="0 0 180 180" className="w-full h-full" aria-hidden>
              <circle cx="90" cy="90" r="76" fill="none" strokeWidth="14" className="stroke-biru-tint" />
              <circle cx="90" cy="90" r="76" fill="none" strokeWidth="14" strokeLinecap="round"
                className="stroke-biru" strokeDasharray={`${isi} ${LINGKAR}`} transform="rotate(-90 90 90)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-6xl font-extrabold tracking-tighter leading-none text-tinta">{hasil.nilai}</p>
              <p className="text-[13px] text-teks-3 mt-0.5">dari 100</p>
            </div>
          </div>
          <p className="text-base font-bold text-tinta">{hasil.benar} benar dari {hasil.total} soal</p>
          {/* Hitungan, BUKAN urutan soal: murid tidak diberi tahu mana yang salah. */}
          {hasil.total > 0 && hasil.total <= 40 && (
            <div aria-hidden className="flex flex-wrap justify-center gap-1.25 max-w-65">
              {Array.from({ length: hasil.total }, (_, i) => (
                <span key={i} className={`w-5 h-5 rounded-full border-2 ${i < hasil.benar ? 'bg-biru border-biru' : 'border-pinggir'}`} />
              ))}
            </div>
          )}
          <p className="text-[13px] text-teks-3 leading-relaxed">
            Gurumu masih bisa meninjau dan mengubah nilai ini.
          </p>
        </div>
        <Button variant="secondary" size="lg" fullWidth onClick={onKeluar}>Kembali ke halaman kode</Button>
      </HalamanMurid>
    )
  }

  if (fase === 'memuat') {
    return (
      <div className="min-h-full bg-alas flex flex-col items-center justify-center gap-3 py-20 text-biru">
        <Spinner size={28} />
        <p className="text-sm text-teks-3">Memuat soal...</p>
      </div>
    )
  }

  if (fase === 'gagal') {
    return (
      <HalamanMurid className="flex flex-col justify-center">
        <div className="bg-white rounded-2xl border border-jingga-garis p-5 flex flex-col items-center gap-3 text-center">
          <Ikon nama="galat" className="w-8 h-8 text-jingga" tebal={1.6} />
          <p className="text-sm font-medium text-tinta">{pesan}</p>
          <Button variant="secondary" onClick={onKeluar}>Kembali</Button>
        </div>
      </HalamanMurid>
    )
  }

  if (fase === 'menunggu') {
    return (
      <HalamanMurid>
        <KartuKepalaMurid judul={sesi.judul} deskripsi={sesi.deskripsi}>
          <span className="flex items-center gap-2.5">
            <span className="relative flex w-2.5 h-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-white animate-ping" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
            </span>
            Kamu sudah bergabung. Menunggu guru memulai sesi.
          </span>
        </KartuKepalaMurid>
        <div className="flex justify-start">
          <Button variant="ghost" onClick={onKeluar}>Keluar</Button>
        </div>
      </HalamanMurid>
    )
  }

  const terjawab = soalList.filter(s => jawaban[s.id] !== undefined).length
  const semuaTerjawab = terjawab === soalList.length && soalList.length > 0

  if (terkunci && (fase === 'kerjakan' || fase === 'mengirim')) {
    return <LayarTerkunci judul={sesi.judul} tenggat={tenggat} terkunciPada={terkunciPada} onHabis={() => void kirim()} />
  }

  // Kunci dinyalakan guru SETELAH murid melewati "Siap memulai". Wajib diketuk
  // sebelum soal tampil lagi -- murid tidak boleh menemukan aturannya pertama
  // kali lewat layar kunci.
  if (kunciLayar && !diberitahu && fase === 'kerjakan') {
    return (
      <HalamanMurid className="flex flex-col justify-center">
        <div className="bg-jingga-tipis rounded-2xl border border-jingga-garis p-5 flex flex-col gap-3">
          <p className="flex items-center gap-2.5 text-base font-bold text-jingga-gelap">
            <Ikon nama="kunci" className="w-5 h-5" />Gurumu menyalakan kunci layar
          </p>
          <p className="text-sm text-jingga-gelap leading-relaxed">
            Mulai sekarang, kalau kamu keluar dari layar ini atau membuka aplikasi lain, layarmu terkunci sampai
            gurumu membukanya. <strong className="font-bold">Waktu tetap berjalan</strong> selama terkunci.
          </p>
          {/* Hitung mundur ikut dirender: murid yang belum mengetuk saat waktu
              habis tetap harus terkirim. */}
          {tenggat && (
            <p className="flex items-center gap-2 text-xs text-jingga-gelap">
              Sisa waktu <Hitung tenggat={tenggat} onHabis={() => void kirim()} />
            </p>
          )}
          <p className="text-xs text-jingga-gelap">Jawaban yang sudah kamu pilih tetap tersimpan.</p>
        </div>
        <div className="flex justify-start">
          <Button size="lg" onClick={pahamiKunci}>Mengerti, lanjutkan</Button>
        </div>
      </HalamanMurid>
    )
  }

  // Peta jawaban: ketuk gelembung nomor untuk melompat ke soalnya.
  function gulirKe(id: string) {
    document.getElementById(`soal-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="h-full bg-alas flex flex-col">
      {/* Zoom SELURUH layar soal (bilah atas + daftar) lewat wadah ini; bilah
          kirim di bawah SENGAJA di luarnya supaya tidak ikut membesar. Sesi
          berkunci: teks soal tidak bisa diseleksi atau disalin ke aplikasi lain
          (Circle to Search / Lens tetap lolos). */}
      <div
        className={`flex-1 min-h-0 flex flex-col ${kunciLayar ? 'select-none' : ''}`}
        style={{ zoom: zoomKtl.zoom }}
        onCopy={kunciLayar ? e => e.preventDefault() : undefined}
        onContextMenu={kunciLayar ? e => e.preventDefault() : undefined}
      >
        <div className="shrink-0 bg-white border-b border-garis px-4 pt-3 pb-3 flex flex-col gap-3 lg:px-8 lg:py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-tinta truncate">{sesi.judul}</p>
              <p className="text-[12.5px] text-teks-3 mt-0.5">
                {soalList.length > 0 ? `${terjawab} dari ${soalList.length} terjawab` : 'Belum ada soal'}
                {' · '}{belumTersimpan.size > 0 ? 'menyimpan…' : 'tersimpan otomatis'}
              </p>
            </div>
            {tenggat && <Hitung tenggat={tenggat} onHabis={() => void kirim()} />}
          </div>
          {soalList.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-4 px-4 lg:hidden">
              {soalList.map((s, i) => {
                const sudah = jawaban[s.id] !== undefined
                return (
                  <button key={s.id} type="button" onClick={() => gulirKe(s.id)}
                    aria-label={`Soal ${i + 1}, ${sudah ? 'sudah dijawab' : 'belum dijawab'}`}
                    className={`w-7 h-7 shrink-0 rounded-full border-2 font-mono text-[11px] font-medium flex items-center justify-center transition-colors ${
                      sudah ? 'bg-biru border-biru text-white' : 'bg-white border-pinggir text-tinta-2'}`}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 flex">
        {/* Desktop (PC lab): peta jawaban menempel di kiri bersama tombol Kirim,
            soal-soal bergulir di kanan. HP memakai strip bulat di bilah atas dan
            bilah kirim di dasar layar. */}
        {soalList.length > 0 && (
          <aside className="hidden lg:flex w-85 shrink-0 flex-col p-8 pr-4 overflow-y-auto hide-scrollbar">
            <div className="bg-white rounded-[18px] border border-garis p-5.5 flex flex-col gap-4.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[17px] font-extrabold tracking-tight text-tinta">Peta jawaban</span>
                <span className="text-[13.5px] text-teks-3">{terjawab} dari {soalList.length} terjawab</span>
              </div>
              <div className="h-2 rounded-full bg-biru-tint overflow-hidden">
                <div className="h-full rounded-full bg-biru transition-all" style={{ width: `${(terjawab / soalList.length) * 100}%` }} />
              </div>
              <div className="grid grid-cols-5 gap-3 justify-items-center">
                {soalList.map((s, i) => {
                  const sudah = jawaban[s.id] !== undefined
                  return (
                    <button key={s.id} type="button" onClick={() => gulirKe(s.id)}
                      aria-label={`Soal ${i + 1}, ${sudah ? 'sudah dijawab' : 'belum dijawab'}`}
                      className={`w-10 h-10 rounded-full border-2 font-mono text-[15px] font-medium flex items-center justify-center transition-colors ${
                        sudah ? 'bg-biru border-biru text-white' : 'bg-white border-pinggir text-tinta-2 hover:border-biru'}`}>
                      {i + 1}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-4.5 text-[12.5px] text-teks-3">
                <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-biru border-2 border-biru" />Terjawab</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-pinggir" />Belum</span>
              </div>
              <Button size="lg" fullWidth disabled={fase === 'mengirim'} onClick={() => setKonfirmasiKirim(true)}>
                {fase === 'mengirim' ? 'Mengirim...' : 'Kirim jawaban'}
              </Button>
              <p className="text-[13px] text-teks-3 text-center -mt-1.5">
                {semuaTerjawab ? 'Semua soal sudah dijawab' : `${soalList.length - terjawab} soal belum dijawab`}
              </p>
            </div>
          </aside>
        )}
        <div className="flex-1 min-w-0 overflow-y-auto overscroll-contain hide-scrollbar">
          <HalamanMurid>
            {sesi.deskripsi?.trim() && (
              <KartuKepalaMurid judul={sesi.judul} deskripsi={sesi.deskripsi} />
            )}

            {perluAktifkanKunci && (
              <div className="bg-jingga-tipis rounded-2xl border border-jingga-garis px-4 py-3 flex items-center gap-3">
                <Ikon nama="kunci" className="w-5 h-5 text-jingga shrink-0" />
                <p className="flex-1 text-[13px] text-jingga-gelap">Sesi ini memakai kunci layar. Aktifkan layar penuh.</p>
                <Button variant="secondary" size="sm" onClick={mintaLayarPenuh} className="shrink-0">Aktifkan</Button>
              </div>
            )}

            {/* Daftar soal bisa berubah panjang di tengah pengerjaan; tanpa
                pemberitahuan murid mengira aplikasinya rusak. */}
            {kontenBaru && (
              <div className="bg-white rounded-2xl border border-garis px-4 py-3 flex items-center gap-3">
                <p className="flex-1 text-[13px] text-tinta-2">Gurumu mengubah soal di sesi ini.</p>
                <Button variant="ghost" size="sm" onClick={() => setKontenBaru(false)}>Tutup</Button>
              </div>
            )}

            {soalList.length === 0 && (
              <div className="bg-white rounded-2xl border border-garis px-5 py-8 text-sm text-teks-3 text-center">
                Sesi ini belum berisi soal.
              </div>
            )}

            {soalList.map((soal, i) => (
              <div key={soal.id} id={`soal-${soal.id}`} className="scroll-mt-2">
                <KartuSoalMurid nomor={i + 1} pertanyaan={soal.pertanyaan} pilihan={soal.pilihan}
                  dipilih={jawaban[soal.id]} onPilih={j => void pilih(soal.id, j)} />
              </div>
            ))}

            {pesan && <p className="text-sm font-medium text-jingga-gelap px-1">{pesan}</p>}
            <div className="h-6" />
          </HalamanMurid>
        </div>
        </div>
      </div>

      {soalList.length > 0 && (
        <div className="lg:hidden shrink-0 bg-white border-t border-garis px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3.5">
          <p className="flex-1 text-[13px] leading-snug text-tinta-2">
            {semuaTerjawab ? 'Semua soal sudah dijawab' : `${soalList.length - terjawab} soal belum dijawab`}
          </p>
          <Button size="lg" disabled={fase === 'mengirim'} onClick={() => setKonfirmasiKirim(true)}>
            {fase === 'mengirim' ? 'Mengirim...' : 'Kirim jawaban'}
          </Button>
        </div>
      )}

      {konfirmasiKirim && (
        <Dialog judul="Kirim jawaban?" onTutup={() => setKonfirmasiKirim(false)}
          aksi={<>
            <Button variant="ghost" onClick={() => setKonfirmasiKirim(false)}>Batal</Button>
            <Button onClick={() => { setKonfirmasiKirim(false); void kirim() }}>Kirim</Button>
          </>}>
          {semuaTerjawab
            ? 'Semua soal sudah dijawab. Jawaban tidak bisa diubah setelah dikirim.'
            : `Masih ada ${soalList.length - terjawab} soal kosong. Jawaban tidak bisa diubah setelah dikirim.`}
        </Dialog>
      )}

      {/* Di LUAR wadah yang di-zoom -- tombolnya tidak ikut membesar. */}
      <TombolZoomMengambang {...zoomKtl} />
    </div>
  )
}
