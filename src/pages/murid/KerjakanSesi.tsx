import { useCallback, useEffect, useRef, useState } from 'react'
import { useKembali } from '../../context/NavContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
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
import { hurufPilihan } from '../../lib/soal'

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

function Hitung({ tenggat, onHabis }: { tenggat: string; onHabis: () => void }) {
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
  return (
    <div className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold shrink-0 ${mepet ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
      {String(menit).padStart(2, '0')}:{String(detik % 60).padStart(2, '0')}
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
    <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-5 px-6 py-12 text-center select-none">
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-4xl">🔒</div>
      <div>
        <p className="text-xl font-bold text-slate-800">Layar terkunci</p>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Kamu keluar dari layar sesi <strong className="text-slate-700">{judul}</strong>.<br />
          Minta gurumu membuka kuncinya.
        </p>
      </div>
      {tenggat && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs text-slate-400">Waktu tetap berjalan</p>
          <Hitung tenggat={tenggat} onHabis={onHabis} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        {sejak && <p className="text-xs text-slate-400">Terkunci sejak {sejak}</p>}
        <p className="text-xs text-slate-400">Jawaban yang sudah kamu pilih tetap tersimpan.</p>
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
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-5 px-6 py-12">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-500">Jawaban terkirim</p>
          <p className="text-5xl font-bold text-slate-800 mt-2">{hasil.nilai}</p>
          <p className="text-sm text-slate-500 mt-1">{hasil.benar} benar dari {hasil.total} soal</p>
        </div>
        <Button variant="ghost" onClick={onKeluar}>Kembali</Button>
      </div>
    )
  }

  if (fase === 'memuat') {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-3 py-20">
        <Spinner size={28} />
        <p className="text-sm text-slate-500">Memuat soal...</p>
      </div>
    )
  }

  if (fase === 'gagal') {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 py-20">
        <p className="text-sm text-red-600 text-center">{pesan}</p>
        <Button variant="ghost" onClick={onKeluar}>Kembali</Button>
      </div>
    )
  }

  if (fase === 'menunggu') {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 py-20">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-800">{sesi.judul}</p>
          <p className="text-sm text-slate-500 mt-1">Kamu sudah bergabung.<br />Menunggu guru memulai sesi.</p>
        </div>
        <Button variant="ghost" onClick={onKeluar}>Keluar</Button>
      </div>
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
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-5 px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-4xl">🔒</div>
        <div>
          <p className="text-xl font-bold text-slate-800">Gurumu menyalakan kunci layar</p>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs">
            Mulai sekarang, kalau kamu keluar dari layar ini atau membuka aplikasi lain,
            layarmu terkunci sampai gurumu membukanya. <strong className="text-slate-700">Waktu
            tetap berjalan</strong> selama terkunci.
          </p>
        </div>
        {/* Hitung mundur ikut dirender: murid yang belum mengetuk saat waktu habis
            tetap harus terkirim. */}
        {tenggat && <Hitung tenggat={tenggat} onHabis={() => void kirim()} />}
        <p className="text-xs text-slate-400 max-w-xs">Jawaban yang sudah kamu pilih tetap tersimpan.</p>
        <Button variant="primary" size="lg" onClick={pahamiKunci}>Mengerti, lanjutkan</Button>
      </div>
    )
  }

  return (
    <>
    {/* Zoom SELURUH layar di root paling luar; overflow-y-auto di bawahnya tetap
        menyerap kelebihan tinggi. Sesi berkunci: teks soal tidak bisa diseleksi
        atau disalin ke aplikasi lain (Circle to Search / Lens tetap lolos). */}
    <div
      className={`h-full bg-slate-50 flex flex-col ${kunciLayar ? 'select-none' : ''}`}
      style={{ zoom: zoomKtl.zoom }}
      onCopy={kunciLayar ? e => e.preventDefault() : undefined}
      onContextMenu={kunciLayar ? e => e.preventDefault() : undefined}
    >
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 border-t-4 border-t-indigo-600 px-4 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{sesi.judul}</p>
          {soalList.length > 0 && <p className="text-[11px] text-slate-400">{terjawab} dari {soalList.length} terjawab</p>}
        </div>
        {belumTersimpan.size > 0 && (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg shrink-0">menyimpan...</span>
        )}
        {tenggat && <Hitung tenggat={tenggat} onHabis={() => void kirim()} />}
      </div>

      {perluAktifkanKunci && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <span className="text-sm shrink-0">🔒</span>
          <p className="text-xs text-amber-800 flex-1 leading-relaxed">Sesi ini memakai kunci layar. Ketuk Aktifkan untuk layar penuh.</p>
          <button onClick={mintaLayarPenuh} className="text-[11px] font-bold text-amber-700 px-2 py-1 rounded-lg active:bg-amber-100 shrink-0">
            Aktifkan
          </button>
        </div>
      )}

      {/* Daftar soal bisa berubah panjang di tengah pengerjaan; tanpa pemberitahuan
          murid mengira aplikasinya rusak. */}
      {kontenBaru && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center gap-2">
          <p className="text-xs text-indigo-700 flex-1 leading-relaxed">Gurumu mengubah soal di sesi ini.</p>
          <button onClick={() => setKontenBaru(false)} className="text-[11px] font-bold text-indigo-600 px-2 py-1 rounded-lg active:bg-indigo-100 shrink-0">
            Tutup
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 flex flex-col gap-3">
        {soalList.length === 0 && (
          <Card><p className="text-sm text-slate-500 text-center py-6">Sesi ini belum berisi soal.</p></Card>
        )}

        {soalList.map((soal, i) => (
          <Card key={soal.id} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <p className="text-sm text-slate-800 leading-snug flex-1 whitespace-pre-wrap">{soal.pertanyaan}</p>
            </div>
            <div className="flex flex-col gap-2">
              {soal.pilihan.map((p, j) => {
                const dipilih = jawaban[soal.id] === j
                return (
                  <button key={j} onClick={() => void pilih(soal.id, j)} role="radio" aria-checked={dipilih}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors ${
                      dipilih ? 'text-indigo-700' : 'text-slate-700 active:bg-slate-100'}`}>
                    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                      dipilih ? 'border-indigo-600' : 'border-slate-400'}`}>
                      {dipilih && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </span>
                    <span className="text-sm"><span className="font-semibold">{hurufPilihan(j)}.</span> {p}</span>
                  </button>
                )
              })}
            </div>
          </Card>
        ))}

        {pesan && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{pesan}</div>}

        {soalList.length > 0 && (
          <>
            {!semuaTerjawab && (
              <p className="text-xs text-amber-600 text-center">Masih ada {soalList.length - terjawab} soal yang belum dijawab</p>
            )}
            <Button variant="primary" size="lg" fullWidth disabled={fase === 'mengirim'} onClick={() => setKonfirmasiKirim(true)}>
              {fase === 'mengirim' ? 'Mengirim...' : 'Kirim Jawaban'}
            </Button>
          </>
        )}

        <div className="h-6" />
      </div>

      {konfirmasiKirim && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm flex flex-col gap-3">
            <p className="font-bold text-slate-800">Kirim sekarang?</p>
            <p className="text-sm text-slate-500">
              {semuaTerjawab
                ? 'Semua soal sudah dijawab. Jawaban tidak bisa diubah setelah dikirim.'
                : `Masih ada ${soalList.length - terjawab} soal kosong. Jawaban tidak bisa diubah setelah dikirim.`}
            </p>
            <div className="flex gap-2 mt-1">
              <Button variant="ghost" fullWidth onClick={() => setKonfirmasiKirim(false)}>Batal</Button>
              <Button variant="primary" fullWidth onClick={() => { setKonfirmasiKirim(false); void kirim() }}>Kirim</Button>
            </div>
          </div>
        </div>
      )}
    </div>
    {/* Di LUAR div yang di-zoom -- tombolnya tidak ikut membesar. */}
    <TombolZoomMengambang {...zoomKtl} />
    </>
  )
}
