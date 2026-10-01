import { useEffect, useMemo, useState } from 'react'
import type { PesertaSesi, SesiKelas } from '../../types'
import { useSesi } from '../../context/SesiContext'
import { useKembali } from '../../context/NavContext'
import { ratakanSoalGuru } from '../../lib/sesiGuru'
import { jamMenit, labelWaktu } from '../../lib/soal'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Badge, type WarnaBadge } from '../../components/ui/Badge'
import { Sakelar } from '../../components/ui/Sakelar'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { BagikanSesi } from '../../components/BagikanSesi'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'
import { useDesktop } from '../../lib/useDesktop'
import { useSisaDetik, menitDetik } from '../../lib/waktuSesi'
import { BarisTabel, KepalaTabel } from '../../components/TabelDesktop'
import { LihatJawaban } from './LihatJawaban'

// ─── Layar Sesi (takeover dari kartu Sesi di Menu) ───────────────────────────
// Bilah kepala putih tipis dengan panah kembali + judul, lalu isi yang berganti
// menurut keadaan: daftar sesi, atau kendali SATU sesi kalau ada yang sedang
// difokuskan.
//
// Tidak ada tombol "+" / "Sesi baru" di sini: sesi di aplikasi ini TIDAK PERNAH
// lahir dari layar Sesi. Ia lahir dari formulir lewat Kirim (F2:
// `buka_sesi_formulir()` yang merakit snapshot soal), jadi satu-satunya "+"
// yang benar ada di editor formulir. Layar kosong di sini mengatakan itu,
// bukan menyodorkan tombol yang akan menipu.

const AMBANG_SENYAP_MS = 45_000 // dua kali jarak denyut murid (20 detik)
const DURASI_CEPAT = [15, 30, 45, 60]

export function statusSesi(s: SesiKelas): { label: string; warna: WarnaBadge } {
  if (s.status === 'selesai') return { label: 'Selesai', warna: 'slate' }
  if (s.mulaiPada) return { label: 'Berjalan', warna: 'hijau' }
  return { label: 'Menunggu', warna: 'slate' }
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
    <div className="flex flex-col h-full bg-alas">
      <div className="h-14 pl-1.5 pr-4 flex items-center gap-1 shrink-0 bg-white border-b border-garis lg:hidden">
        <button type="button" aria-label="Kembali"
          onClick={() => (fokus ? fokuskan(null) : onKeluar())}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 transition-colors">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <span className="text-base font-bold text-tinta">{fokus ? 'Kendali sesi' : 'Sesi'}</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 desktop:max-w-2xl desktop:w-full desktop:mx-auto lg:max-w-6xl lg:px-12 lg:pt-10 lg:pb-12">
        {fokus ? (
          <SesiAktifView sesi={fokus} onTutup={() => fokuskan(null)} onLihatJawaban={() => setLihatJawaban(true)} />
        ) : semuaSesi.length > 0 ? (
          <SesiListView onPilih={id => fokuskan(id)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-biru-tint flex items-center justify-center">
              <Ikon nama="sesi" className="w-8 h-8 text-biru" tebal={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-tinta">Belum ada sesi</p>
              <p className="text-[13px] text-teks-3 mt-1 max-w-xs leading-relaxed">
                Sesi lahir dari formulir: buka formulirmu, lalu tekan{' '}
                <strong className="text-biru">Kirim</strong>. Soalnya disalin saat itu juga dan
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

const KOLOM_SESI = 'grid-cols-[minmax(0,1fr)_120px_130px_190px_150px_24px]'

function SesiListView({ onPilih }: { onPilih: (id: string) => void }) {
  const { semuaSesi } = useSesi()
  const desktop = useDesktop()

  // Desktop: TABEL, sama dengan pil Sesi di Riwayat (kolom dan gayanya satu
  // keluarga) -- bedanya di sini baris membuka KENDALI sesi, bukan arsip.
  if (desktop) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Eyebrow>{NAMA_APLIKASI}</Eyebrow>
          <h1 className="mt-2 text-[38px] leading-tight font-extrabold tracking-tight text-tinta">Sesi</h1>
        </div>
        <div className="bg-white rounded-[18px] border border-garis overflow-hidden">
          <KepalaTabel kolom={KOLOM_SESI} judul={['Judul', 'Kode', 'Murid', 'Dibuat', 'Status', '']} />
          {semuaSesi.map(sesi => {
            const st = statusSesi(sesi)
            const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0
            return (
              <BarisTabel key={sesi.id} kolom={KOLOM_SESI} onClick={() => onPilih(sesi.id)}>
                <span className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-10.5 h-10.5 rounded-xl flex items-center justify-center shrink-0 ${
                    sesi.status === 'aktif' ? 'bg-hijau-tint text-hijau' : 'bg-garis-2 text-teks-3'}`}>
                    <Ikon nama="orang" className="w-5.5 h-5.5" tebal={1.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-tinta truncate">{sesi.judul}</span>
                    {sesi.superSesiId && <span className="block text-[13px] text-teks-3 truncate">Super Sesi: {sesi.superSesiJudul}</span>}
                  </span>
                </span>
                <span className="font-mono text-sm font-medium text-tinta">{sesi.kodeJoin}</span>
                <span className="text-sm text-tinta-2">
                  {sesi.muridJoined.length} murid
                  {terkunci > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-jingga-gelap"><Ikon nama="kunci" className="w-3 h-3" />{terkunci}</span>}
                </span>
                <span className="text-sm text-teks-3">{labelWaktu(sesi.dibuatPada)} {jamMenit(sesi.dibuatPada)}</span>
                <span><Badge warna={st.warna} titik={st.label === 'Berjalan'}>{st.label}</Badge></span>
                <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
              </BarisTabel>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] font-semibold text-teks-3 px-1">Sesi tersimpan ({semuaSesi.length})</p>
      <div className="bg-white rounded-[18px] border border-garis overflow-hidden divide-y divide-garis-2">
        {semuaSesi.map(sesi => {
          const st = statusSesi(sesi)
          const aktif = sesi.status === 'aktif'
          const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0
          return (
            <button key={sesi.id} type="button" onClick={() => onPilih(sesi.id)}
              className="w-full text-left flex items-center gap-3 px-4 py-3.5 active:bg-isian transition-colors">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                aktif ? 'bg-hijau-tint text-hijau' : 'bg-garis-2 text-teks-3'}`}>
                <Ikon nama="orang" className="w-5.5 h-5.5" tebal={1.5} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                <p className="text-[15px] font-bold leading-snug text-tinta break-words">{sesi.judul}</p>
                <p className="text-[13px] text-teks-3">
                  <span className="font-mono">{sesi.kodeJoin}</span> · {sesi.muridJoined.length} murid · {labelWaktu(sesi.dibuatPada)}
                </p>
                <span className="mt-1"><Badge warna={st.warna} titik={st.label === 'Berjalan'}>{st.label}</Badge></span>
              </div>
              {terkunci > 0 && (
                <span className="flex items-center gap-1 shrink-0 text-xs font-bold text-jingga-gelap bg-jingga-tint px-2 py-1 rounded-lg">
                  <Ikon nama="kunci" className="w-3.5 h-3.5" />{terkunci}
                </span>
              )}
              <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Satu sesi: kendali ──────────────────────────────────────────────────────

type Penyaring = 'semua' | 'terkunci' | 'senyap'

function SesiAktifView({ sesi, onTutup, onLihatJawaban }: {
  sesi: SesiKelas
  onTutup: () => void
  onLihatJawaban: () => void
}) {
  const { mulaiSesi, akhiriSesi } = useSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiAkhiri, setKonfirmasiAkhiri] = useState(false)
  const [penyaring, setPenyaring] = useState<Penyaring>('semua')

  const soalList = useMemo(() => ratakanSoalGuru(sesi.kontenList), [sesi.kontenList])
  const aktif = sesi.status === 'aktif'

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  const peserta = urutkanPeserta(sesi)
  const jumlahTerkunci = peserta.filter(p => keadaanPeserta(p, sesi).terkunci).length
  const jumlahSenyap = peserta.filter(p => { const k = keadaanPeserta(p, sesi); return k.aktif && !k.terkunci && k.senyap }).length
  const tampil = peserta.filter(p => {
    const k = keadaanPeserta(p, sesi)
    return penyaring === 'semua' || (penyaring === 'terkunci' ? k.terkunci : k.aktif && !k.terkunci && k.senyap)
  })

  const status = aktif ? (sesi.mulaiPada ? 'Sesi aktif' : 'Menunggu dimulai') : 'Sesi selesai'

  // Tombol aksi yang sama di dua tempat: kepala desktop (atas) dan dasar layar HP.
  const tombolMulai = aktif && !sesi.mulaiPada && (
    <Button size="lg" disabled={sibuk} onClick={() => void jalankan(() => mulaiSesi(sesi.id))} className="lg:h-12 max-lg:w-full">
      <Ikon nama="kirim" className="w-4.5 h-4.5" />Mulai sesi
    </Button>
  )
  const tombolAkhiri = aktif && (
    // SENGAJA tidak digate ke mulaiPada -- ini satu-satunya tombol yang boleh
    // mengakhiri sesi, jadi sesi yang belum dimulai pun tetap butuh jalan
    // keluar yang eksplisit.
    <Button variant="danger-garis" size="lg" disabled={sibuk} onClick={() => setKonfirmasiAkhiri(true)} className="lg:h-12 max-lg:w-full">
      Akhiri sesi
    </Button>
  )

  return (
    <div className="flex flex-col gap-3 lg:gap-6">
      {/* ── Kepala DESKTOP: jejak, judul, status, aksi ── */}
      <div className="hidden lg:flex items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13.5px] text-teks-3">
            <button type="button" onClick={onTutup} className="font-semibold hover:text-tinta transition-colors">Sesi</button>
            <Ikon nama="kanan" className="w-3.5 h-3.5" tebal={2.2} />
            <span>Kendali sesi</span>
          </div>
          <div className="flex items-center gap-3.5 mt-2.5 flex-wrap">
            <h1 className="text-[34px] leading-tight font-extrabold tracking-tight text-tinta break-words">{sesi.judul}</h1>
            <Badge warna={aktif && sesi.mulaiPada ? 'hijau' : 'slate'} titik={aktif && !!sesi.mulaiPada}>{status}</Badge>
          </div>
          <p className="text-[14.5px] text-teks-3 mt-2">
            {soalList.length} soal · {sesi.durasiMenit} menit · {sesi.muridJoined.length} murid bergabung
            {sesi.superSesiId && <> · Super Sesi: {sesi.superSesiJudul}</>}
            {!aktif && sesi.selesaiPada && <> · Diakhiri {labelWaktu(sesi.selesaiPada).toLowerCase()} pukul {jamMenit(sesi.selesaiPada)}. Nilai masih bisa diveto.</>}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          {soalList.length > 0 && (
            <Button variant="secondary" onClick={onLihatJawaban} className="h-12!">
              <Ikon nama="centangLingkar" className="w-4.5 h-4.5" />Lihat jawaban &amp; nilai
            </Button>
          )}
          {tombolMulai}
          {tombolAkhiri}
        </div>
      </div>

      {/* Kartu info sesi (HP) -- satu-satunya kartu tinta penuh di layar ini.
          Layar ini SENGAJA tidak punya tombol tutup sendiri: panah kembali di
          bilah atas cuma keluar dari layar sesi, TIDAK PERNAH mengakhiri
          sesinya -- satu-satunya jalan mengakhiri adalah tombol "Akhiri sesi".
          Sesi tetap 'aktif' di DB dan gampang dibuka lagi dari daftar maupun
          blok "Sedang berjalan" di Menu. */}
      <div className="rounded-[20px] bg-tinta text-white p-[18px] lg:hidden">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.12em]">
          {aktif && sesi.mulaiPada && <span className="w-2 h-2 rounded-full bg-hijau-muda" />}
          {status}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight leading-tight break-words">{sesi.judul}</h1>
        <p className="mt-2.5 flex flex-wrap gap-x-4.5 gap-y-1 text-sm text-biru-muda">
          <span>{soalList.length} soal</span>
          <span>{sesi.durasiMenit} menit</span>
          <span>{sesi.muridJoined.length} murid</span>
        </p>
        {sesi.superSesiId && (
          // Sesi ini lahir dari mulai_super_sesi(), bukan dari Kirim milik
          // guru ini sendiri (SS2/SS3) -- badge ini satu-satunya penjelasan
          // "kenapa sesi ini muncul" yang guru pengawas punya.
          <div className="flex items-center gap-1.5 text-xs font-bold text-biru-muda bg-white/12 rounded-lg px-2.5 py-1.5 w-fit mt-3">
            <Ikon nama="perisai" className="w-3.5 h-3.5" />Super Sesi: {sesi.superSesiJudul}
          </div>
        )}
        {!aktif && sesi.selesaiPada && (
          <p className="text-[13px] text-biru-muda mt-3">
            Diakhiri {labelWaktu(sesi.selesaiPada).toLowerCase()} pukul {jamMenit(sesi.selesaiPada)}. Nilai masih bisa diveto.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        {/* Kolom kiri desktop: kode & QR, sisa waktu, durasi, kunci layar. Di HP
            urutannya sisa waktu dulu (tenggat paling sering dilirik). */}
        <div className="flex flex-col gap-3 lg:gap-4.5">
          {aktif && sesi.mulaiPada && <Hitungan mulaiPada={sesi.mulaiPada} durasiMenit={sesi.durasiMenit} />}

          {aktif && (
            <div className="bg-white rounded-[18px] border border-garis p-4 lg:p-5.5 lg:order-first">
              <BagikanSesi kode={sesi.kodeJoin} qrSebaris />
            </div>
          )}

          {aktif && !sesi.mulaiPada && <KartuDurasi sesi={sesi} />}

          {aktif && <KartuKunciLayar sesi={sesi} />}
        </div>

        {/* Daftar murid */}
        <div className="bg-white rounded-[18px] border border-garis overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-garis-2 lg:border-b-0 lg:px-5.5 lg:pt-5 lg:pb-4">
            <span className="flex items-center gap-2.5">
              <span className="text-[15px] lg:text-[17px] font-extrabold text-tinta">Murid bergabung</span>
              <span className={`text-[13px] font-extrabold px-3 py-0.5 rounded-full ${
                sesi.muridJoined.length > 0 ? 'bg-biru-tint text-biru' : 'bg-garis-2 text-teks-3'}`}>
                {sesi.muridJoined.length}
              </span>
            </span>
            {/* Penyaring: hanya di desktop, tempat daftarnya cukup panjang untuk
                dicari. Memilih penyaring TIDAK mengubah apa pun di server. */}
            {sesi.muridJoined.length > 0 && (
              <div className="hidden lg:flex gap-2" role="group" aria-label="Saring murid">
                {([['semua', 'Semua', peserta.length], ['terkunci', 'Terkunci', jumlahTerkunci], ['senyap', 'Senyap', jumlahSenyap]] as const).map(([id, label, n]) => (
                  <button key={id} type="button" aria-pressed={penyaring === id} onClick={() => setPenyaring(id)}
                    className={`h-9 px-3.5 rounded-full text-[13.5px] font-bold border transition-colors ${
                      penyaring === id ? 'bg-tinta text-white border-tinta' : 'bg-white text-tinta-2 border-garis hover:border-pinggir'}`}>
                    {label} <span className={`font-medium ${penyaring === id ? 'text-biru-muda' : 'text-teks-3'}`}>{n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {sesi.muridJoined.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-7 text-center">
              <Ikon nama="orang" className="w-8 h-8 text-pinggir-2" tebal={1.5} />
              <p className="text-[13px] text-teks-3">Menunggu murid bergabung</p>
              <p className="text-[13px] text-teks-3">
                Bagikan kode <strong className="text-biru font-mono">{sesi.kodeJoin}</strong>
              </p>
            </div>
          ) : tampil.length === 0 ? (
            <p className="px-5.5 pb-6 text-[13.5px] text-teks-3">Tidak ada murid yang cocok dengan penyaring ini.</p>
          ) : (
            <div className="divide-y divide-garis-2 lg:divide-y-0 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:px-5.5 lg:pb-5.5">
              {tampil.map(p => <BarisPeserta key={p.muridId} peserta={p} sesi={sesi} />)}
            </div>
          )}
        </div>
      </div>

      {/* Jawaban & nilai -- satu tombol untuk SELURUH sesi: semua soal digabung
          jadi satu kuis, satu baris nilai per murid (selesaikan_murid). Di
          desktop tombolnya ada di kepala halaman. */}
      {soalList.length > 0 && (
        <button type="button" onClick={onLihatJawaban}
          className="lg:hidden w-full flex items-center gap-3 bg-white rounded-[18px] border border-garis px-4 py-3.5 active:bg-isian transition-colors text-left">
          <div className="w-11 h-11 rounded-xl bg-biru-tint flex items-center justify-center shrink-0">
            <Ikon nama="centangLingkar" className="w-5.5 h-5.5 text-biru" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-tinta">Lihat jawaban &amp; nilai</p>
            <p className="text-[13px] text-teks-3">{soalList.length} soal · tinjau jawaban dan ubah nilai per murid</p>
          </div>
          <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
        </button>
      )}

      {galat && <p className="text-sm font-medium text-jingga-gelap px-1">{galat}</p>}

      {aktif && (
        <div className="flex flex-col gap-2.5 mt-1 lg:hidden">
          {tombolMulai}
          {!sesi.mulaiPada && (
            <p className="text-[13px] text-teks-3 text-center">
              Murid sudah bisa bergabung. Hitung mundur baru dimulai saat kamu menekan ini.
            </p>
          )}
          {tombolAkhiri}
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

/** Keadaan satu murid saat INI: dipakai penyaring di atas dan baris peserta di bawah. */
function keadaanPeserta(p: PesertaSesi, sesi: SesiKelas) {
  const aktif = sesi.status === 'aktif'
  // Kunci efektif = sesi masih berkunci. Mematikan sakelar membebaskan murid
  // walau barisnya belum tersiar ulang.
  const terkunci = aktif && sesi.kunciLayar && p.terkunciPada !== null
  const denyutMs = p.terakhirDenyut ? new Date(p.terakhirDenyut).getTime() : 0
  const senyap = !denyutMs || Date.now() - denyutMs > AMBANG_SENYAP_MS
  return { aktif, terkunci, denyutMs, senyap }
}

/** Yang terkunci dulu -- guru sedang ditunggu mereka. Sisanya urutan bergabung. */
function urutkanPeserta(sesi: SesiKelas): PesertaSesi[] {
  if (!sesi.kunciLayar) return sesi.muridJoined
  return [...sesi.muridJoined].sort((a, b) => Number(b.terkunciPada !== null) - Number(a.terkunciPada !== null))
}

function Hitungan({ mulaiPada, durasiMenit }: { mulaiPada: string; durasiMenit: number }) {
  const sisa = useSisaDetik(mulaiPada, durasiMenit) ?? 0
  const persen = (sisa / (durasiMenit * 60)) * 100
  const mepet = persen < 20
  return (
    <div className="bg-white rounded-[18px] border border-garis px-4 py-3.5 lg:px-5.5 lg:py-4.5">
      <div className="flex items-center gap-3">
        <Ikon nama="jam" className={`w-5.5 h-5.5 lg:w-6 lg:h-6 shrink-0 ${mepet ? 'text-jingga' : 'text-biru'}`} />
        <span className={`font-mono text-[34px] lg:text-[38px] font-medium leading-none tabular-nums ${mepet ? 'text-jingga-gelap' : 'text-tinta'}`}>
          {menitDetik(sisa)}
        </span>
        <span className="text-[13px] lg:text-sm text-teks-3">{sisa === 0 ? 'Waktu habis' : 'tersisa'}</span>
      </div>
      {/* Meter: lintasannya satu tingkat lebih terang dari isinya (satu ramp). */}
      <div className={`mt-3 lg:mt-3.5 h-2 rounded-full overflow-hidden ${mepet ? 'bg-jingga-tint' : 'bg-biru-tint'}`}>
        <div className={`h-full rounded-full transition-all ${mepet ? 'bg-jingga' : 'bg-biru'}`}
          style={{ width: `${persen}%` }} />
      </div>
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
    <div className="bg-white rounded-[18px] border border-garis p-4 flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-extrabold text-tinta">Durasi pengerjaan</p>
        <p className="text-[13px] text-teks-3 mt-0.5 leading-relaxed">
          Hitung mundur dimulai saat kamu menekan Mulai sesi. Masih bisa diubah sampai itu ditekan.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {DURASI_CEPAT.map(d => (
          <button key={d} type="button" onClick={() => setDurasi(String(d))} aria-pressed={angka === d}
            className={`h-11 rounded-xl text-sm font-bold border-[1.5px] transition-colors ${
              angka === d
                ? 'bg-biru text-white border-biru'
                : 'bg-white text-tinta-2 border-garis hover:border-biru'}`}>
            {d} mnt
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <span className="text-[13px] text-teks-3 shrink-0">Atau isi manual</span>
        <input type="number" inputMode="numeric" min={1} max={600} value={durasi}
          onChange={e => setDurasi(e.target.value)}
          onWheel={e => e.currentTarget.blur()}
          className={`w-20 h-11 px-3 rounded-xl border-[1.5px] text-sm font-bold text-right text-tinta outline-none transition-colors ${
            valid ? 'border-pinggir-2 focus:border-biru' : 'border-jingga'}`} />
        <span className="text-[13px] text-teks-3">menit</span>
      </label>
      {galat && <p className="text-xs font-medium text-jingga-gelap">{galat}</p>}
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
      <div className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-[18px] border ${
        sesi.kunciLayar ? 'bg-jingga-tipis border-jingga-garis' : 'bg-white border-garis'}`}>
        <Ikon nama="kunci" className={`w-5.5 h-5.5 mt-0.5 shrink-0 ${sesi.kunciLayar ? 'text-jingga' : 'text-teks-3'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-tinta">
            Kunci layar murid: {sesi.kunciLayar ? 'aktif' : 'nonaktif'}
          </span>
          <span className="block text-[13px] text-tinta-2 mt-0.5 leading-relaxed">
            Sesi ini bagian dari Super Sesi. Kepala sekolah yang mengatur kunci layar dan membuka kunci murid, bukan kamu.
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className={`rounded-[18px] border overflow-hidden ${
      sesi.kunciLayar ? 'bg-jingga-tipis border-jingga-garis' : 'bg-white border-garis'}`}>
      <div className="px-4 py-3.5 flex items-start gap-3">
        <Ikon nama="kunci" className={`w-5.5 h-5.5 mt-0.5 shrink-0 ${sesi.kunciLayar ? 'text-jingga' : 'text-teks-3'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-tinta">Kunci layar murid</p>
          <p className="text-[13px] text-tinta-2 mt-0.5 leading-relaxed">
            Murid yang keluar layar atau membuka aplikasi lain terkunci sampai kamu membukanya.
            Waktunya tetap berjalan. Mematikannya membebaskan semua yang sedang terkunci.
          </p>
        </div>
        <Sakelar aktif={sesi.kunciLayar} warna="jingga" label="Kunci layar murid" disabled={sibuk}
          onUbah={v => void jalankan(() => aturKunciLayar(sesi.id, v))} />
      </div>

      {terkunci > 0 && (
        <div className="border-t border-jingga-garis px-4 py-2.5 flex items-center gap-2">
          <p className="text-[13.5px] text-tinta flex-1">
            <strong className="font-extrabold">{terkunci} murid</strong> sedang terkunci
          </p>
          {konfirmasi ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(false)} disabled={sibuk}>Batal</Button>
              <Button variant="danger" size="sm" onClick={() => void jalankan(() => bukaKunciSemua(sesi.id))} disabled={sibuk}>
                {sibuk ? '...' : 'Ya, buka semua'}
              </Button>
            </>
          ) : (
            <Button variant="danger-garis" size="sm" onClick={() => setKonfirmasi(true)}>Buka semua</Button>
          )}
        </div>
      )}
      {galat && <p className="text-xs font-medium text-jingga-gelap px-4 pb-3">{galat}</p>}
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

  const { aktif, terkunci, denyutMs, senyap } = keadaanPeserta(peserta, sesi)

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
    : terkunci ? <span className="text-jingga-gelap font-bold">Terkunci {durasiSingkat(Date.now() - new Date(peserta.terkunciPada!).getTime())}</span>
    : senyap ? <span>{denyutMs ? `Senyap ${Math.round((Date.now() - denyutMs) / 1000)} dtk` : 'Belum mulai'}</span>
    : <span className="text-hijau font-bold"><span className="inline-block w-1.75 h-1.75 rounded-full bg-hijau mr-1.5 align-middle" />Mengerjakan</span>

  return (
    <div className={`flex items-center gap-3 px-4 py-3 lg:rounded-[14px] lg:border lg:px-3.5 lg:py-3 ${terkunci ? 'bg-jingga-tipis lg:border-jingga-garis' : 'lg:border-garis'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-extrabold ${
        terkunci ? 'bg-jingga-tint text-jingga-gelap' : 'bg-biru-tint text-biru'}`}>
        {peserta.nama.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-tinta truncate">{peserta.nama}</p>
        <p className="text-[13px] text-teks-3">{status}{sinyal && <span> · {sinyal}</span>}</p>
        {gagal && <p className="text-xs font-medium text-jingga-gelap">Gagal membuka kunci, coba lagi</p>}
      </div>
      {/* Sesi Super Sesi: wewenang buka kunci ada di kepala sekolah, bukan di
          sini -- lihat KartuKunciLayar di atas untuk penjelasannya. */}
      {terkunci && sesi.superSesiId == null && (konfirmasi ? (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(false)} disabled={membuka}>Batal</Button>
          <Button variant="danger" size="sm" onClick={() => void buka()} disabled={membuka}>{membuka ? '...' : 'Ya, buka'}</Button>
        </div>
      ) : (
        <Button variant="danger-garis" size="sm" onClick={() => setKonfirmasi(true)} className="shrink-0">
          <Ikon nama="kunci" className="w-3.5 h-3.5" />Buka
        </Button>
      ))}
    </div>
  )
}
