import { useState } from 'react'
import type { KelasSuperSesiTersedia } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { useDesktop } from '../../lib/useDesktop'
import { Lambang } from '../../components/Logo'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { Button } from '../../components/ui/Button'
import { KartuKodeSekolah } from '../../components/KartuKodeSekolah'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { kelasJurusan } from '../../lib/soal'
import { MenuDesktop } from './MenuDesktop'

// ─── Tab Menu: peluncur (HP) ─────────────────────────────────────────────────
// Kepala berupa sapaan (bukan bilah putih), lalu blok-blok yang muncul MENURUT
// KEADAAN guru, bukan daftar statis:
//   - Ada kelas Super Sesi yang bisa diambil -> blok "siap diambil" paling atas.
//   - Ada sesi dibuka                         -> blok "Sedang berjalan".
//   - Belum punya formulir                    -> kartu pembuka yang menjelaskan alurnya.
// Daftar formulir lengkap cuma di tab Riwayat -- di HP Menu tetap peluncur aksi,
// bukan arsip kedua.
//
// DESKTOP (≥ 1024px) tidak memakai layar ini: strukturnya beda jauh (dasbor dua
// kolom dengan konsol sesi dan tabel formulir), jadi dialihkan ke MenuDesktop.
//
// Warna dipakai untuk BERARTI: biru = membuat formulir (aksi utama), hijau =
// sesi yang sedang hidup, jingga = ada yang menunggu diambil, tinta = kartu
// Sesi (pintu ke semua kelas). Tiga cara membawa soal dari luar semuanya biru
// tipis: yang membedakan mereka judulnya, bukan hue.

function Chevron({ className = 'text-pinggir' }: { className?: string }) {
  return <Ikon nama="kanan" className={`w-4.5 h-4.5 shrink-0 ${className}`} tebal={2.2} />
}

/** Satu baris di blok "Sedang berjalan" / "siap dimulai". */
function BarisBerjalan({ judul, keterangan, onClick, warna = 'hijau' }: {
  judul: string; keterangan: string; onClick: () => void
  /** hijau = sesi sudah berjalan · biru = sesi Super Sesi menunggu diketuk. */
  warna?: 'hijau' | 'biru'
}) {
  const kotak = warna === 'biru' ? 'bg-biru-tint' : 'bg-hijau-tint'
  const titik = warna === 'biru' ? 'bg-biru' : 'bg-hijau'
  return (
    <button type="button" onClick={onClick}
      className="w-full bg-white rounded-2xl border border-garis px-3.5 py-3 flex items-center gap-3 text-left active:bg-isian transition-colors">
      <span className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${kotak}`}>
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${titik}`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${titik}`} />
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-tinta truncate">{judul}</p>
        <p className="text-[13px] text-teks-3 truncate">{keterangan}</p>
      </div>
      <Chevron />
    </button>
  )
}

/**
 * Satu baris "kelas Super Sesi siap diambil" -- BEDA dari BarisBerjalan (yang
 * cuma menavigasi): menekan baris ini langsung memanggil klaim_kelas_super_sesi
 * (SS9), jadi punya keadaan sibuk/galat sendiri karena bisa kalah rebutan kalau
 * guru lain mengklaim duluan (server menolak atomik, pesannya ditampilkan apa
 * adanya). Sukses -> menavigasi seperti BarisBerjalan lewat onKlaim.
 */
function BarisKelasTersedia({ kelas, onKlaim }: {
  kelas: KelasSuperSesiTersedia
  onKlaim: () => Promise<void>
}) {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function klaim() {
    setSibuk(true); setGalat(null)
    try { await onKlaim() }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={sibuk} onClick={() => void klaim()}
        className="w-full bg-white rounded-2xl border border-garis px-3.5 py-3 flex items-center gap-3 text-left active:bg-isian transition-colors disabled:opacity-60">
        <span className="w-11 h-11 rounded-xl bg-jingga-tint text-jingga shrink-0 flex items-center justify-center">
          <Ikon nama="orang" className="w-5.5 h-5.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-tinta truncate">
            {kelas.mapel || kelas.judul}
          </p>
          <p className="text-[13px] text-teks-3 truncate">
            {sibuk ? 'Mengambil…' : [kelasJurusan(kelas.kelas, kelas.jurusan), `Super Sesi ${kelas.superSesiJudul}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="shrink-0 rounded-[10px] bg-jingga px-3.5 py-2 text-[13px] font-bold text-white">Ambil</span>
      </button>
      {galat && <p className="text-xs font-medium text-jingga-gelap px-1">{galat}</p>}
    </div>
  )
}

/** Kartu ajakan terisi: aksi utama (biru), pintu ke semua kelas (tinta). */
function KartuAjakan({ ikon, judul, keterangan, warna, onClick }: {
  ikon: NamaIkon
  judul: string
  keterangan: string
  /** `biru` = membuat formulir · `tinta` = Sesi · `putih` = Super Sesi (kepala sekolah). */
  warna: 'biru' | 'tinta' | 'putih'
  onClick: () => void
}) {
  const gaya = {
    biru: { kartu: 'bg-biru active:bg-biru-gelap text-white', kotak: 'bg-white/18', sub: 'text-biru-muda', panah: 'text-biru-muda' },
    tinta: { kartu: 'bg-tinta active:bg-tinta-2 text-white', kotak: 'bg-white/12', sub: 'text-biru-muda', panah: 'text-biru-muda' },
    putih: { kartu: 'bg-white border border-garis active:bg-isian text-tinta', kotak: 'bg-biru-tint text-biru', sub: 'text-teks-3', panah: 'text-pinggir' },
  }[warna]
  return (
    <button type="button" onClick={onClick}
      className={`w-full rounded-[18px] p-4 flex items-center gap-3.5 text-left transition-colors ${gaya.kartu}`}>
      <span className={`w-11.5 h-11.5 rounded-[13px] flex items-center justify-center shrink-0 ${gaya.kotak}`}>
        <Ikon nama={ikon} className="w-6 h-6" tebal={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-extrabold tracking-tight">{judul}</p>
        <p className={`text-[13px] mt-0.5 ${gaya.sub}`}>{keterangan}</p>
      </div>
      <Chevron className={gaya.panah} />
    </button>
  )
}

// Cara membawa soal masuk: baris dalam SATU kartu berpemisah (ikon + judul +
// keterangan + panah). Ketiganya sama-sama biru: yang membedakan adalah judulnya
// (AI mengarang dari nol, dua lainnya membaca dokumen yang sudah ada).
const CARA: { id: 'ai' | 'teks' | 'pdf'; ikon: NamaIkon; judul: string; keterangan: string }[] = [
  { id: 'ai', ikon: 'ai', judul: 'Generate dari topik', keterangan: 'AI menulis soal baru dari topik yang kamu tentukan' },
  { id: 'teks', ikon: 'impor', judul: 'Tempel dari Google Form', keterangan: 'Salin teks dari halaman responden' },
  { id: 'pdf', ikon: 'dokumen', judul: 'Unggah PDF', keterangan: 'Dibaca AI: Microsoft 365, Google Form, atau dokumen lain' },
]

interface PropsMenu {
  membuat: boolean
  onBaru: () => void
  onImpor: (metode: 'teks' | 'pdf' | 'ai') => void
  /** Buka kendali SATU sesi yang sudah ada (baris di blok status). */
  onKeSesi: (sesiId?: string) => void
  /** Kartu Sesi: mulai sesi BARU (pilih formulir -> Kirim). */
  onMulaiSesi: () => void
  onKeSuperSesi: () => void
}

export function MenuPage(props: PropsMenu) {
  const desktop = useDesktop()
  return desktop ? <MenuDesktop /> : <MenuHp {...props} />
}

function MenuHp({ membuat, onBaru, onImpor, onKeSesi, onMulaiSesi, onKeSuperSesi }: PropsMenu) {
  const { user } = useAuth()
  const { daftar } = useFormulir()
  const { semuaSesi, kelasTersedia, klaimKelasSuper } = useSesi()
  const adalahKepsek = user?.role === 'kepala_sekolah'

  const berjalan = semuaSesi.filter(s => s.status === 'aktif')
  // Sesi yang lahir dari mulai_super_sesi() (guru_id SUDAH pengawas ini, lihat
  // migrasi super_sesi) tapi belum ditekan Mulai -- guru ini kemungkinan besar
  // bukan penulis soalnya, jadi sesi ini muncul TANPA aksi apa pun dari mereka.
  // Ketukan cuma MENAVIGASI ke SesiAktifView yang sudah ada; tombol "Mulai
  // sesi" di sana yang sebenarnya menjalankan ulangan.
  const superSesiSiap = berjalan.filter(s => s.superSesiId != null && s.mulaiPada == null)
  const berjalanBiasa = berjalan.filter(s => !(s.superSesiId != null && s.mulaiPada == null))

  const nama = user?.nama || 'Guru'

  return (
    <div className="relative flex flex-col h-full bg-alas">
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-5 pb-28 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <div className="flex flex-col gap-6 pt-6">

          <div className="flex items-center gap-3">
            <Lambang className="w-11 h-11" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 truncate">{NAMA_APLIKASI}</p>
              <p className="text-[23px] font-extrabold tracking-tight leading-tight text-tinta truncate">Halo, {nama}</p>
            </div>
          </div>

          {kelasTersedia.length > 0 && (
            <div>
              <Eyebrow className="mb-2.5">Kelas Super Sesi siap diambil</Eyebrow>
              <div className="flex flex-col gap-2">
                {kelasTersedia.map(k => (
                  <BarisKelasTersedia key={k.sesiId} kelas={k}
                    onKlaim={async () => { const sesi = await klaimKelasSuper(k.sesiId); onKeSesi(sesi.id) }} />
                ))}
              </div>
            </div>
          )}

          {superSesiSiap.length > 0 && (
            <div>
              <Eyebrow className="mb-2.5">Super Sesi siap dimulai</Eyebrow>
              <div className="flex flex-col gap-2">
                {superSesiSiap.map(s => (
                  <BarisBerjalan key={s.id} warna="biru" judul={s.judul}
                    keterangan={`Super Sesi ${s.superSesiJudul} · ketuk untuk mulai`}
                    onClick={() => onKeSesi(s.id)} />
                ))}
              </div>
            </div>
          )}

          {berjalanBiasa.length > 0 && (
            <div>
              <Eyebrow className="mb-2.5">Sedang berjalan</Eyebrow>
              <div className="flex flex-col gap-2">
                {berjalanBiasa.map(s => (
                  <BarisBerjalan key={s.id} judul={s.judul}
                    keterangan={`Kode ${s.kodeJoin} · ${s.muridJoined.length} murid`}
                    onClick={() => onKeSesi(s.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Guru yang BELUM punya formulir dapat kartu yang menjelaskan alurnya,
              bukan grid kosong tanpa petunjuk. Begitu sudah punya, kartu itu
              menyusut jadi ajakan ringkas. */}
          {daftar.length === 0 ? (
            <div className="bg-white rounded-[18px] border border-garis p-5">
              <p className="text-lg font-extrabold tracking-tight text-tinta">Mulai dari formulir</p>
              <p className="text-[13.5px] text-tinta-2 mt-1.5 leading-relaxed">
                Tulis soal pilihan ganda di satu formulir, lalu tekan Kirim. Sesi lahir dengan kodenya
                sendiri, murid bergabung tanpa akun, dan nilainya dihitung di server.
              </p>
              <Button size="lg" fullWidth onClick={onBaru} disabled={membuat} className="mt-4">
                {membuat ? 'Membuat…' : <>Buat formulir pertama<Ikon nama="kanan" className="w-4.5 h-4.5" tebal={2.4} /></>}
              </Button>
              <p className="text-xs text-teks-3 text-center mt-2.5">Atau biarkan AI menulisnya, atau bawa dari Google Form/PDF</p>
            </div>
          ) : (
            <KartuAjakan ikon="tambah" warna="biru" judul={membuat ? 'Membuat…' : 'Formulir baru'}
              keterangan="Tulis soal pilihan ganda dari nol" onClick={onBaru} />
          )}

          <div>
            <Eyebrow className="mb-2.5">Atau bawa dari luar</Eyebrow>
            <div className="bg-white rounded-2xl border border-garis overflow-hidden divide-y divide-garis-2">
              {CARA.map(c => (
                <button key={c.id} type="button" onClick={() => onImpor(c.id)}
                  className="w-full px-3.5 py-3.5 flex items-center gap-3 text-left active:bg-isian transition-colors">
                  <span className="w-10 h-10 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
                    <Ikon nama={c.ikon} className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-tinta">{c.judul}</span>
                    <span className="block text-[13px] text-teks-3 mt-px">{c.keterangan}</span>
                  </span>
                  <Chevron />
                </button>
              ))}
            </div>
          </div>

          {/* Kartu penuh sendiri, bukan satu ubin kecil di grid: ini yang paling
              sering dipakai guru per pertemuan, jadi wajar dapat penekanan
              lebih. Tinta gelap -- BUKAN biru -- supaya dua kartu terisi di
              layar yang sama tetap bisa dibedakan sekilas. */}
          <KartuAjakan ikon="sesi" warna="tinta" judul="Sesi"
            keterangan="Mulai sesi baru dari formulirmu"
            onClick={onMulaiSesi} />

          {/* Kepala sekolah saja (role, dicek klien -- server tetap yang
              menegakkan lewat adalah_kepsek() di RPC Super Sesi). */}
          {adalahKepsek && (
            <KartuAjakan ikon="perisai" warna="putih" judul="Super Sesi"
              keterangan="Kumpulkan soal dari guru mapel, mulai serentak, awasi semua kelas"
              onClick={onKeSuperSesi} />
          )}

          {/* Kode yang dimasukkan guru supaya akunnya terhubung ke sekolah ini. */}
          {adalahKepsek && <KartuKodeSekolah />}
        </div>
      </div>
    </div>
  )
}
