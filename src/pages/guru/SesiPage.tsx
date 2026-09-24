import { useEffect, useMemo, useState } from 'react'
import type { PesertaSesi, SesiKelas } from '../../types'
import { useSesi } from '../../context/SesiContext'
import { useKembali } from '../../context/NavContext'
import { ratakanSoalGuru } from '../../lib/sesiGuru'
import { jamMenit, labelWaktu } from '../../lib/soal'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { BagikanSesi } from '../../components/BagikanSesi'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'
import { LihatJawaban } from './LihatJawaban'

// ─── Layar Sesi (takeover dari kartu Sesi di Menu) ───────────────────────────
// Bentuknya mengikuti SesiPage Luang: bilah kepala tipis dengan panah kembali +
// judul, lalu isi yang berganti menurut keadaan — daftar sesi, atau kendali
// SATU sesi kalau ada yang sedang difokuskan.
//
// Beda dari Luang, tidak ada tombol "+" / FAB "Sesi baru" di sini: sesi di
// aplikasi ini TIDAK PERNAH lahir dari layar Sesi. Ia lahir dari formulir lewat
// Kirim (F2: `buka_sesi_formulir()` yang merakit snapshot soal), jadi satu-
// satunya "+" yang benar ada di editor formulir. Layar kosong di sini
// mengatakan itu, bukan menyodorkan tombol yang akan menipu.

const AMBANG_SENYAP_MS = 45_000 // dua kali jarak denyut murid (20 detik)
const DURASI_CEPAT = [15, 30, 45, 60]

export function statusSesi(s: SesiKelas): { label: string; warna: 'hijau' | 'kuning' | 'slate' } {
  if (s.status === 'selesai') return { label: 'Selesai', warna: 'slate' }
  if (s.mulaiPada) return { label: 'Berjalan', warna: 'hijau' }
  return { label: 'Menunggu', warna: 'kuning' }
}

function durasiSingkat(ms: number): string {
  const detik = Math.max(0, Math.round(ms / 1000))
  const menit = Math.floor(detik / 60)
  return menit > 0 ? `${menit}:${String(detik % 60).padStart(2, '0')}` : `${detik} dtk`
}

export function SesiPage({ onKeluar, onLayarPenuh }: {
  onKeluar: () => void
  /** true selama satu sesi dibuka -- bilah tab bawah disembunyikan. */
  onLayarPenuh: (v: boolean) => void
}) {
  const { semuaSesi, fokus, fokuskan } = useSesi()
  const [lihatJawaban, setLihatJawaban] = useState(false)

  // Sesi yang difokuskan bisa lenyap dari daftar (formulirnya dihapus lalu
  // daftarnya disiarkan ulang): fokusnya dilepas, bukan dibiarkan menampilkan
  // sesi yang sudah tidak ada.
  useEffect(() => {
    if (fokus && !semuaSesi.some(s => s.id === fokus.id)) fokuskan(null)
  }, [fokus, semuaSesi, fokuskan])

  useEffect(() => {
    onLayarPenuh(!!fokus)
    return () => onLayarPenuh(false)
  }, [fokus, onLayarPenuh])

  useKembali(() => {
    if (lihatJawaban) { setLihatJawaban(false); return true }
    if (fokus) { fokuskan(null); return true }
    onKeluar()
    return true
  })

  if (fokus && lihatJawaban) {
    return <LihatJawaban sesi={fokus} onKembali={() => setLihatJawaban(false)} />
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="px-2 py-1 flex items-center gap-2 shrink-0 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <button type="button" aria-label="Kembali"
          onClick={() => (fokus ? fokuskan(null) : onKeluar())}
          className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
          <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
        </button>
        <Ikon nama="sesi" className="w-4.5 h-4.5 text-emerald-600" />
        <span className="text-sm font-semibold text-slate-700">Sesi</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        {fokus ? (
          <SesiAktifView sesi={fokus} onTutup={() => fokuskan(null)} onLihatJawaban={() => setLihatJawaban(true)} />
        ) : semuaSesi.length > 0 ? (
          <SesiListView onPilih={id => fokuskan(id)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Ikon nama="sesi" className="w-8 h-8 text-indigo-300" tebal={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Belum ada sesi</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Sesi lahir dari formulir: buka formulirmu, lalu tekan{' '}
                <strong className="text-indigo-500">Kirim</strong>. Soalnya disalin saat itu juga dan
                sesi dapat kodenya sendiri.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Daftar semua sesi ───────────────────────────────────────────────────────

function SesiListView({ onPilih }: { onPilih: (id: string) => void }) {
  const { semuaSesi } = useSesi()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500 font-medium px-1">Sesi tersimpan ({semuaSesi.length})</p>
      {semuaSesi.map(sesi => {
        const st = statusSesi(sesi)
        const aktif = sesi.status === 'aktif'
        const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0
        return (
          <button key={sesi.id} type="button" onClick={() => onPilih(sesi.id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm active:bg-slate-50 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              aktif ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <Ikon nama="orang" className="w-5 h-5" tebal={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{sesi.judul}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-400 font-mono">{sesi.kodeJoin}</span>
                <span className="text-slate-200">·</span>
                <Badge warna={st.warna}>{st.label}</Badge>
                <span className="text-[10px] text-slate-400">{sesi.muridJoined.length} murid</span>
                <span className="text-[10px] text-slate-400">{labelWaktu(sesi.dibuatPada)}</span>
              </div>
            </div>
            {terkunci > 0 && (
              <span className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                <Ikon nama="kunci" className="w-3.5 h-3.5" />{terkunci}
              </span>
            )}
            <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Satu sesi: kendali ──────────────────────────────────────────────────────

function SesiAktifView({ sesi, onTutup, onLihatJawaban }: {
  sesi: SesiKelas
  onTutup: () => void
  onLihatJawaban: () => void
}) {
  const { mulaiSesi, akhiriSesi } = useSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiAkhiri, setKonfirmasiAkhiri] = useState(false)

  const soalList = useMemo(() => ratakanSoalGuru(sesi.kontenList), [sesi.kontenList])
  const aktif = sesi.status === 'aktif'

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Kartu info sesi -- satu-satunya kartu indigo penuh di layar ini. */}
      <div className="rounded-2xl bg-linear-to-br from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide">
              {aktif ? (sesi.mulaiPada ? 'Sesi aktif' : 'Menunggu dimulai') : 'Sesi selesai'}
            </p>
            <h3 className="font-bold text-lg mt-0.5 break-words">{sesi.judul}</h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge warna="indigo">Kode: {sesi.kodeJoin}</Badge>
              <span className="text-indigo-200 text-xs">{sesi.durasiMenit} menit</span>
              <span className="text-indigo-200 text-xs">{soalList.length} soal</span>
            </div>
            {sesi.superSesiId && (
              // Sesi ini lahir dari mulai_super_sesi(), bukan dari Kirim milik
              // guru ini sendiri (SS2/SS3) -- badge ini satu-satunya penjelasan
              // "kenapa sesi ini muncul" yang guru pengawas punya.
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-100 bg-white/10 rounded-lg px-2 py-1 w-fit mt-2">
                <Ikon nama="sesi" className="w-3 h-3" />Super Sesi: {sesi.superSesiJudul}
              </div>
            )}
            {!aktif && sesi.selesaiPada && (
              <p className="text-xs text-indigo-200 mt-2">
                Diakhiri {labelWaktu(sesi.selesaiPada).toLowerCase()} pukul {jamMenit(sesi.selesaiPada)}. Nilai masih bisa diveto.
              </p>
            )}
          </div>
          {/* SENGAJA cuma keluar dari layar sesi, TIDAK PERNAH ikut mengakhiri
              sesinya -- satu-satunya jalan mengakhiri adalah tombol "Akhiri
              sesi" di bawah. Sesi tetap 'aktif' di DB dan gampang dibuka lagi
              dari daftar maupun blok "Sedang berjalan" di Menu. */}
          <button type="button" onClick={onTutup} aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors">
            <Ikon nama="tutup" className="w-4 h-4 text-white" tebal={2} />
          </button>
        </div>
      </div>

      {aktif && sesi.mulaiPada && <Hitungan mulaiPada={sesi.mulaiPada} durasiMenit={sesi.durasiMenit} />}

      {aktif && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <BagikanSesi kode={sesi.kodeJoin} qrSebaris />
        </div>
      )}

      {aktif && !sesi.mulaiPada && <KartuDurasi sesi={sesi} />}

      {aktif && <KartuKunciLayar sesi={sesi} />}

      {/* Daftar murid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <span className="text-sm font-semibold text-slate-700">Murid bergabung</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            sesi.muridJoined.length > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
            {sesi.muridJoined.length}
          </span>
        </div>
        {sesi.muridJoined.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <Ikon nama="orang" className="w-8 h-8 text-slate-200" tebal={1.5} />
            <p className="text-xs text-slate-400">Menunggu murid bergabung</p>
            <p className="text-xs text-slate-300">
              Bagikan kode <strong className="text-indigo-400 font-mono">{sesi.kodeJoin}</strong>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {urutkanPeserta(sesi).map(p => <BarisPeserta key={p.muridId} peserta={p} sesi={sesi} />)}
          </div>
        )}
      </div>

      {/* Jawaban & nilai -- satu tombol untuk SELURUH sesi: semua soal digabung
          jadi satu kuis, satu baris nilai per murid (selesaikan_murid). */}
      {soalList.length > 0 && (
        <button type="button" onClick={onLihatJawaban}
          className="w-full flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 active:bg-slate-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Ikon nama="centangLingkar" className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">Lihat jawaban &amp; nilai</p>
            <p className="text-[11px] text-slate-400">{soalList.length} soal · tinjau jawaban dan veto nilai per murid</p>
          </div>
          <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />
        </button>
      )}

      {galat && <p className="text-sm text-red-600 px-1">{galat}</p>}

      {aktif && (
        <div className="flex flex-col gap-2">
          {!sesi.mulaiPada && (
            <>
              <Button size="lg" fullWidth disabled={sibuk}
                onClick={() => void jalankan(() => mulaiSesi(sesi.id))}>
                <Ikon nama="kirim" className="w-4 h-4" />Mulai sesi
              </Button>
              <p className="text-xs text-slate-400 text-center">
                Murid sudah bisa bergabung. Hitung mundur baru dimulai saat kamu menekan ini.
              </p>
            </>
          )}
          {/* SENGAJA tidak digate ke mulaiPada -- ini satu-satunya tombol yang
              boleh mengakhiri sesi, jadi sesi yang belum dimulai pun tetap butuh
              jalan keluar yang eksplisit. */}
          <Button variant="danger" size="lg" fullWidth disabled={sibuk}
            onClick={() => setKonfirmasiAkhiri(true)}>
            Akhiri sesi
          </Button>
        </div>
      )}

      {konfirmasiAkhiri && (
        <LembarKonfirmasi
          judul="Akhiri sesi sekarang?"
          pesan="HP murid yang masih membuka sesi ini mengirim otomatis jawaban yang sudah dipilih. Murid yang sudah menutup aplikasinya tidak mendapat nilai. Kode sesi tidak bisa dipakai lagi."
          labelAksi="Akhiri"
          sibuk={sibuk}
          onAksi={() => void jalankan(() => akhiriSesi(sesi.id)).then(() => setKonfirmasiAkhiri(false))}
          onBatal={() => setKonfirmasiAkhiri(false)}
        />
      )}
    </div>
  )
}

/** Yang terkunci dulu -- guru sedang ditunggu mereka. Sisanya urutan bergabung. */
function urutkanPeserta(sesi: SesiKelas): PesertaSesi[] {
  if (!sesi.kunciLayar) return sesi.muridJoined
  return [...sesi.muridJoined].sort((a, b) => Number(b.terkunciPada !== null) - Number(a.terkunciPada !== null))
}

function Hitungan({ mulaiPada, durasiMenit }: { mulaiPada: string; durasiMenit: number }) {
  // Tenggat diturunkan dari mulai_pada + durasi -- aturan yang sama dengan sesi_tenggat() di DB.
  const tenggatMs = new Date(mulaiPada).getTime() + durasiMenit * 60_000
  const hitung = () => Math.max(0, Math.round((tenggatMs - Date.now()) / 1000))
  const [sisa, setSisa] = useState(hitung)
  useEffect(() => {
    // Dihitung ulang dari tenggat tiap tick, BUKAN dikurangi 1: browser
    // men-throttle setInterval saat tab di-background.
    const id = setInterval(() => setSisa(hitung()), 1000)
    return () => clearInterval(id)
  }, [tenggatMs]) // eslint-disable-line react-hooks/exhaustive-deps

  const persen = (sisa / (durasiMenit * 60)) * 100
  const mepet = persen < 20
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
      <Ikon nama="jam" className={`w-5 h-5 shrink-0 ${mepet ? 'text-red-500' : 'text-indigo-500'}`} />
      <span className={`font-mono text-xl font-bold tabular-nums ${mepet ? 'text-red-600' : 'text-slate-800'}`}>
        {String(Math.floor(sisa / 60)).padStart(2, '0')}:{String(sisa % 60).padStart(2, '0')}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${mepet ? 'bg-red-500' : 'bg-indigo-600'}`}
          style={{ width: `${persen}%` }} />
      </div>
      <span className="text-xs text-slate-400 shrink-0">{sisa === 0 ? 'Waktu habis' : 'tersisa'}</span>
    </div>
  )
}

// ─── Durasi pengerjaan ───────────────────────────────────────────────────────
// Dulu diatur dari TabSetelan di editor formulir; dibuang 2026-09-22 karena
// durasi & kunci layar dua-duanya "milik sesi", bukan formulir -- kunci layar
// sudah diatur dari sini (KartuKunciLayar di bawah), sekarang durasi menyusul.
// Cuma tampil SEBELUM "Mulai sesi" ditekan (lihat guard di SesiAktifView) --
// server (atur_durasi_sesi) menolak begitu mulai_pada terisi, karena Hitungan
// sudah menghitung tenggat dari angka itu dan murid sudah melihatnya.

function KartuDurasi({ sesi }: { sesi: SesiKelas }) {
  const { aturDurasiSesi } = useSesi()
  const [durasi, setDurasi] = useState(() => String(sesi.durasiMenit))
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => { setDurasi(String(sesi.durasiMenit)) }, [sesi.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce sebelum kirim ke server -- sama pola dengan autosave formulir,
  // supaya ketikan manual tidak memicu satu RPC per digit.
  useEffect(() => {
    const n = Number(durasi)
    if (!Number.isInteger(n) || n < 1 || n > 600 || n === sesi.durasiMenit) return
    const id = setTimeout(() => {
      aturDurasiSesi(sesi.id, n).catch(e => setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.'))
    }, 600)
    return () => clearTimeout(id)
  }, [durasi, sesi.id, sesi.durasiMenit, aturDurasiSesi])

  const angka = Number(durasi)
  const valid = Number.isInteger(angka) && angka >= 1 && angka <= 600

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">Durasi pengerjaan</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
          Hitung mundur dimulai saat kamu menekan Mulai sesi -- masih bisa diubah sampai itu ditekan.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {DURASI_CEPAT.map(d => (
          <button key={d} type="button" onClick={() => setDurasi(String(d))}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              angka === d
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            {d} mnt
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <span className="text-xs text-slate-400 shrink-0">Atau isi manual</span>
        <input type="number" inputMode="numeric" min={1} max={600} value={durasi}
          onChange={e => setDurasi(e.target.value)}
          onWheel={e => e.currentTarget.blur()}
          className={`w-20 px-3 py-2 rounded-xl border text-sm text-right text-slate-800 outline-none transition-colors ${
            valid ? 'border-slate-200 focus:border-indigo-400' : 'border-red-400'}`} />
        <span className="text-xs text-slate-400">menit</span>
      </label>
      {galat && <p className="text-xs text-red-600">{galat}</p>}
    </div>
  )
}

// ─── Kunci layar di sesi berjalan ────────────────────────────────────────────
// Mematikan = membebaskan semua yang sedang terkunci. "Buka semua" = jalan
// keluar yang sama tanpa mematikan kuncinya. Keduanya dua langkah: layar guru
// sering tampil di papan tulis pintar.
//
// Satu kalimat akibat WAJIB ada di samping sakelarnya: "waktunya tetap
// berjalan" ditanggung murid, dan guru yang menyalakannya harus tahu itu
// sebelum menyalakan, bukan setelah ada murid yang ditelepon orang tuanya di
// tengah ulangan.

function KartuKunciLayar({ sesi }: { sesi: SesiKelas }) {
  const { aturKunciLayar, bukaKunciSemua } = useSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0
  // Wewenang kunci layar untuk sesi Super Sesi ADA DI kepala sekolah (server
  // menolak atur_kunci_layar/buka_kunci_semua untuk sesi jenis ini) -- kartu
  // ini jadi informasi saja, bukan kendali, supaya tidak menjanjikan aksi yang
  // akan ditolak server.
  const terpusat = sesi.superSesiId != null

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false); setKonfirmasi(false) }
  }

  if (terpusat) {
    return (
      <div className={`w-full flex items-start gap-3 px-4 py-3 rounded-2xl border ${
        sesi.kunciLayar ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
        <Ikon nama="kunci" className={`w-5 h-5 mt-0.5 shrink-0 ${sesi.kunciLayar ? 'text-amber-600' : 'text-slate-400'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-700">
            Kunci layar murid: {sesi.kunciLayar ? 'aktif' : 'nonaktif'}
          </span>
          <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
            Sesi ini bagian dari Super Sesi. Kepala sekolah yang mengatur kunci layar dan membuka kunci murid, bukan kamu.
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" role="switch" aria-checked={sesi.kunciLayar} disabled={sibuk}
        onClick={() => void jalankan(() => aturKunciLayar(sesi.id, !sesi.kunciLayar))}
        className={`w-full flex items-start gap-3 text-left px-4 py-3 rounded-2xl border transition-colors disabled:opacity-60 ${
          sesi.kunciLayar ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
        <Ikon nama="kunci" className={`w-5 h-5 mt-0.5 shrink-0 ${sesi.kunciLayar ? 'text-amber-600' : 'text-slate-400'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-700">Kunci layar murid</span>
          <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
            Murid yang keluar layar atau membuka aplikasi lain terkunci sampai kamu membukanya.
            Waktunya tetap berjalan. Mematikannya membebaskan semua yang sedang terkunci.
          </span>
        </span>
        <span className={`mt-0.5 w-10 h-6 rounded-full shrink-0 relative transition-colors ${
          sesi.kunciLayar ? 'bg-amber-500' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
            sesi.kunciLayar ? 'left-4.5' : 'left-0.5'}`} />
        </span>
      </button>

      {terkunci > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800 flex-1">
            <strong className="font-bold">{terkunci} murid</strong> sedang terkunci
          </p>
          {konfirmasi ? (
            <>
              <button type="button" onClick={() => setKonfirmasi(false)} disabled={sibuk}
                className="text-[11px] font-semibold text-slate-500 px-2 py-1.5 rounded-lg active:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={() => void jalankan(() => bukaKunciSemua(sesi.id))} disabled={sibuk}
                className="text-[11px] font-bold text-white bg-amber-600 px-2.5 py-1.5 rounded-lg active:bg-amber-700 disabled:opacity-60">
                {sibuk ? '...' : 'Ya, buka semua'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setKonfirmasi(true)}
              className="text-[11px] font-bold text-amber-700 bg-white border border-amber-300 px-2.5 py-1.5 rounded-lg active:bg-amber-100">
              Buka semua
            </button>
          )}
        </div>
      )}
      {galat && <p className="text-xs text-red-600 px-1">{galat}</p>}
    </div>
  )
}

// ─── Satu baris peserta di kendali sesi ──────────────────────────────────────
// Sinyal di sini KESAKSIAN, bukan tuduhan (A4). Yang tidak pernah bisa
// ditampilkan: aplikasi apa yang dibuka, isi layarnya, atau HP kedua.

function BarisPeserta({ peserta, sesi }: { peserta: PesertaSesi; sesi: SesiKelas }) {
  const { bukaKunciMurid } = useSesi()
  // Dirender ulang tiap 10 detik supaya label "senyap" muncul sendiri -- justru
  // ketiadaan event yang jadi sinyalnya.
  const [, tick] = useState(0)
  useEffect(() => {
    if (sesi.status !== 'aktif') return
    const id = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [sesi.status])
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [membuka, setMembuka] = useState(false)
  const [gagal, setGagal] = useState(false)

  const aktif = sesi.status === 'aktif'
  // Kunci efektif = sesi masih berkunci. Mematikan sakelar membebaskan murid
  // walau barisnya belum tersiar ulang.
  const terkunci = aktif && sesi.kunciLayar && peserta.terkunciPada !== null
  const denyutMs = peserta.terakhirDenyut ? new Date(peserta.terakhirDenyut).getTime() : 0
  const senyap = !denyutMs || Date.now() - denyutMs > AMBANG_SENYAP_MS

  const sinyal = [
    peserta.keluarLayar > 0 && `${peserta.keluarLayar}× keluar layar`,
    peserta.hilangFokus > 0 && `${peserta.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')

  async function buka() {
    setMembuka(true); setGagal(false)
    try {
      await bukaKunciMurid(sesi.id, peserta.muridId)
      setKonfirmasi(false)
    } catch {
      setGagal(true)
    } finally {
      setMembuka(false)
    }
  }

  const status = !aktif ? <span>Sesi selesai</span>
    : terkunci ? <span className="text-amber-700 font-medium">Terkunci {durasiSingkat(Date.now() - new Date(peserta.terkunciPada!).getTime())}</span>
    : senyap ? <span>{denyutMs ? `Senyap ${Math.round((Date.now() - denyutMs) / 1000)} dtk` : 'Belum mulai'}</span>
    : <span className="text-emerald-600 font-medium">● Mengerjakan</span>

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${terkunci ? 'bg-amber-50/60' : ''}`}>
      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-sm font-bold">
        {peserta.nama.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{peserta.nama}</p>
        <p className="text-[11px] text-slate-400">{status}{sinyal && <span className="text-amber-700"> · {sinyal}</span>}</p>
        {gagal && <p className="text-[11px] text-red-600">Gagal membuka kunci, coba lagi</p>}
      </div>
      {/* Sesi Super Sesi: wewenang buka kunci ada di kepala sekolah, bukan di
          sini -- lihat KartuKunciLayar di atas untuk penjelasannya. */}
      {terkunci && sesi.superSesiId == null && (konfirmasi ? (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(false)} disabled={membuka}>Batal</Button>
          <Button size="sm" onClick={() => void buka()} disabled={membuka}>{membuka ? '...' : 'Ya, buka'}</Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setKonfirmasi(true)} className="shrink-0">
          <Ikon nama="kunci" className="w-3.5 h-3.5" />Buka
        </Button>
      ))}
    </div>
  )
}
