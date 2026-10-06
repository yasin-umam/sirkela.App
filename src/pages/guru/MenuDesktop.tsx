import { useState, type ReactNode } from 'react'
import type { KelasSuperSesiTersedia, SesiKelas, SuperSesi } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useFormulir, type RingkasFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { useAksiGuru } from '../../context/AksiGuruContext'
import { hitungPeserta } from '../../lib/keadaanSesi'
import { jamMenit, kelasJurusan, labelWaktu, waktuRingkas } from '../../lib/soal'
import { useKirimanSuper } from '../../lib/useKirimanSuper'
import { menitDetik, useSisaDetik } from '../../lib/waktuSesi'
import { BilahAtas } from '../../components/BilahAtas'
import { KartuKodeSekolah } from '../../components/KartuKodeSekolah'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { Eyebrow } from '../../components/ui/Eyebrow'

// ─── Menu desktop (≥ 1024px): dasbor ─────────────────────────────────────────
// Bukan kartu HP yang dilebarkan: dua kolom dengan peran jelas. Kiri = yang
// SEDANG terjadi (konsol sesi berbentuk karcis, lalu formulir terbaru); kanan =
// yang bisa dikerjakan (buat soal, kelas yang menunggu diambil, mulai sesi).
// Kepala sekolah dapat versi sendiri: Super Sesi didahulukan, urusan formulirnya
// sendiri diringkas jadi satu kartu. HP tetap memakai MenuPage.
//
// Tabel "Formulir terbaru" sengaja ADA di sini walau tab Riwayat sudah memuat
// arsipnya (di HP daftar itu dibuang dari Menu karena tumpang tindih): di desktop
// ruangnya cukup, dan "tulis soal berikutnya" biasanya dimulai dari formulir yang
// baru dibuka kemarin.

function salam(): string {
  const jam = new Date().getHours()
  return jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam'
}

const CARA: { id: 'ai' | 'teks' | 'pdf'; ikon: NamaIkon; judul: string; keterangan: string }[] = [
  { id: 'ai', ikon: 'ai', judul: 'Generate dari topik', keterangan: 'AI menulis soal dari topikmu' },
  { id: 'teks', ikon: 'impor', judul: 'Tempel dari Google Form', keterangan: 'Salin teks halaman responden' },
  { id: 'pdf', ikon: 'dokumen', judul: 'Unggah PDF', keterangan: 'Dibaca AI, maksimal 15 MB' },
]

function Kartu({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-white rounded-[18px] border border-garis ${className}`}>{children}</section>
}

function Chevron({ className = 'text-pinggir' }: { className?: string }) {
  return <Ikon nama="kanan" className={`w-4.25 h-4.25 shrink-0 ${className}`} tebal={2.2} />
}

export function MenuDesktop() {
  const { user } = useAuth()
  const { semuaSesi, kelasTersedia } = useSesi()
  const { bawaan } = useSuperSesi()
  const kepsek = user?.role === 'kepala_sekolah'

  const aktif = semuaSesi.filter(s => s.status === 'aktif')
  // Sesi hasil Super Sesi yang sudah diklaim tapi belum ditekan Mulai: guru ini
  // kemungkinan bukan penulis soalnya, jadi bloknya sendiri.
  const superSiap = aktif.filter(s => s.superSesiId != null && s.mulaiPada == null)
  const sendiri = aktif.filter(s => !(s.superSesiId != null && s.mulaiPada == null))
  const berjalan = sendiri.filter(s => s.mulaiPada).length

  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const catatan = kepsek && bawaan?.status === 'berjalan'
    ? ' · 1 Super Sesi sedang berjalan'
    : berjalan > 0 ? ` · ${berjalan} sesi sedang berjalan` : ''

  return (
    <div className="flex flex-col h-full bg-alas">
      <BilahAtas judul="Menu" tanpaSesi />
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar">
        <div className="px-8 pt-7 pb-10 max-w-350 mx-auto flex flex-col gap-6">
          <div>
            <h2 className="text-[26px] leading-tight font-extrabold tracking-tight text-tinta">{salam()}, {user?.nama}</h2>
            <p className="mt-1.5 text-[14.5px] text-teks-3">{tanggal}{catatan}</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
            {kepsek ? (
              <>
                <div className="flex flex-col gap-6 min-w-0">
                  <KonsolSuper />
                  {sendiri.length > 0 && <SesiSendiri sesi={sendiri} />}
                  <TabelSuper />
                </div>
                <div className="flex flex-col gap-6 min-w-0">
                  <KartuBuatSuper />
                  <KartuKodeSekolah />
                  {kelasTersedia.length > 0 && <KartuSiapDiambil kelas={kelasTersedia} />}
                  {superSiap.length > 0 && <KartuSiapDimulai sesi={superSiap} />}
                  <KartuKelasSendiri />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-6 min-w-0">
                  {sendiri.length > 0
                    ? <SesiSendiri sesi={sendiri} />
                    : <KartuTanpaSesi />}
                  <TabelFormulir />
                </div>
                <div className="flex flex-col gap-6 min-w-0">
                  <KartuBuatSoal />
                  {kelasTersedia.length > 0 && <KartuSiapDiambil kelas={kelasTersedia} />}
                  {superSiap.length > 0 && <KartuSiapDimulai sesi={superSiap} />}
                  <KartuMulaiSesi />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sesi sendiri: konsol karcis + baris sesi lain ───────────────────────────

function SesiSendiri({ sesi }: { sesi: SesiKelas[] }) {
  const { bukaSesi } = useAksiGuru()
  const [utama, ...lain] = sesi
  return (
    <div className="flex flex-col gap-3">
      <KonsolSesi sesi={utama} onBuka={() => bukaSesi(utama.id)} />
      {lain.map(s => (
        <button key={s.id} type="button" onClick={() => bukaSesi(s.id)}
          className="w-full bg-white rounded-2xl border border-garis px-5 py-3.5 flex items-center gap-4 text-left hover:bg-isian transition-colors">
          <span className="w-2.5 h-2.5 rounded-full bg-hijau shrink-0" />
          <span className="flex-1 min-w-0 text-[15px] font-bold text-tinta truncate">{s.judul}</span>
          <span className="font-mono text-sm font-medium text-tinta">{s.kodeJoin}</span>
          <span className="text-[13px] text-teks-3">{s.muridJoined.length} murid</span>
          <Chevron />
        </button>
      ))}
    </div>
  )
}

/** Konsol sesi: kode besar berbentuk karcis (garis sobekan), sisa waktu, dan meter murid. */
function KonsolSesi({ sesi, onBuka }: { sesi: SesiKelas; onBuka: () => void }) {
  const { daftar } = useFormulir()
  const sisa = useSisaDetik(sesi.mulaiPada, sesi.durasiMenit)
  const mulai = sesi.mulaiPada != null
  const h = hitungPeserta(sesi)
  const persen = sisa == null ? 100 : (sisa / (sesi.durasiMenit * 60)) * 100
  const mepet = persen < 20
  const asal = daftar.find(f => f.id === sesi.formulirId)
  const info = asal ? [kelasJurusan(asal.kelas, asal.jurusan), asal.mapel.trim()].filter(Boolean).join(' · ') : ''

  const meter: { angka: number; label: string; warna: string }[] = mulai
    ? [
        { angka: h.bergabung, label: 'bergabung', warna: 'text-white' },
        { angka: h.mengerjakan, label: 'mengerjakan', warna: 'text-hijau-muda' },
        { angka: h.senyap, label: 'senyap', warna: 'text-white' },
        { angka: h.terkunci, label: 'terkunci', warna: 'text-jingga-garis' },
      ]
    : [
        { angka: h.bergabung, label: 'bergabung', warna: 'text-white' },
        { angka: sesi.kontenList.reduce((n, k) => n + k.data.length, 0), label: 'soal', warna: 'text-white' },
      ]

  return (
    <section aria-label="Sesi yang sedang berjalan" className="bg-tinta text-white rounded-[20px] overflow-hidden">
      <div className="flex">
        <div className="flex-1 min-w-0 px-7 pt-6.5 pb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.12em]">
              {mulai && <span className="w-2 h-2 rounded-full bg-hijau-muda" />}
              {mulai ? 'Sesi aktif' : 'Menunggu dimulai'}
            </span>
            {info && <span className="text-[13.5px] text-biru-muda">{info}</span>}
          </div>
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight leading-tight break-words">{sesi.judul}</h3>
          <div className="mt-5.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-biru-muda">Kode sesi</p>
            <p className="font-mono text-[52px] font-medium tracking-[0.1em] leading-[1.1] mt-1">{sesi.kodeJoin}</p>
          </div>
        </div>
        <div aria-hidden className="w-0 my-5 border-l-2 border-dashed border-white/25" />
        <div className="w-75 shrink-0 px-7 pt-6.5 pb-6 flex flex-col justify-between gap-4">
          {mulai && sisa != null ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-biru-muda">Tersisa</p>
              <p className={`font-mono text-[44px] font-medium leading-[1.1] mt-1 tabular-nums ${mepet ? 'text-jingga-garis' : ''}`}>{menitDetik(sisa)}</p>
              <div className="h-2 rounded-full bg-white/14 overflow-hidden mt-3">
                <div className={`h-full rounded-full ${mepet ? 'bg-jingga' : 'bg-biru-muda'}`} style={{ width: `${persen}%` }} />
              </div>
              <p className="text-[12.5px] text-biru-muda mt-2">dari {sesi.durasiMenit} menit</p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-biru-muda">Durasi</p>
              <p className="font-mono text-[44px] font-medium leading-[1.1] mt-1">{sesi.durasiMenit}<span className="text-xl text-biru-muda"> mnt</span></p>
              <p className="text-[12.5px] text-biru-muda mt-2">Hitung mundur mulai saat sesi dimulai</p>
            </div>
          )}
          <button type="button" onClick={onBuka}
            className="h-11.5 rounded-xl bg-white text-tinta text-[14.5px] font-bold inline-flex items-center justify-center gap-2 hover:bg-biru-tint transition-colors">
            Buka kendali sesi<Ikon nama="kanan" className="w-4.25 h-4.25" tebal={2.4} />
          </button>
        </div>
      </div>
      <div className="grid border-t border-white/12" style={{ gridTemplateColumns: `repeat(${meter.length}, minmax(0, 1fr))` }}>
        {meter.map((m, i) => (
          <div key={m.label} className={`px-7 py-4 ${i > 0 ? 'border-l border-white/12' : ''}`}>
            <p className="flex items-baseline gap-2">
              <span className={`text-[28px] font-extrabold tracking-tight leading-[1.1] ${m.warna}`}>{m.angka}</span>
              <span className="text-[13px] text-biru-muda">{m.label}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Belum ada sesi: dikatakan, bukan kolom kosong melompong. */
function KartuTanpaSesi() {
  const { mulaiSesiBaru } = useAksiGuru()
  return (
    <Kartu className="border-dashed border-pinggir-2 px-7 py-8 flex items-center gap-6">
      <span className="w-14 h-14 rounded-2xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
        <Ikon nama="sesi" className="w-7 h-7" tebal={1.6} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-extrabold tracking-tight text-tinta">Tidak ada sesi yang sedang dibuka</p>
        <p className="text-[14px] text-teks-3 mt-1 leading-relaxed">
          Tulis formulir lalu tekan Kirim: sesi lahir dengan kodenya sendiri, murid bergabung tanpa akun.
        </p>
      </div>
      <button type="button" onClick={() => mulaiSesiBaru()}
        className="h-11.5 px-5 rounded-xl bg-tinta text-white text-[14.5px] font-bold hover:bg-tinta-2 transition-colors shrink-0">
        Mulai sesi baru
      </button>
    </Kartu>
  )
}

// ─── Tabel formulir terbaru ──────────────────────────────────────────────────

const KOLOM_FORMULIR = 'grid-cols-[minmax(0,1fr)_84px_140px_168px]'

function TabelFormulir() {
  const { daftar } = useFormulir()
  const { semuaSesi } = useSesi()
  const { keRiwayat } = useAksiGuru()
  const kirimanSuper = useKirimanSuper()
  const berjalan = new Set(semuaSesi.filter(s => s.status === 'aktif').map(s => s.formulirId).filter((id): id is string => !!id))
  const baris = daftar.slice(0, 5)

  return (
    <Kartu className="overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-4.5 pb-3.5">
        <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Formulir terbaru</h3>
        {daftar.length > 0 && (
          <button type="button" onClick={keRiwayat}
            className="inline-flex items-center gap-1 text-[13.5px] font-bold text-biru hover:text-biru-gelap transition-colors">
            Lihat semua<Ikon nama="kanan" className="w-3.75 h-3.75" tebal={2.4} />
          </button>
        )}
      </div>
      {baris.length === 0 ? (
        <p className="px-6 pb-6 pt-1 text-[14px] text-teks-3">Formulir yang kamu tulis atau impor muncul di sini.</p>
      ) : (
        <>
          <div className={`grid ${KOLOM_FORMULIR} gap-x-4 px-6 h-9 items-center bg-isian border-t border-garis-2 font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3`}>
            <span>Judul</span><span>Soal</span><span>Diperbarui</span><span />
          </div>
          {baris.map(f => <BarisFormulir key={f.id} f={f} berjalan={berjalan.has(f.id)} superSesi={kirimanSuper.has(f.id)} />)}
        </>
      )}
    </Kartu>
  )
}

function BarisFormulir({ f, berjalan, superSesi }: { f: RingkasFormulir; berjalan: boolean; superSesi: boolean }) {
  const { bukaFormulir, mulaiSesiBaru } = useAksiGuru()
  return (
    <div className={`group relative grid ${KOLOM_FORMULIR} gap-x-4 px-6 min-h-16 items-center border-t border-garis-2 hover:bg-isian focus-within:bg-isian transition-colors`}>
      <button type="button" onClick={() => bukaFormulir(f.id)}
        className="flex items-center gap-3.5 min-w-0 text-left after:absolute after:inset-0 after:content-['']">
        <span className="w-10 h-10 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
          <Ikon nama="dokumen" className="w-5.25 h-5.25" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14.5px] font-bold text-tinta truncate">{f.judul.trim() || 'Formulir tanpa judul'}</span>
          <span className="block text-[13px] text-teks-3 truncate">{[kelasJurusan(f.kelas, f.jurusan), f.mapel.trim()].filter(Boolean).join(' · ') || 'Belum diisi'}</span>
        </span>
      </button>
      <span className="text-sm text-tinta-2">{f.jumlahSoal} soal</span>
      <span className="text-[13.5px] text-teks-3">{waktuRingkas(f.diperbaruiPada)}</span>
      <div className="relative z-10 flex justify-end gap-2 h-9 items-center">
        {/* Lencana status diganti aksi saat baris disorot (atau difokus papan ketik). */}
        <span className="flex gap-1.5 group-hover:hidden group-focus-within:hidden">
          {berjalan && <Lencana warna="hijau" titik>Berjalan</Lencana>}
          {superSesi && <Lencana warna="biru">Super Sesi</Lencana>}
          {f.jumlahSoal === 0 && !berjalan && !superSesi && <Lencana warna="slate">Draf</Lencana>}
        </span>
        <span className="hidden group-hover:flex group-focus-within:flex gap-2">
          <button type="button" onClick={() => bukaFormulir(f.id)}
            className="h-9 px-3.5 rounded-[10px] border-[1.5px] border-pinggir-2 bg-white text-[13.5px] font-bold text-tinta inline-flex items-center gap-1.5 hover:bg-isian">
            <Ikon nama="pensil" className="w-3.75 h-3.75" tebal={2} />Edit
          </button>
          <button type="button" onClick={() => mulaiSesiBaru(f.id)}
            className="h-9 px-3.5 rounded-[10px] bg-biru text-[13.5px] font-bold text-white inline-flex items-center gap-1.5 hover:bg-biru-gelap">
            <Ikon nama="kirim" className="w-3.75 h-3.75" tebal={2} />Kirim
          </button>
        </span>
      </div>
    </div>
  )
}

function Lencana({ warna, titik = false, children }: { warna: 'hijau' | 'biru' | 'slate'; titik?: boolean; children: ReactNode }) {
  const kelas = { hijau: 'bg-hijau-tint text-hijau', biru: 'bg-biru-tint text-biru', slate: 'bg-garis-2 text-tinta-2' }[warna]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${kelas}`}>
      {titik && <span className="w-1.75 h-1.75 rounded-full bg-hijau" />}{children}
    </span>
  )
}

// ─── Kolom kanan (guru) ──────────────────────────────────────────────────────

function KartuBuatSoal() {
  const { formulirBaru, imporDariLuar, membuat } = useAksiGuru()
  const { daftar } = useFormulir()
  return (
    <Kartu className="p-5">
      <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">
        {daftar.length === 0 ? 'Mulai dari formulir' : 'Buat soal'}
      </h3>
      {daftar.length === 0 && (
        <p className="text-[13.5px] text-tinta-2 mt-1.5 leading-relaxed">
          Tulis soal pilihan ganda di satu formulir, lalu tekan Kirim. Sesi lahir dengan kodenya sendiri, murid bergabung tanpa akun, dan nilainya dihitung di server.
        </p>
      )}
      <button type="button" onClick={formulirBaru} disabled={membuat}
        className="mt-3.5 w-full h-12 rounded-xl bg-biru text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 hover:bg-biru-gelap transition-colors disabled:opacity-60">
        <Ikon nama="tambah" className="w-4.5 h-4.5" tebal={2.4} />{membuat ? 'Membuat…' : daftar.length === 0 ? 'Buat formulir pertama' : 'Formulir baru'}
      </button>
      <p className="mt-2 text-[13px] text-teks-3 text-center">Tulis soal pilihan ganda dari nol</p>
      <Eyebrow className="mt-5 mb-1.5">Atau bawa dari luar</Eyebrow>
      <div className="divide-y divide-garis-2">
        {CARA.map(c => (
          <button key={c.id} type="button" onClick={() => imporDariLuar(c.id)}
            className="w-full flex items-center gap-3 py-3 text-left hover:bg-isian -mx-2 px-2 rounded-xl transition-colors">
            <span className="w-10 h-10 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
              <Ikon nama={c.ikon} className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-bold text-tinta">{c.judul}</span>
              <span className="block text-[13px] text-teks-3 mt-px">{c.keterangan}</span>
            </span>
            <Chevron />
          </button>
        ))}
      </div>
    </Kartu>
  )
}

/** Satu baris "kelas Super Sesi siap diambil": menekannya langsung mengklaim (SS9). */
function BarisAmbil({ kelas }: { kelas: KelasSuperSesiTersedia }) {
  const { klaimKelasSuper } = useSesi()
  const { bukaSesi } = useAksiGuru()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function klaim() {
    setSibuk(true); setGalat(null)
    try {
      const sesi = await klaimKelasSuper(kelas.sesiId)
      bukaSesi(sesi.id)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 p-3 rounded-[14px] bg-jingga-tipis border border-jingga-garis">
        <span className="w-10 h-10 rounded-xl bg-jingga-tint text-jingga flex items-center justify-center shrink-0">
          <Ikon nama="orang" className="w-5.25 h-5.25" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-tinta truncate">{kelas.mapel || kelas.judul}</span>
          <span className="block text-[12.5px] text-teks-3 truncate">
            {sibuk ? 'Mengambil…' : [kelasJurusan(kelas.kelas, kelas.jurusan), kelas.superSesiJudul].filter(Boolean).join(' · ')}
          </span>
        </span>
        <button type="button" disabled={sibuk} onClick={() => void klaim()}
          className="h-9.5 px-4 rounded-[10px] bg-jingga text-white text-[13.5px] font-bold hover:bg-jingga-gelap transition-colors disabled:opacity-60">
          Ambil
        </button>
      </div>
      {galat && <p className="text-xs font-medium text-jingga-gelap px-1 mt-1">{galat}</p>}
    </div>
  )
}

function KartuSiapDiambil({ kelas }: { kelas: KelasSuperSesiTersedia[] }) {
  return (
    <Kartu className="p-5 border-jingga-garis">
      <div className="flex items-center justify-between">
        <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Siap diambil</h3>
        <span className="text-[12.5px] font-extrabold text-jingga-gelap bg-jingga-tint px-2.5 py-0.75 rounded-full">{kelas.length} kelas</span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-teks-3">Kelas Super Sesi yang belum punya pengawas</p>
      <div className="mt-3.5 flex flex-col gap-2.5">
        {kelas.map(k => <BarisAmbil key={k.sesiId} kelas={k} />)}
      </div>
    </Kartu>
  )
}

function KartuSiapDimulai({ sesi }: { sesi: SesiKelas[] }) {
  const { bukaSesi } = useAksiGuru()
  return (
    <Kartu className="p-5">
      <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Super Sesi siap dimulai</h3>
      <p className="mt-1 text-[13px] leading-snug text-teks-3">Kelas yang sudah kamu ambil. Buka, bagikan kodenya, lalu mulai.</p>
      <div className="mt-3.5 flex flex-col gap-2.5">
        {sesi.map(s => (
          <button key={s.id} type="button" onClick={() => bukaSesi(s.id)}
            className="w-full flex items-center gap-3 p-3 rounded-[14px] border border-garis text-left hover:bg-isian transition-colors">
            <span className="w-10 h-10 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
              <Ikon nama="perisai" className="w-5.25 h-5.25" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-tinta truncate">{s.judul}</span>
              <span className="block text-[12.5px] text-teks-3 truncate">{s.superSesiJudul}</span>
            </span>
            <Chevron />
          </button>
        ))}
      </div>
    </Kartu>
  )
}

function KartuMulaiSesi() {
  const { mulaiSesiBaru } = useAksiGuru()
  return (
    <button type="button" onClick={() => mulaiSesiBaru()}
      className="w-full flex items-center gap-3.5 bg-tinta rounded-[18px] px-5 py-4.5 text-left text-white hover:bg-tinta-2 transition-colors">
      <span className="w-11 h-11 rounded-[13px] bg-white/12 flex items-center justify-center shrink-0">
        <Ikon nama="sesi" className="w-5.5 h-5.5" tebal={1.9} />
      </span>
      <span className="flex-1">
        <span className="block text-[16.5px] font-extrabold tracking-tight">Mulai sesi baru</span>
        <span className="block text-[13px] text-biru-muda mt-0.5">Pilih formulir, langsung kirim</span>
      </span>
      <Ikon nama="kanan" className="w-4.75 h-4.75 text-biru-muda" tebal={2.2} />
    </button>
  )
}

// ─── Kepala sekolah ──────────────────────────────────────────────────────────

/** Konsol Super Sesi: yang berjalan, kalau tidak ada yang masih mengumpulkan. */
function KonsolSuper() {
  const { bawaan, submisi, submisiId } = useSuperSesi()
  const { keSuperSesi, buatSuperSesi } = useAksiGuru()

  if (!bawaan) {
    return (
      <Kartu className="border-dashed border-pinggir-2 px-7 py-8 flex items-center gap-6">
        <span className="w-14 h-14 rounded-2xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
          <Ikon nama="perisai" className="w-7 h-7" tebal={1.6} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-extrabold tracking-tight text-tinta">Belum ada Super Sesi yang berjalan</p>
          <p className="text-[14px] text-teks-3 mt-1 leading-relaxed">
            Buat satu, lalu minta guru mapel mengirim soal ulangan ke sana. Mulai serentak kalau semua kiriman sudah masuk.
          </p>
        </div>
        <button type="button" onClick={buatSuperSesi}
          className="h-11.5 px-5 rounded-xl bg-biru text-white text-[14.5px] font-bold hover:bg-biru-gelap transition-colors shrink-0">
          Buat Super Sesi
        </button>
      </Kartu>
    )
  }

  const berjalan = bawaan.status === 'berjalan'
  const data = submisiId === bawaan.id ? submisi : null
  const kiriman = data?.length
  // "Berjalan" = kelasnya sudah diambil pengawas; yang belum diambil dihitung sendiri.
  const hidup = data?.filter(k => k.sesiStatus === 'aktif' && k.pengawasId).length
  const belum = data?.filter(k => k.sesiId && !k.pengawasId).length
  const terkunci = data?.reduce((n, k) => n + (k.sesiStatus === 'aktif' ? k.murid.filter(m => m.terkunciPada !== null).length : 0), 0)
  const angka = (n: number | undefined) => (n === undefined ? '–' : n)

  const meter: { angka: string | number; label: string; warna: string }[] = berjalan
    ? [
        { angka: angka(kiriman), label: 'kiriman', warna: 'text-white' },
        { angka: angka(hidup), label: 'berjalan', warna: 'text-hijau-muda' },
        { angka: angka(belum), label: 'belum diambil', warna: 'text-jingga-garis' },
        { angka: angka(terkunci), label: 'terkunci', warna: 'text-jingga-garis' },
      ]
    : [{ angka: angka(kiriman), label: 'kiriman masuk', warna: 'text-white' }]

  return (
    <section aria-label="Super Sesi" className="bg-tinta text-white rounded-[20px] overflow-hidden">
      <div className="flex items-center gap-6 px-7 pt-6.5 pb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.12em]">
              {berjalan && <span className="w-2 h-2 rounded-full bg-hijau-muda" />}
              {berjalan ? 'Super Sesi berjalan' : 'Mengumpulkan kiriman'}
            </span>
            {berjalan && bawaan.mulaiPada && (
              <span className="text-[13.5px] text-biru-muda">Dimulai {labelWaktu(bawaan.mulaiPada).toLowerCase()}, {jamMenit(bawaan.mulaiPada)}</span>
            )}
          </div>
          <h3 className="mt-3.5 text-[28px] font-extrabold tracking-tight leading-tight break-words">{bawaan.judul}</h3>
          {bawaan.deskripsi && <p className="mt-1.5 text-sm text-biru-muda">{bawaan.deskripsi}</p>}
        </div>
        <button type="button" onClick={() => keSuperSesi(bawaan.id)}
          className="shrink-0 h-11.5 px-5 rounded-xl bg-white text-tinta text-[14.5px] font-bold inline-flex items-center gap-2 hover:bg-biru-tint transition-colors">
          {berjalan ? 'Buka pengawasan' : 'Buka Super Sesi'}<Ikon nama="kanan" className="w-4.25 h-4.25" tebal={2.4} />
        </button>
      </div>
      <div className="grid border-t border-white/12" style={{ gridTemplateColumns: `repeat(${meter.length}, minmax(0, 1fr))` }}>
        {meter.map((m, i) => (
          <div key={m.label} className={`px-7 py-4 ${i > 0 ? 'border-l border-white/12' : ''}`}>
            <p className="flex items-baseline gap-2">
              <span className={`text-[28px] font-extrabold tracking-tight leading-[1.1] ${m.warna}`}>{m.angka}</span>
              <span className="text-[13px] text-biru-muda">{m.label}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

const STATUS_SUPER: Record<SuperSesi['status'], { label: string; kelas: string }> = {
  berjalan: { label: 'Berjalan', kelas: 'bg-hijau-tint text-hijau' },
  mengumpulkan: { label: 'Mengumpulkan', kelas: 'bg-biru-tint text-biru' },
  selesai: { label: 'Selesai', kelas: 'bg-garis-2 text-tinta-2' },
}

function TabelSuper() {
  const { semuaSuperSesi } = useSuperSesi()
  const { keSuperSesi } = useAksiGuru()
  const kolom = 'grid-cols-[minmax(0,1fr)_150px_110px]'
  return (
    <Kartu className="overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-4.5 pb-3.5">
        <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Super Sesi</h3>
        {semuaSuperSesi.length > 0 && (
          <button type="button" onClick={() => keSuperSesi()}
            className="inline-flex items-center gap-1 text-[13.5px] font-bold text-biru hover:text-biru-gelap transition-colors">
            Lihat semua<Ikon nama="kanan" className="w-3.75 h-3.75" tebal={2.4} />
          </button>
        )}
      </div>
      {semuaSuperSesi.length === 0 ? (
        <p className="px-6 pb-6 pt-1 text-[14px] text-teks-3">Super Sesi yang kamu buat muncul di sini.</p>
      ) : (
        <>
          <div className={`grid ${kolom} gap-x-4 px-6 h-9 items-center bg-isian border-t border-garis-2 font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3`}>
            <span>Judul</span><span>Status</span><span>Dibuat</span>
          </div>
          {semuaSuperSesi.slice(0, 5).map(s => {
            const st = STATUS_SUPER[s.status]
            return (
              <button key={s.id} type="button" onClick={() => keSuperSesi(s.id)}
                className={`grid ${kolom} gap-x-4 px-6 min-h-15.5 w-full items-center text-left border-t border-garis-2 hover:bg-isian transition-colors`}>
                <span className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9.5 h-9.5 rounded-[11px] bg-biru-tint text-biru flex items-center justify-center shrink-0">
                    <Ikon nama="perisai" className="w-5 h-5" tebal={1.8} />
                  </span>
                  <span className="text-[14.5px] font-bold text-tinta truncate">{s.judul}</span>
                </span>
                <span>
                  <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold px-2.5 py-1 rounded-full ${st.kelas}`}>
                    {s.status === 'berjalan' && <span className="w-1.5 h-1.5 rounded-full bg-hijau" />}{st.label}
                  </span>
                </span>
                <span className="text-[13.5px] text-teks-3">{labelWaktu(s.dibuatPada)}</span>
              </button>
            )
          })}
        </>
      )}
    </Kartu>
  )
}

function KartuBuatSuper() {
  const { buatSuperSesi } = useAksiGuru()
  return (
    <button type="button" onClick={buatSuperSesi}
      className="w-full flex items-center gap-3.5 bg-biru rounded-[18px] px-5.5 py-5 text-left text-white hover:bg-biru-gelap transition-colors">
      <span className="w-11.5 h-11.5 rounded-[14px] bg-white/18 flex items-center justify-center shrink-0">
        <Ikon nama="tambah" className="w-6 h-6" tebal={2.2} />
      </span>
      <span className="flex-1">
        <span className="block text-[17px] font-extrabold tracking-tight">Buat Super Sesi</span>
        <span className="block text-[13px] leading-snug text-biru-muda mt-0.5">Kumpulkan soal dari guru mapel, lalu mulai serentak</span>
      </span>
      <Ikon nama="kanan" className="w-4.75 h-4.75 text-biru-muda" tebal={2.2} />
    </button>
  )
}

function KartuKelasSendiri() {
  const { formulirBaru, mulaiSesiBaru, membuat } = useAksiGuru()
  return (
    <Kartu className="p-5">
      <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Kelasmu sendiri</h3>
      <p className="mt-1 text-[13px] leading-snug text-teks-3">Kamu tetap bisa menulis formulir dan membuka sesi seperti guru lain.</p>
      <div className="mt-3.5 flex gap-2.5">
        <button type="button" onClick={formulirBaru} disabled={membuat}
          className="flex-1 h-11 rounded-xl border-[1.5px] border-pinggir-2 bg-white text-sm font-bold text-tinta inline-flex items-center justify-center gap-1.75 hover:bg-isian transition-colors disabled:opacity-60">
          <Ikon nama="tambah" className="w-4 h-4" tebal={2.4} />Formulir baru
        </button>
        <button type="button" onClick={() => mulaiSesiBaru()}
          className="flex-1 h-11 rounded-xl bg-tinta text-sm font-bold text-white hover:bg-tinta-2 transition-colors">
          Mulai sesi baru
        </button>
      </div>
    </Kartu>
  )
}
