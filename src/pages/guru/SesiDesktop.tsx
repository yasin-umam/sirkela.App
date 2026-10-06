import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PesertaSesi, SesiKelas } from '../../types'
import { useSesi } from '../../context/SesiContext'
import { ratakanSoalGuru } from '../../lib/sesiGuru'
import { jamMenit, labelWaktu } from '../../lib/soal'
import {
  durasiSingkat, hitungPeserta, keadaanPeserta, sinyalPeserta, statusSesi, urutkanPeserta,
} from '../../lib/keadaanSesi'
import { menitDetik, useSisaDetik } from '../../lib/waktuSesi'
import { BilahAtas } from '../../components/BilahAtas'
import { BagikanSesi } from '../../components/BagikanSesi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { KartuDurasi, KartuKunciLayar, KonfirmasiAkhiri } from './SesiKartu'

// ─── Layar Sesi desktop (≥ 1024px): daftar + kendali ─────────────────────────
// Master-detail: daftar semua sesi tetap di kiri (yang berjalan paling atas),
// kendali sesi terpilih di kanan. Memilih sesi lain = mengganti panel kanan, tanpa
// "kembali ke daftar" -- guru yang memantau dua kelas bergantian tidak kehilangan
// tempat. Fokus (dan Realtime-nya) tetap hidup di SesiContext; SesiPage yang
// memilihkan sesi bawaan. HP memakai SesiPage.

type FilterDaftar = 'semua' | 'berjalan' | 'selesai'
type Penyaring = 'semua' | 'terkunci' | 'senyap'

/** Baris murid yang tampil sebelum "Tampilkan N lainnya" -- kelas besar tetap muat satu layar. */
const BATAS_BARIS = 12

function Chip({ aktif, onClick, children, jumlah }: { aktif: boolean; onClick: () => void; children: string; jumlah: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={aktif}
      className={`h-8.5 px-3.25 rounded-full text-[13px] font-bold border whitespace-nowrap transition-colors ${
        aktif ? 'bg-tinta text-white border-tinta' : 'bg-white text-tinta-2 border-garis hover:border-pinggir'}`}>
      {children} <span className={`font-medium ${aktif ? 'text-biru-muda' : 'text-teks-3'}`}>{jumlah}</span>
    </button>
  )
}

export function SesiDesktop({ onLihatJawaban }: { onLihatJawaban: () => void }) {
  const { semuaSesi, fokus, fokuskan } = useSesi()

  return (
    <div className="flex flex-col h-full bg-alas">
      <BilahAtas judul="Sesi" tanpaSesi />
      {semuaSesi.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
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
      ) : (
        <div className="flex-1 min-h-0 flex">
          <DaftarSamping fokusId={fokus?.id ?? null} onPilih={fokuskan} />
          <div className="flex-1 min-w-0 overflow-y-auto overscroll-contain hide-scrollbar">
            {fokus && (
              <div className="px-8 pt-6 pb-10 max-w-300 flex flex-col gap-5">
                <Kendali key={fokus.id} sesi={fokus} onLihatJawaban={onLihatJawaban} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Daftar di kiri ──────────────────────────────────────────────────────────

function DaftarSamping({ fokusId, onPilih }: { fokusId: string | null; onPilih: (id: string) => void }) {
  const { semuaSesi } = useSesi()
  const [filter, setFilter] = useState<FilterDaftar>('semua')

  const kelompok = [
    { judul: 'Berjalan', ikon: 'hijau', item: semuaSesi.filter(s => s.status === 'aktif' && s.mulaiPada) },
    { judul: 'Menunggu dimulai', ikon: 'biru', item: semuaSesi.filter(s => s.status === 'aktif' && !s.mulaiPada) },
    { judul: 'Selesai', ikon: 'abu', item: semuaSesi.filter(s => s.status === 'selesai') },
  ].filter(k => k.item.length > 0 && (filter === 'semua' || (filter === 'selesai') === (k.judul === 'Selesai')))
  const aktifN = semuaSesi.filter(s => s.status === 'aktif').length

  return (
    <nav aria-label="Daftar sesi" className="w-72 min-[1400px]:w-85 shrink-0 bg-white border-r border-garis px-4 py-5 overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-1.5">
      <div className="flex gap-1.5 mb-2.5">
        <Chip aktif={filter === 'semua'} onClick={() => setFilter('semua')} jumlah={semuaSesi.length}>Semua</Chip>
        <Chip aktif={filter === 'berjalan'} onClick={() => setFilter('berjalan')} jumlah={aktifN}>Berjalan</Chip>
        <Chip aktif={filter === 'selesai'} onClick={() => setFilter('selesai')} jumlah={semuaSesi.length - aktifN}>Selesai</Chip>
      </div>
      {kelompok.map(k => (
        <div key={k.judul}>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 px-1.5 pt-2.5 pb-1.5">{k.judul}</p>
          <div className="flex flex-col gap-1">
            {k.item.map(s => {
              const terpilih = s.id === fokusId
              const h = hitungPeserta(s)
              const terkunci = s.kunciLayar ? h.terkunci : 0
              return (
                <button key={s.id} type="button" onClick={() => onPilih(s.id)} aria-current={terpilih ? 'true' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    terpilih ? 'bg-biru-tipis ring-[1.5px] ring-inset ring-biru' : 'hover:bg-isian'}`}>
                  <span className={`w-9.5 h-9.5 rounded-[11px] flex items-center justify-center shrink-0 ${
                    k.ikon === 'hijau' ? 'bg-hijau-tint text-hijau' : k.ikon === 'biru' ? 'bg-biru-tint text-biru' : 'bg-garis-2 text-teks-3'}`}>
                    <Ikon nama="sesi" className="w-4.75 h-4.75" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-tinta truncate">{s.judul}</span>
                    <span className="block text-[12.5px] text-teks-3 truncate">
                      {s.status === 'aktif'
                        ? <><span className="font-mono">{s.kodeJoin}</span> · {s.muridJoined.length} murid</>
                        : <>{labelWaktu(s.dibuatPada)}, {jamMenit(s.dibuatPada)} · {s.muridJoined.length} murid</>}
                      {!s.formulirId && ' · formulir dihapus'}
                    </span>
                  </span>
                  {terkunci > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jingga-tint text-jingga-gelap text-xs font-extrabold">
                      <Ikon nama="kunci" className="w-2.75 h-2.75" tebal={2.6} />{terkunci}
                    </span>
                  )}
                  {s.superSesiId && <span className="px-2 py-0.5 rounded-full bg-biru-tint text-biru text-xs font-bold">Super Sesi</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

// ─── Kendali satu sesi ───────────────────────────────────────────────────────

function Sel({ label, children, kelas = '' }: { label: string; children: ReactNode; kelas?: string }) {
  return (
    <div className={`px-6 py-5 ${kelas}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-biru-muda">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Kendali({ sesi, onLihatJawaban }: { sesi: SesiKelas; onLihatJawaban: () => void }) {
  const { mulaiSesi, akhiriSesi } = useSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasiAkhiri, setKonfirmasiAkhiri] = useState(false)

  const soalList = useMemo(() => ratakanSoalGuru(sesi.kontenList), [sesi.kontenList])
  const aktif = sesi.status === 'aktif'
  const mulai = sesi.mulaiPada != null
  const st = statusSesi(sesi)
  const h = hitungPeserta(sesi)

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-x-6 gap-y-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-tight font-extrabold tracking-tight text-tinta break-words">{sesi.judul}</h2>
          <p className="mt-2 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-sm text-teks-3">
            <Badge warna={st.warna} titik={st.label === 'Berjalan'}>{aktif ? (mulai ? 'Sesi aktif' : 'Menunggu dimulai') : 'Sesi selesai'}</Badge>
            <span>
              {soalList.length} soal · {sesi.durasiMenit} menit · {sesi.muridJoined.length} murid bergabung
              {sesi.superSesiId && <> · Super Sesi: {sesi.superSesiJudul}</>}
              {!aktif && sesi.selesaiPada && <> · Diakhiri {labelWaktu(sesi.selesaiPada).toLowerCase()} pukul {jamMenit(sesi.selesaiPada)}. Nilai masih bisa diveto.</>}
            </span>
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          {soalList.length > 0 && (
            <Button variant="secondary" onClick={onLihatJawaban} className="h-11!">
              <Ikon nama="centangLingkar" className="w-4.25 h-4.25" />Lihat jawaban &amp; nilai
            </Button>
          )}
          {aktif && !mulai && (
            <Button disabled={sibuk} onClick={() => void jalankan(() => mulaiSesi(sesi.id))} className="h-11!">
              <Ikon nama="kirim" className="w-4.25 h-4.25" />Mulai sesi
            </Button>
          )}
          {/* SENGAJA tidak digate ke `mulai` -- ini satu-satunya tombol yang boleh
              mengakhiri sesi, jadi sesi yang belum dimulai pun tetap butuh jalan keluar. */}
          {aktif && (
            <Button variant="danger-garis" disabled={sibuk} onClick={() => setKonfirmasiAkhiri(true)} className="h-11!">
              Akhiri sesi
            </Button>
          )}
        </div>
      </div>

      {galat && <p className="text-sm font-medium text-jingga-gelap">{galat}</p>}

      {/* Ringkasan: satu-satunya kartu tinta di layar ini, seperti Hitungan di HP. */}
      <section aria-label="Ringkasan sesi" className="bg-tinta text-white rounded-[18px] grid grid-cols-[1.5fr_1fr_1fr_1fr]">
        <Sel label={aktif ? (mulai ? 'Sisa waktu' : 'Durasi') : 'Selesai'}>
          {aktif && mulai
            ? <Hitungan mulaiPada={sesi.mulaiPada!} durasiMenit={sesi.durasiMenit} />
            : aktif
              ? <p className="font-mono text-[40px] font-medium leading-none">{sesi.durasiMenit}<span className="text-lg text-biru-muda"> menit</span></p>
              : <p className="text-[22px] font-extrabold tracking-tight leading-tight">
                  {sesi.selesaiPada ? `${labelWaktu(sesi.selesaiPada)}, ${jamMenit(sesi.selesaiPada)}` : '–'}
                </p>}
        </Sel>
        <Sel label="Bergabung" kelas="border-l border-white/12">
          <p className="text-[34px] font-extrabold tracking-tight leading-[1.1]">{h.bergabung}</p>
        </Sel>
        <Sel label={aktif ? 'Mengerjakan' : 'Soal'} kelas="border-l border-white/12">
          <p className={`text-[34px] font-extrabold tracking-tight leading-[1.1] ${aktif && mulai ? 'text-hijau-muda' : ''}`}>
            {aktif ? (mulai ? h.mengerjakan : '–') : soalList.length}
          </p>
        </Sel>
        <Sel label="Terkunci" kelas="border-l border-white/12">
          <p className="flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold tracking-tight leading-[1.1] text-jingga-garis">{aktif ? h.terkunci : '–'}</span>
            {aktif && mulai && h.senyap > 0 && <span className="text-[13px] text-biru-muda">{h.senyap} senyap</span>}
          </p>
        </Sel>
      </section>

      <div className={`grid gap-5 items-start grid-cols-1 ${aktif ? 'min-[1400px]:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <TabelMurid sesi={sesi} />
        {aktif && (
          <div className="grid grid-cols-1 md:grid-cols-2 min-[1400px]:flex min-[1400px]:flex-col gap-5 min-w-0 items-start">
            <div className="bg-white rounded-[18px] border border-garis p-5">
              <BagikanSesi kode={sesi.kodeJoin} qrSebaris />
            </div>
            {!mulai && <KartuDurasi sesi={sesi} />}
            <KartuKunciLayar sesi={sesi} />
          </div>
        )}
      </div>

      {konfirmasiAkhiri && <KonfirmasiAkhiri sibuk={sibuk}
        onAksi={() => void jalankan(() => akhiriSesi(sesi.id)).then(() => setKonfirmasiAkhiri(false))}
        onBatal={() => setKonfirmasiAkhiri(false)} />}
    </>
  )
}

function Hitungan({ mulaiPada, durasiMenit }: { mulaiPada: string; durasiMenit: number }) {
  const sisa = useSisaDetik(mulaiPada, durasiMenit) ?? 0
  const persen = (sisa / (durasiMenit * 60)) * 100
  const mepet = persen < 20
  return (
    <div className="flex items-center gap-4">
      <span className={`font-mono text-[40px] font-medium leading-none tabular-nums ${mepet ? 'text-jingga-garis' : ''}`}>{menitDetik(sisa)}</span>
      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full bg-white/14 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${mepet ? 'bg-jingga' : 'bg-biru-muda'}`} style={{ width: `${persen}%` }} />
        </div>
        <p className="text-[12.5px] text-biru-muda mt-1.5">{sisa === 0 ? 'Waktu habis' : `dari ${durasiMenit} menit`}</p>
      </div>
    </div>
  )
}

// ─── Tabel murid ─────────────────────────────────────────────────────────────

const KOLOM_MURID = 'grid-cols-[minmax(0,1fr)_150px_64px]'

function TabelMurid({ sesi }: { sesi: SesiKelas }) {
  const [penyaring, setPenyaring] = useState<Penyaring>('semua')
  const [semua, setSemua] = useState(false)
  // Dirender ulang tiap 10 detik supaya "senyap"/"terkunci N dtk" muncul sendiri --
  // justru ketiadaan event yang jadi sinyalnya.
  const [, tick] = useState(0)
  useEffect(() => {
    if (sesi.status !== 'aktif') return
    const id = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [sesi.status])

  const peserta = urutkanPeserta(sesi)
  const jumlahTerkunci = peserta.filter(p => keadaanPeserta(p, sesi).terkunci).length
  const jumlahSenyap = peserta.filter(p => { const k = keadaanPeserta(p, sesi); return k.aktif && !k.terkunci && k.senyap }).length
  // Penyaring cuma mengubah TAMPILAN, tidak ada yang berubah di server.
  const tampil = peserta.filter(p => {
    const k = keadaanPeserta(p, sesi)
    return penyaring === 'semua' || (penyaring === 'terkunci' ? k.terkunci : k.aktif && !k.terkunci && k.senyap)
  })
  const terlihat = semua ? tampil : tampil.slice(0, BATAS_BARIS)

  return (
    <section aria-label="Murid" className="bg-white rounded-[18px] border border-garis overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="flex items-center gap-2.5">
          <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Murid</h3>
          <span className={`text-[13px] font-extrabold px-2.75 py-0.5 rounded-full ${
            peserta.length > 0 ? 'bg-biru-tint text-biru' : 'bg-garis-2 text-teks-3'}`}>{peserta.length}</span>
        </span>
        {peserta.length > 0 && (
          <div className="flex gap-1.5" role="group" aria-label="Saring murid">
            <Chip aktif={penyaring === 'semua'} onClick={() => setPenyaring('semua')} jumlah={peserta.length}>Semua</Chip>
            <Chip aktif={penyaring === 'terkunci'} onClick={() => setPenyaring('terkunci')} jumlah={jumlahTerkunci}>Terkunci</Chip>
            <Chip aktif={penyaring === 'senyap'} onClick={() => setPenyaring('senyap')} jumlah={jumlahSenyap}>Senyap</Chip>
          </div>
        )}
      </div>
      {peserta.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-9 text-center border-t border-garis-2">
          <Ikon nama="orang" className="w-8 h-8 text-pinggir-2" tebal={1.5} />
          <p className="text-[13px] text-teks-3">Menunggu murid bergabung</p>
          <p className="text-[13px] text-teks-3">
            Bagikan kode <strong className="text-biru font-mono">{sesi.kodeJoin}</strong>
          </p>
        </div>
      ) : tampil.length === 0 ? (
        <p className="px-5 py-5 border-t border-garis-2 text-[13.5px] text-teks-3">Tidak ada murid yang cocok dengan penyaring ini.</p>
      ) : (
        <>
          <div className={`grid ${KOLOM_MURID} gap-x-3 px-5 h-9 items-center bg-isian border-t border-garis-2 font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3`}>
            <span>Murid</span><span>Status</span><span />
          </div>
          {terlihat.map(p => <BarisMurid key={p.muridId} peserta={p} sesi={sesi} />)}
          {tampil.length > terlihat.length && (
            <button type="button" onClick={() => setSemua(true)}
              className="w-full px-5 py-3.5 border-t border-garis-2 text-left text-[13.5px] font-bold text-biru hover:bg-isian transition-colors">
              Tampilkan {tampil.length - terlihat.length} murid lainnya
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** Sinyal di sini KESAKSIAN, bukan tuduhan (A4): tidak ada nama aplikasi, isi layar, atau HP kedua. */
function BarisMurid({ peserta, sesi }: { peserta: PesertaSesi; sesi: SesiKelas }) {
  const { bukaKunciMurid } = useSesi()
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

  const status = !aktif ? <span className="text-teks-3">Sesi selesai</span>
    : terkunci ? (
      <span className="inline-flex items-center gap-1.5 text-jingga-gelap font-bold">
        <Ikon nama="kunci" className="w-3.5 h-3.5" tebal={2.4} />Terkunci {durasiSingkat(Date.now() - new Date(peserta.terkunciPada!).getTime())}
      </span>
    ) : senyap ? <span className="text-teks-3 font-semibold">{denyutMs ? `Senyap ${Math.round((Date.now() - denyutMs) / 1000)} dtk` : 'Belum mulai'}</span>
    : <span className="inline-flex items-center gap-1.75 text-hijau font-bold"><span className="w-2 h-2 rounded-full bg-hijau" />Mengerjakan</span>

  return (
    <div className={`grid ${KOLOM_MURID} gap-x-3 px-5 min-h-14 items-center border-t border-garis-2 ${terkunci ? 'bg-jingga-tipis' : ''}`}>
      <span className="flex items-center gap-3 min-w-0">
        <span className={`w-8.5 h-8.5 rounded-[10px] flex items-center justify-center shrink-0 text-sm font-extrabold ${
          terkunci ? 'bg-jingga-tint text-jingga-gelap' : 'bg-biru-tint text-biru'}`}>
          {peserta.nama.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-tinta truncate">{peserta.nama}</span>
          {gagal
            ? <span className="block text-xs font-medium text-jingga-gelap">Gagal membuka kunci</span>
            : sinyal && <span className="block text-[12.5px] text-teks-3 truncate" title={sinyal}>{sinyal}</span>}
        </span>
      </span>
      <span className="text-[13.5px]">{status}</span>
      {/* Sesi Super Sesi: wewenang buka kunci ada di kepala sekolah (lihat KartuKunciLayar). */}
      <span className="flex justify-end">
        {terkunci && sesi.superSesiId == null && (konfirmasi ? (
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(false)} disabled={membuka} className="h-8.5!">Batal</Button>
            <Button variant="danger" size="sm" onClick={() => void buka()} disabled={membuka} className="h-8.5!">{membuka ? '...' : 'Ya, buka'}</Button>
          </span>
        ) : (
          <Button variant="danger-garis" size="sm" onClick={() => setKonfirmasi(true)} className="h-8.5!">Buka</Button>
        ))}
      </span>
    </div>
  )
}
