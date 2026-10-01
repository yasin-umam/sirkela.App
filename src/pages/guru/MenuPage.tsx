import { useState } from 'react'
import type { KelasSuperSesiTersedia, SesiKelas } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { menitDetik, useSisaDetik } from '../../lib/waktuSesi'
import { Lambang } from '../../components/Logo'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { NAMA_APLIKASI } from '../../lib/aplikasi'

// ─── Tab Menu: peluncur ──────────────────────────────────────────────────────
// Kepala berupa sapaan besar (bukan bilah putih), lalu blok-blok yang muncul
// MENURUT KEADAAN guru, bukan daftar statis:
//   - Ada kelas Super Sesi yang bisa diambil -> blok "siap diambil" paling atas.
//   - Ada sesi dibuka                         -> blok "Sedang berjalan".
//   - Belum punya formulir                    -> kartu pembuka yang menjelaskan alurnya.
// Daftar formulir lengkap cuma di tab Riwayat -- Menu tetap peluncur aksi,
// bukan arsip kedua.
//
// HP: satu kolom, urutan blok status dulu. DESKTOP (≥ 1024px): dua kolom --
// kiri untuk MEMBUAT soal (kartu Formulir baru, tiga cara bawa dari luar, kartu
// Sesi), kanan untuk yang PERLU PERHATIAN (blok status). DOM-nya satu, urutan
// kolom diatur kelas `lg:order-*`, jadi HP dan desktop tidak bisa menyimpang.
//
// Warna dipakai untuk BERARTI: biru = membuat formulir (aksi utama), hijau =
// sesi yang sedang hidup, jingga = ada yang menunggu diambil, tinta = kartu
// Sesi (pintu ke semua kelas). Tiga cara membawa soal dari luar semuanya biru
// tipis: yang membedakan mereka judulnya, bukan hue.

function Chevron({ className = 'text-pinggir' }: { className?: string }) {
  return <Ikon nama="kanan" className={`w-4.5 h-4.5 shrink-0 ${className}`} tebal={2.2} />
}

/** Satu baris di blok "Sedang berjalan" / "siap dimulai". */
function BarisBerjalan({ judul, keterangan, onClick, warna = 'hijau', cuma = 'semua' }: {
  judul: string; keterangan: string; onClick: () => void
  /** hijau = sesi sudah berjalan · biru = sesi Super Sesi menunggu diketuk. */
  warna?: 'hijau' | 'biru'
  /** `hp` = disembunyikan di desktop (di sana ada KartuBerjalan yang lebih kaya). */
  cuma?: 'semua' | 'hp'
}) {
  const kotak = warna === 'biru' ? 'bg-biru-tint' : 'bg-hijau-tint'
  const titik = warna === 'biru' ? 'bg-biru' : 'bg-hijau'
  return (
    <button type="button" onClick={onClick}
      className={`w-full bg-white rounded-2xl border border-garis px-3.5 py-3 flex items-center gap-3 text-left active:bg-isian transition-colors ${
        cuma === 'hp' ? 'lg:hidden' : ''}`}>
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
 * Kartu sesi berjalan KHUSUS desktop: kode, sisa waktu, dan jumlah murid terlihat
 * langsung di Menu, tanpa membuka layar Sesi dulu. Di HP baris biasa
 * (BarisBerjalan) sudah cukup -- layarnya terlalu sempit untuk semua ini.
 */
function KartuBerjalan({ sesi, onClick }: { sesi: SesiKelas; onClick: () => void }) {
  const sisa = useSisaDetik(sesi.mulaiPada, sesi.durasiMenit)
  const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0
  const persen = sisa == null ? 100 : (sisa / (sesi.durasiMenit * 60)) * 100
  return (
    <div className="hidden lg:flex flex-col gap-4 bg-white rounded-[18px] border border-garis p-5.5">
      <div className="flex items-center justify-between gap-3">
        {sesi.mulaiPada ? <Badge warna="hijau" titik>Sesi aktif</Badge> : <Badge warna="slate">Menunggu dimulai</Badge>}
        <span className="text-[13px] text-teks-3">
          {sesi.muridJoined.length} murid
          {terkunci > 0 && <> · <span className="font-bold text-jingga-gelap">{terkunci} terkunci</span></>}
        </span>
      </div>
      <p className="text-[19px] font-extrabold tracking-tight leading-snug text-tinta">{sesi.judul}</p>
      <div className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>Kode sesi</Eyebrow>
          <p className="font-mono text-[30px] font-medium tracking-[0.1em] leading-tight mt-1 text-tinta">{sesi.kodeJoin}</p>
        </div>
        {sisa != null && (
          <div className="text-right">
            <Eyebrow>Tersisa</Eyebrow>
            <p className={`font-mono text-[30px] font-medium leading-tight mt-1 ${persen < 20 ? 'text-jingga-gelap' : 'text-tinta'}`}>{menitDetik(sisa)}</p>
          </div>
        )}
      </div>
      {sisa != null && (
        <div className={`h-2 rounded-full overflow-hidden ${persen < 20 ? 'bg-jingga-tint' : 'bg-biru-tint'}`}>
          <div className={`h-full rounded-full ${persen < 20 ? 'bg-jingga' : 'bg-biru'}`} style={{ width: `${persen}%` }} />
        </div>
      )}
      <Button size="lg" fullWidth onClick={onClick} className="h-12!">
        Buka kendali sesi<Ikon nama="kanan" className="w-4.5 h-4.5" tebal={2.4} />
      </Button>
    </div>
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
        className="w-full bg-white rounded-2xl border border-garis px-3.5 py-3 lg:px-4.5 lg:py-4 flex items-center gap-3 text-left active:bg-isian transition-colors disabled:opacity-60">
        <span className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-jingga-tint text-jingga shrink-0 flex items-center justify-center">
          <Ikon nama="orang" className="w-5.5 h-5.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-tinta truncate lg:whitespace-normal">
            {kelas.mapel || kelas.judul}
          </p>
          <p className="text-[13px] text-teks-3 truncate">
            {sibuk ? 'Mengambil…' : `${kelas.kelas ? `${kelas.kelas} · ` : ''}Super Sesi ${kelas.superSesiJudul}`}
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
      className={`w-full rounded-[18px] lg:rounded-[20px] p-4 lg:px-8 lg:py-7 flex items-center gap-3.5 lg:gap-5.5 text-left transition-colors ${gaya.kartu}`}>
      <span className={`w-11.5 h-11.5 lg:w-16 lg:h-16 rounded-[13px] lg:rounded-[18px] flex items-center justify-center shrink-0 ${gaya.kotak}`}>
        <Ikon nama={ikon} className="w-6 h-6 lg:w-8 lg:h-8" tebal={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] lg:text-[26px] font-extrabold tracking-tight">{judul}</p>
        <p className={`text-[13px] lg:text-[15.5px] mt-0.5 lg:mt-1 ${gaya.sub}`}>{keterangan}</p>
      </div>
      <Chevron className={`${gaya.panah} lg:w-6 lg:h-6`} />
    </button>
  )
}

// Cara membawa soal masuk -- HP: baris dalam SATU kartu berpemisah (ikon + judul
// + keterangan + panah); desktop: tiga ubin sejajar. Ketiganya sama-sama biru:
// yang membedakan adalah judulnya (AI mengarang dari nol, dua lainnya membaca
// dokumen yang sudah ada).
const CARA: { id: 'ai' | 'teks' | 'pdf'; ikon: NamaIkon; judul: string; keterangan: string }[] = [
  { id: 'ai', ikon: 'ai', judul: 'Generate dari topik', keterangan: 'AI menulis soal baru dari topik yang kamu tentukan' },
  { id: 'teks', ikon: 'impor', judul: 'Tempel dari Google Form', keterangan: 'Salin teks dari halaman responden' },
  { id: 'pdf', ikon: 'dokumen', judul: 'Unggah PDF', keterangan: 'Dibaca AI: Microsoft 365, Google Form, atau dokumen lain' },
]

export function MenuPage({ membuat, onBaru, onImpor, onKeSesi, onMulaiSesi, onKeSuperSesi }: {
  membuat: boolean
  onBaru: () => void
  onImpor: (metode: 'teks' | 'pdf' | 'ai') => void
  /** Buka kendali SATU sesi yang sudah ada (baris di blok status). */
  onKeSesi: (sesiId?: string) => void
  /** Kartu Sesi: mulai sesi BARU (pilih formulir -> Kirim). */
  onMulaiSesi: () => void
  onKeSuperSesi: () => void
}) {
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
  const adaStatus = kelasTersedia.length > 0 || superSesiSiap.length > 0 || berjalanBiasa.length > 0

  const nama = user?.nama || 'Guru'

  return (
    <div className="relative flex flex-col h-full bg-alas">
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-5 pb-28 lg:px-12 lg:pb-12 desktop:max-w-2xl desktop:w-full desktop:mx-auto lg:max-w-6xl">
        <div className="flex flex-col gap-6 pt-6 lg:pt-10 lg:gap-7">

          {/* HP: lambang + sapaan. Desktop: lambang sudah ada di sidebar. */}
          <div className="flex items-center gap-3 lg:hidden">
            <Lambang className="w-11 h-11 rounded-[13px]" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 truncate">{NAMA_APLIKASI}</p>
              <p className="text-[23px] font-extrabold tracking-tight leading-tight text-tinta truncate">Halo, {nama}</p>
            </div>
          </div>
          <div className="hidden lg:block">
            <div>
              <Eyebrow>{NAMA_APLIKASI}</Eyebrow>
              <h1 className="mt-2 text-[38px] leading-tight font-extrabold tracking-tight text-tinta">Halo, {nama}</h1>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-8 lg:gap-y-7 lg:items-start">

            {/* ── Blok status (kolom KANAN di desktop) ── */}
            <div className="flex flex-col gap-6 lg:gap-7 lg:order-2">
              {kelasTersedia.length > 0 && (
                <div>
                  <Eyebrow className="mb-2.5 lg:mb-3">Kelas Super Sesi siap diambil</Eyebrow>
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
                  <Eyebrow className="mb-2.5 lg:mb-3">Super Sesi siap dimulai</Eyebrow>
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
                  <Eyebrow className="mb-2.5 lg:mb-3">Sedang berjalan</Eyebrow>
                  <div className="flex flex-col gap-2 lg:gap-3">
                    {berjalanBiasa.map(s => (
                      <div key={s.id}>
                        <BarisBerjalan cuma="hp" judul={s.judul}
                          keterangan={`Kode ${s.kodeJoin} · ${s.muridJoined.length} murid`}
                          onClick={() => onKeSesi(s.id)} />
                        <KartuBerjalan sesi={s} onClick={() => onKeSesi(s.id)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Desktop: kolom kanan tidak boleh kosong melompong -- keadaan
                  "tidak ada apa-apa" dikatakan. HP tidak butuh: kolomnya tunggal. */}
              {!adaStatus && (
                <div className="hidden lg:block">
                  <Eyebrow className="mb-3">Sedang berjalan</Eyebrow>
                  <div className="bg-white rounded-[18px] border border-dashed border-pinggir-2 px-5 py-7 text-center">
                    <p className="text-[15px] font-bold text-tinta">Tidak ada sesi yang sedang dibuka</p>
                    <p className="text-[13px] text-teks-3 mt-1 leading-relaxed">
                      Tulis formulir, lalu tekan Kirim. Sesi lahir dengan kodenya sendiri.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Membuat soal (kolom KIRI di desktop) ── */}
            <div className="flex flex-col gap-6 lg:gap-7.5 lg:order-1">
              {/* Guru yang BELUM punya formulir dapat kartu yang menjelaskan
                  alurnya, bukan grid kosong tanpa petunjuk. Begitu sudah punya,
                  kartu itu menyusut jadi ajakan ringkas. */}
              {daftar.length === 0 ? (
                <div className="bg-white rounded-[18px] border border-garis p-5 lg:p-8">
                  <p className="text-lg lg:text-2xl font-extrabold tracking-tight text-tinta">Mulai dari formulir</p>
                  <p className="text-[13.5px] lg:text-[15px] text-tinta-2 mt-1.5 leading-relaxed">
                    Tulis soal pilihan ganda di satu formulir, lalu tekan Kirim. Sesi lahir dengan kodenya
                    sendiri, murid bergabung tanpa akun, dan nilainya dihitung di server.
                  </p>
                  <Button size="lg" fullWidth onClick={onBaru} disabled={membuat} className="mt-4 lg:mt-5">
                    {membuat ? 'Membuat…' : <>Buat formulir pertama<Ikon nama="kanan" className="w-4.5 h-4.5" tebal={2.4} /></>}
                  </Button>
                  <p className="text-xs text-teks-3 text-center mt-2.5">Atau biarkan AI menulisnya, atau bawa dari Google Form/PDF</p>
                </div>
              ) : (
                <div>
                  <Eyebrow className="hidden lg:block mb-3">Buat soal</Eyebrow>
                  <KartuAjakan ikon="tambah" warna="biru" judul={membuat ? 'Membuat…' : 'Formulir baru'}
                    keterangan="Tulis soal pilihan ganda dari nol" onClick={onBaru} />
                </div>
              )}

              <div>
                <Eyebrow className="mb-2.5 lg:mb-3">Atau bawa dari luar</Eyebrow>
                <div className="bg-white rounded-2xl border border-garis overflow-hidden divide-y divide-garis-2 lg:bg-transparent lg:border-0 lg:overflow-visible lg:divide-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
                  {CARA.map(c => (
                    <button key={c.id} type="button" onClick={() => onImpor(c.id)}
                      className="w-full px-3.5 py-3.5 flex items-center gap-3 text-left active:bg-isian transition-colors lg:flex-col lg:items-start lg:gap-4 lg:bg-white lg:border lg:border-garis lg:rounded-[18px] lg:p-5.5 lg:min-h-45 lg:hover:border-biru">
                      <span className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-[14px] bg-biru-tint text-biru flex items-center justify-center shrink-0">
                        <Ikon nama={c.ikon} className="w-5 h-5 lg:w-6 lg:h-6" />
                      </span>
                      <span className="flex-1 min-w-0 lg:flex-none">
                        <span className="block text-[15px] lg:text-[17px] font-bold lg:font-extrabold text-tinta">{c.judul}</span>
                        <span className="block text-[13px] lg:text-sm text-teks-3 mt-px lg:mt-1 leading-snug">{c.keterangan}</span>
                      </span>
                      <span className="lg:hidden"><Chevron /></span>
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
                  menegakkan lewat adalah_kepsek() di RPC Super Sesi). Di desktop
                  pintunya ada di sidebar; kartu ini tetap ada di HP dan juga di
                  sini supaya Menu desktop tidak kehilangan satu jalan masuk. */}
              {adalahKepsek && (
                <KartuAjakan ikon="perisai" warna="putih" judul="Super Sesi"
                  keterangan="Kumpulkan soal dari guru mapel, mulai serentak, awasi semua kelas"
                  onClick={onKeSuperSesi} />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
