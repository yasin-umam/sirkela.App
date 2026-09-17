import { useCallback, useEffect, useRef, useState } from 'react'
import { useKembali } from '../../context/NavContext'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Ikon } from '../../components/ui/Ikon'
import { HalamanResponden, KartuKepalaResponden, KartuSoalResponden } from '../../components/FormulirResponden'
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
    <div className={`px-3 py-1 rounded-full font-mono text-sm font-medium shrink-0 ${mepet ? 'bg-red-50 text-salah' : 'bg-indigo-50 text-indigo-700'}`}>
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
    <HalamanResponden className="select-none">
      <KartuKepalaResponden judul="Layar terkunci">
        <div className="flex flex-col gap-3 text-teks">
          <p className="flex items-start gap-2">
            <Ikon nama="kunci" className="w-5 h-5 text-amber-700 mt-px" />
            <span>Kamu keluar dari layar sesi <strong className="font-medium">{judul}</strong>. Minta gurumu membuka kuncinya.</span>
          </p>
          {tenggat && (
            <p className="flex items-center gap-2 text-teks-2">Waktu tetap berjalan <Hitung tenggat={tenggat} onHabis={onHabis} /></p>
          )}
          <p className="text-teks-2">
            {sejak && <>Terkunci sejak {sejak}. </>}Jawaban yang sudah kamu pilih tetap tersimpan.
          </p>
        </div>
      </KartuKepalaResponden>
    </HalamanResponden>
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
      <HalamanResponden>
        <KartuKepalaResponden judul={sesi.judul}>
          <div className="flex flex-col gap-4 text-teks">
            <p>Jawaban kamu telah direkam.</p>
            <div className="flex items-end gap-3">
              <p className="text-5xl leading-none text-teks">{hasil.nilai}</p>
              <p className="text-teks-2 pb-1">nilai · {hasil.benar} benar dari {hasil.total} soal</p>
            </div>
            <button type="button" onClick={onKeluar} className="self-start text-indigo-600 underline underline-offset-2">
              Kembali ke halaman kode
            </button>
          </div>
        </KartuKepalaResponden>
      </HalamanResponden>
    )
  }

  if (fase === 'memuat') {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center gap-3 py-20 text-indigo-600">
        <Spinner size={28} />
        <p className="text-sm text-teks-2">Memuat soal...</p>
      </div>
    )
  }

  if (fase === 'gagal') {
    return (
      <HalamanResponden>
        <KartuKepalaResponden judul={sesi.judul}>
          <p className="text-salah">{pesan}</p>
          <button type="button" onClick={onKeluar} className="mt-3 text-indigo-600 underline underline-offset-2">Kembali</button>
        </KartuKepalaResponden>
      </HalamanResponden>
    )
  }

  if (fase === 'menunggu') {
    return (
      <HalamanResponden>
        <KartuKepalaResponden judul={sesi.judul} deskripsi={sesi.deskripsi}>
          <div className="flex items-center gap-3 text-teks">
            <span className="relative flex w-3 h-3 shrink-0">
              <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping" />
              <span className="relative w-3 h-3 rounded-full bg-indigo-600" />
            </span>
            Kamu sudah bergabung. Menunggu guru memulai sesi.
          </div>
        </KartuKepalaResponden>
        <div>
          <Button variant="teks" onClick={onKeluar}>Keluar</Button>
        </div>
      </HalamanResponden>
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
      <HalamanResponden>
        <KartuKepalaResponden judul="Gurumu menyalakan kunci layar">
          <div className="flex flex-col gap-3 text-teks">
            <p className="leading-relaxed">
              Mulai sekarang, kalau kamu keluar dari layar ini atau membuka aplikasi lain, layarmu terkunci sampai
              gurumu membukanya. <strong className="font-medium">Waktu tetap berjalan</strong> selama terkunci.
            </p>
            {/* Hitung mundur ikut dirender: murid yang belum mengetuk saat waktu
                habis tetap harus terkirim. */}
            {tenggat && <p className="flex items-center gap-2 text-teks-2">Sisa waktu <Hitung tenggat={tenggat} onHabis={() => void kirim()} /></p>}
            <p className="text-teks-2">Jawaban yang sudah kamu pilih tetap tersimpan.</p>
          </div>
        </KartuKepalaResponden>
        <div>
          <Button onClick={pahamiKunci}>Mengerti, lanjutkan</Button>
        </div>
      </HalamanResponden>
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
      <div className="shrink-0 bg-white border-b border-garis px-4 h-12 flex items-center gap-3">
        <p className="flex-1 min-w-0 text-sm text-teks-2 truncate">
          {soalList.length > 0 ? `${terjawab} dari ${soalList.length} terjawab` : sesi.judul}
        </p>
        {belumTersimpan.size > 0 && <span className="text-xs text-teks-2 shrink-0">Menyimpan…</span>}
        {tenggat && <Hitung tenggat={tenggat} onHabis={() => void kirim()} />}
      </div>
      {soalList.length > 0 && (
        <div className="shrink-0 h-1 bg-indigo-100">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(terjawab / soalList.length) * 100}%` }} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar">
        <HalamanResponden>
          <KartuKepalaResponden judul={sesi.judul} deskripsi={sesi.deskripsi}>
            {soalList.length} pertanyaan · jawaban tersimpan otomatis
            <span className="block text-salah mt-1">* Menunjukkan pertanyaan yang wajib diisi</span>
          </KartuKepalaResponden>

          {perluAktifkanKunci && (
            <div className="bg-white rounded-lg border border-garis px-5 py-3 flex items-center gap-3">
              <Ikon nama="kunci" className="w-5 h-5 text-amber-700" />
              <p className="flex-1 text-sm text-teks">Sesi ini memakai kunci layar. Aktifkan layar penuh.</p>
              <Button variant="teks" size="sm" onClick={mintaLayarPenuh}>Aktifkan</Button>
            </div>
          )}

          {/* Daftar soal bisa berubah panjang di tengah pengerjaan; tanpa
              pemberitahuan murid mengira aplikasinya rusak. */}
          {kontenBaru && (
            <div className="bg-white rounded-lg border border-garis px-5 py-3 flex items-center gap-3">
              <p className="flex-1 text-sm text-teks">Gurumu mengubah soal di sesi ini.</p>
              <Button variant="teks" size="sm" onClick={() => setKontenBaru(false)}>Tutup</Button>
            </div>
          )}

          {soalList.length === 0 && (
            <div className="bg-white rounded-lg border border-garis px-5 py-8 text-sm text-teks-2 text-center">Sesi ini belum berisi soal.</div>
          )}

          {soalList.map(soal => (
            <KartuSoalResponden key={soal.id} pertanyaan={soal.pertanyaan} pilihan={soal.pilihan}
              dipilih={jawaban[soal.id]} onPilih={j => void pilih(soal.id, j)} />
          ))}

          {pesan && <p className="text-sm text-salah px-1">{pesan}</p>}

          {soalList.length > 0 && (
            <div className="flex items-center gap-3 pt-1 pb-24">
              <Button disabled={fase === 'mengirim'} onClick={() => setKonfirmasiKirim(true)}>
                {fase === 'mengirim' ? 'Mengirim...' : 'Kirim'}
              </Button>
              {!semuaTerjawab && <p className="text-xs text-teks-2">{soalList.length - terjawab} soal belum dijawab</p>}
            </div>
          )}
        </HalamanResponden>
      </div>

      {konfirmasiKirim && (
        <Dialog judul="Kirim jawaban?" onTutup={() => setKonfirmasiKirim(false)}
          aksi={<>
            <Button variant="teks" onClick={() => setKonfirmasiKirim(false)}>Batal</Button>
            <Button onClick={() => { setKonfirmasiKirim(false); void kirim() }}>Kirim</Button>
          </>}>
          {semuaTerjawab
            ? 'Semua soal sudah dijawab. Jawaban tidak bisa diubah setelah dikirim.'
            : `Masih ada ${soalList.length - terjawab} soal kosong. Jawaban tidak bisa diubah setelah dikirim.`}
        </Dialog>
      )}
    </div>
    {/* Di LUAR div yang di-zoom -- tombolnya tidak ikut membesar. */}
    <TombolZoomMengambang {...zoomKtl} />
    </>
  )
}
