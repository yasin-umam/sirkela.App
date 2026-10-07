import { useEffect, useMemo, useState } from 'react'
import type { PesertaSesi, SesiKelas } from '../../types'
import { useSesi } from '../../context/SesiContext'
import { useKembali } from '../../context/NavContext'
import { ratakanSoalGuru } from '../../lib/sesiGuru'
import { jamMenit, labelWaktu } from '../../lib/soal'
import { durasiSingkat, keadaanPeserta, sinyalPeserta, statusSesi, urutkanPeserta } from '../../lib/keadaanSesi'
import { useDesktop } from '../../lib/useDesktop'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { BagikanSesi } from '../../components/BagikanSesi'
import { KartuDurasi, KartuKunciLayar, KartuMuridTerlambat, KonfirmasiAkhiri } from './SesiKartu'
import { useSisaDetik, menitDetik } from '../../lib/waktuSesi'
import { LihatJawaban } from './LihatJawaban'
import { SesiDesktop } from './SesiDesktop'

// ─── Layar Sesi (takeover dari kartu Sesi di Menu) ───────────────────────────
// HP: bilah kepala putih tipis dengan panah kembali + judul, lalu isi yang
// berganti menurut keadaan: daftar sesi, atau kendali SATU sesi kalau ada yang
// sedang difokuskan.
// DESKTOP (≥ 1024px): SesiDesktop -- daftar sesi tetap di kiri, kendali sesi
// terpilih di kanan (master-detail), jadi tidak ada layar daftar yang ditutup
// layar kendali. Pilihan bawaan: sesi yang sedang berjalan.
//
// Tidak ada tombol "+" / "Sesi baru" di sini: sesi di aplikasi ini TIDAK PERNAH
// lahir dari layar Sesi. Ia lahir dari formulir lewat Kirim (F2:
// `buka_sesi_formulir()` yang merakit snapshot soal), jadi satu-satunya "+"
// yang benar ada di editor formulir. Layar kosong di sini mengatakan itu,
// bukan menyodorkan tombol yang akan menipu.

export function SesiPage({ onKeluar, onLayarPenuh }: {
  onKeluar: () => void
  /** true selama satu sesi dibuka -- bilah tab bawah disembunyikan. */
  onLayarPenuh: (v: boolean) => void
}) {
  const { semuaSesi, fokus, fokuskan } = useSesi()
  const desktop = useDesktop()
  const [lihatJawaban, setLihatJawaban] = useState(false)

  // Sesi yang difokuskan bisa lenyap dari daftar (formulirnya dihapus lalu
  // daftarnya disiarkan ulang): fokusnya dilepas, bukan dibiarkan menampilkan
  // sesi yang sudah tidak ada.
  useEffect(() => {
    if (fokus && !semuaSesi.some(s => s.id === fokus.id)) fokuskan(null)
  }, [fokus, semuaSesi, fokuskan])

  // Desktop tidak punya "layar daftar" tanpa pilihan: kalau belum ada yang
  // difokuskan, yang sedang berjalan dipilih (kalau tidak ada, yang terbaru).
  useEffect(() => {
    if (!desktop || fokus || semuaSesi.length === 0) return
    const bawaan = semuaSesi.find(s => s.status === 'aktif' && s.mulaiPada)
      ?? semuaSesi.find(s => s.status === 'aktif')
      ?? semuaSesi[0]
    fokuskan(bawaan.id)
  }, [desktop, fokus, semuaSesi, fokuskan])

  // Pindah sesi = kembali ke kendalinya, bukan terbawa ke jawaban sesi sebelumnya.
  useEffect(() => { setLihatJawaban(false) }, [fokus?.id])

  useEffect(() => {
    onLayarPenuh(!!fokus)
    return () => onLayarPenuh(false)
  }, [fokus, onLayarPenuh])

  useKembali(() => {
    if (lihatJawaban) { setLihatJawaban(false); return true }
    if (fokus && !desktop) { fokuskan(null); return true }
    onKeluar()
    return true
  })

  if (fokus && lihatJawaban) {
    return <LihatJawaban sesi={fokus} onKembali={() => setLihatJawaban(false)} />
  }

  if (desktop) return <SesiDesktop onLihatJawaban={() => setLihatJawaban(true)} />

  return (
    <div className="flex flex-col h-full bg-alas">
      <div className="h-14 pl-1.5 pr-4 flex items-center gap-1 shrink-0 bg-white border-b border-garis">
        <button type="button" aria-label="Kembali"
          onClick={() => (fokus ? fokuskan(null) : onKeluar())}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 transition-colors">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <span className="text-base font-bold text-tinta">{fokus ? 'Kendali sesi' : 'Sesi'}</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        {fokus ? (
          <SesiAktifView sesi={fokus} onLihatJawaban={() => setLihatJawaban(true)} />
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

// ─── Daftar semua sesi (HP) ──────────────────────────────────────────────────

function SesiListView({ onPilih }: { onPilih: (id: string) => void }) {
  const { semuaSesi } = useSesi()

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

// ─── Satu sesi: kendali (HP) ─────────────────────────────────────────────────

function SesiAktifView({ sesi, onLihatJawaban }: {
  sesi: SesiKelas
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

  const peserta = urutkanPeserta(sesi)
  const status = aktif ? (sesi.mulaiPada ? 'Sesi aktif' : 'Menunggu dimulai') : 'Sesi selesai'

  const tombolMulai = aktif && !sesi.mulaiPada && (
    <Button size="lg" disabled={sibuk} onClick={() => void jalankan(() => mulaiSesi(sesi.id))} className="w-full">
      <Ikon nama="kirim" className="w-4.5 h-4.5" />Mulai sesi
    </Button>
  )
  const tombolAkhiri = aktif && (
    // SENGAJA tidak digate ke mulaiPada -- ini satu-satunya tombol yang boleh
    // mengakhiri sesi, jadi sesi yang belum dimulai pun tetap butuh jalan
    // keluar yang eksplisit.
    <Button variant="danger-garis" size="lg" disabled={sibuk} onClick={() => setKonfirmasiAkhiri(true)} className="w-full">
      Akhiri sesi
    </Button>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Kartu info sesi -- satu-satunya kartu tinta penuh di layar ini.
          Layar ini SENGAJA tidak punya tombol tutup sendiri: panah kembali di
          bilah atas cuma keluar dari layar sesi, TIDAK PERNAH mengakhiri
          sesinya -- satu-satunya jalan mengakhiri adalah tombol "Akhiri sesi".
          Sesi tetap 'aktif' di DB dan gampang dibuka lagi dari daftar maupun
          blok "Sedang berjalan" di Menu. */}
      <div className="rounded-[20px] bg-tinta text-white p-[18px]">
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

      <div className="flex flex-col gap-3">
        {aktif && sesi.mulaiPada && <Hitungan mulaiPada={sesi.mulaiPada} durasiMenit={sesi.durasiMenit} />}

        {aktif && (
          <div className="bg-white rounded-[18px] border border-garis p-4">
            <BagikanSesi kode={sesi.kodeJoin} qrSebaris />
          </div>
        )}

        {aktif && !sesi.mulaiPada && <KartuDurasi sesi={sesi} />}

        {aktif && <KartuKunciLayar sesi={sesi} />}

        {aktif && sesi.mulaiPada && <KartuMuridTerlambat sesi={sesi} />}

        {/* Daftar murid */}
        <div className="bg-white rounded-[18px] border border-garis overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-garis-2">
            <span className="flex items-center gap-2.5">
              <span className="text-[15px] font-extrabold text-tinta">Murid bergabung</span>
              <span className={`text-[13px] font-extrabold px-3 py-0.5 rounded-full ${
                sesi.muridJoined.length > 0 ? 'bg-biru-tint text-biru' : 'bg-garis-2 text-teks-3'}`}>
                {sesi.muridJoined.length}
              </span>
            </span>
          </div>
          {sesi.muridJoined.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-7 text-center">
              <Ikon nama="orang" className="w-8 h-8 text-pinggir-2" tebal={1.5} />
              <p className="text-[13px] text-teks-3">Menunggu murid bergabung</p>
              <p className="text-[13px] text-teks-3">
                Bagikan kode <strong className="text-biru font-mono">{sesi.kodeJoin}</strong>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-garis-2">
              {peserta.map(p => <BarisPeserta key={p.muridId} peserta={p} sesi={sesi} />)}
            </div>
          )}
        </div>
      </div>

      {/* Jawaban & nilai -- satu tombol untuk SELURUH sesi: semua soal digabung
          jadi satu kuis, satu baris nilai per murid (selesaikan_murid). */}
      {soalList.length > 0 && (
        <button type="button" onClick={onLihatJawaban}
          className="w-full flex items-center gap-3 bg-white rounded-[18px] border border-garis px-4 py-3.5 active:bg-isian transition-colors text-left">
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
        <div className="flex flex-col gap-2.5 mt-1">
          {tombolMulai}
          {!sesi.mulaiPada && (
            <p className="text-[13px] text-teks-3 text-center">
              Murid sudah bisa bergabung. Hitung mundur baru dimulai saat kamu menekan ini.
            </p>
          )}
          {tombolAkhiri}
        </div>
      )}

      {konfirmasiAkhiri && <KonfirmasiAkhiri sibuk={sibuk}
        onAksi={() => void jalankan(() => akhiriSesi(sesi.id)).then(() => setKonfirmasiAkhiri(false))}
        onBatal={() => setKonfirmasiAkhiri(false)} />}
    </div>
  )
}

function Hitungan({ mulaiPada, durasiMenit }: { mulaiPada: string; durasiMenit: number }) {
  const sisa = useSisaDetik(mulaiPada, durasiMenit) ?? 0
  const persen = (sisa / (durasiMenit * 60)) * 100
  const mepet = persen < 20
  return (
    <div className="bg-white rounded-[18px] border border-garis px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Ikon nama="jam" className={`w-5.5 h-5.5 shrink-0 ${mepet ? 'text-jingga' : 'text-biru'}`} />
        <span className={`font-mono text-[34px] font-medium leading-none tabular-nums ${mepet ? 'text-jingga-gelap' : 'text-tinta'}`}>
          {menitDetik(sisa)}
        </span>
        <span className="text-[13px] text-teks-3">{sisa === 0 ? 'Waktu habis' : 'tersisa'}</span>
      </div>
      {/* Meter: lintasannya satu tingkat lebih terang dari isinya (satu ramp). */}
      <div className={`mt-3 h-2 rounded-full overflow-hidden ${mepet ? 'bg-jingga-tint' : 'bg-biru-tint'}`}>
        <div className={`h-full rounded-full transition-all ${mepet ? 'bg-jingga' : 'bg-biru'}`}
          style={{ width: `${persen}%` }} />
      </div>
    </div>
  )
}

// ─── Satu baris peserta di kendali sesi (HP) ─────────────────────────────────
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
  const sinyal = sinyalPeserta(peserta)

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
    <div className={`flex items-center gap-3 px-4 py-3 ${terkunci ? 'bg-jingga-tipis' : ''}`}>
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
