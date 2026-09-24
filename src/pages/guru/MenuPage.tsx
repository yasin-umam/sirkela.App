import { useState } from 'react'
import type { ReactNode } from 'react'
import type { KelasSuperSesiTersedia } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { EMAIL_ADMIN_UTAMA } from '../../lib/admin'
import { Lambang } from '../../components/Logo'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
import { NAMA_APLIKASI } from '../../lib/aplikasi'

// ─── Tab Menu: peluncur ──────────────────────────────────────────────────────
// Bentuknya mengikuti MenuPage Luang persis: bilah putih setinggi 48px di
// puncak, lalu kolom bergulung berisi blok-blok yang muncul MENURUT KEADAAN
// guru, bukan daftar statis:
//   - Ada sesi dibuka        -> blok "Sedang berjalan" paling atas.
//   - Belum punya formulir   -> kartu pembuka yang menjelaskan alurnya.
// Daftar formulir lengkap (dulu blok "Lanjutkan" di sini) sekarang cuma di
// tab Riwayat -- Menu tetap peluncur aksi, bukan arsip kedua.
// Di bawahnya grid "Buat dari nol" dan kartu Sesi.
//
// Warna dipakai untuk BERARTI, bukan hiasan -- aturan yang sama dengan Luang:
// indigo = membuat formulir (aksi utama), emerald = sesi/live. Grid di
// tengah memakai tiga hue per KATEGORI sumbernya (tulis sendiri vs impor),
// bukan satu hue acak per ubin.

function LabelBlok({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</p>
}

function Chevron({ className = 'w-4 h-4 text-slate-300' }: { className?: string }) {
  return <Ikon nama="kanan" className={`shrink-0 ${className}`} tebal={2} />
}

/** Satu baris di blok "Sedang berjalan" -- titik berdenyut + dua baris teks. */
function BarisBerjalan({ judul, keterangan, onClick, warna = 'emerald' }: {
  judul: string; keterangan: string; onClick: () => void
  /** emerald = sesi sudah berjalan · indigo = sesi Super Sesi menunggu diketuk. */
  warna?: 'emerald' | 'indigo'
}) {
  const titik = warna === 'indigo' ? 'bg-indigo-400' : 'bg-emerald-400'
  const titikInti = warna === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'
  return (
    <button type="button" onClick={onClick}
      className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 text-left active:bg-slate-50 transition-colors">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${titik}`} />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${titikInti}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{judul}</p>
        <p className="text-xs text-slate-400 truncate">{keterangan}</p>
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
        className="w-full bg-white rounded-2xl border border-violet-100 shadow-sm px-4 py-3 flex items-center gap-3 text-left active:bg-violet-50 transition-colors disabled:opacity-60">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-violet-400" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">
            {kelas.mapel || kelas.judul}{kelas.kelas && <span className="text-slate-400 font-normal"> · {kelas.kelas}</span>}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {sibuk ? 'Mengambil…' : `Super Sesi ${kelas.superSesiJudul} · ketuk untuk jadi pengawas`}
          </p>
        </div>
        <Chevron />
      </button>
      {galat && <p className="text-[11px] text-red-600 px-1">{galat}</p>}
    </div>
  )
}

/** Kartu ajakan bergradasi -- bobot visual paling berat di layar ini. */
function KartuAjakan({ ikon, judul, keterangan, warna, onClick }: {
  ikon: NamaIkon
  judul: string
  keterangan: string
  /**
   * `indigo` = membuat formulir · `emerald` = sesi · `violet` = Super Sesi
   * (kepala sekolah saja). Tidak ada dua yang tampil sebagai hue yang sama.
   */
  warna: 'indigo' | 'emerald' | 'violet'
  onClick: () => void
}) {
  const gaya = warna === 'indigo'
    ? { kartu: 'from-indigo-600 to-indigo-700 active:from-indigo-700 active:to-indigo-800 shadow-indigo-200/70', sub: 'text-indigo-200', panah: 'text-indigo-300' }
    : warna === 'emerald'
    ? { kartu: 'from-emerald-600 to-teal-700 active:from-emerald-700 active:to-teal-800 shadow-emerald-200/70', sub: 'text-emerald-100', panah: 'text-emerald-200' }
    : { kartu: 'from-violet-600 to-purple-700 active:from-violet-700 active:to-purple-800 shadow-violet-200/70', sub: 'text-violet-200', panah: 'text-violet-300' }
  return (
    <button type="button" onClick={onClick}
      className={`w-full bg-linear-to-br rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-colors shadow-lg ${gaya.kartu}`}>
      <span className="w-10 h-10 rounded-xl bg-white/20 border border-white/20 text-white flex items-center justify-center shrink-0">
        <Ikon nama={ikon} className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{judul}</p>
        <p className={`text-[11px] ${gaya.sub}`}>{keterangan}</p>
      </div>
      <Chevron className={`w-4 h-4 ${gaya.panah}`} />
    </button>
  )
}

// Baris pilihan cara membawa soal masuk -- bentuknya BARIS PENUH (icon kiri +
// judul/keterangan + chevron), sama dengan "Generate dari Topik"/"Tulis
// Sendiri" di layar Soal Luang. Sebelum 2026-09-22 ini grid ikon kecil
// berjajar 4 kolom; diganti sesudah dibandingkan langsung dengan tangkapan
// layar Luang -- grid ikon kecil terbaca seperti pintasan sekunder, padahal
// inilah cara UTAMA guru mengisi formulir kalau bukan menulis sendiri.
//
// Tiga warna aksen, satu per CARA (bukan rumpun): violet untuk AI-mengarang
// (Generate), amber untuk dua jalur baca-dokumen-yang-sudah-ada (Tempel teks,
// Unggah PDF) -- sama pasangan warna dengan sebelumnya, cuma sekarang per
// baris bukan per ubin. SENGAJA bukan indigo/emerald: dua warna itu tetap
// eksklusif milik kartu ajakan Formulir baru & Sesi di atas/bawah blok ini.
const CARA: { id: 'ai' | 'teks' | 'pdf'; ikon: NamaIkon; judul: string; keterangan: string; warna: string }[] = [
  { id: 'ai', ikon: 'ai', judul: 'Generate dari topik', keterangan: 'AI menulis soal baru dari topik yang kamu tentukan', warna: 'bg-violet-50 text-violet-600' },
  { id: 'teks', ikon: 'impor', judul: 'Tempel dari Google Form', keterangan: 'Salin teks dari halaman responden', warna: 'bg-amber-50 text-amber-600' },
  { id: 'pdf', ikon: 'dokumen', judul: 'Unggah PDF', keterangan: 'Dibaca AI -- Microsoft 365, Google Form, atau dokumen lain', warna: 'bg-amber-50 text-amber-600' },
]

export function MenuPage({ membuat, onBaru, onImpor, onKeSesi, onKeSuperSesi, onKeRiwayat, onBukaAdmin }: {
  membuat: boolean
  onBaru: () => void
  onImpor: (metode: 'teks' | 'pdf' | 'ai') => void
  onKeSesi: (sesiId?: string) => void
  onKeSuperSesi: () => void
  onKeRiwayat: () => void
  onBukaAdmin: () => void
}) {
  const { user } = useAuth()
  const { daftar } = useFormulir()
  const { semuaSesi, kelasTersedia, klaimKelasSuper } = useSesi()
  const adalahAdmin = user?.email === EMAIL_ADMIN_UTAMA
  const adalahKepsek = user?.role === 'kepala_sekolah'

  const berjalan = semuaSesi.filter(s => s.status === 'aktif')
  // Sesi yang lahir dari mulai_super_sesi() (guru_id SUDAH pengawas ini, lihat
  // migrasi super_sesi) tapi belum ditekan Mulai -- guru ini kemungkinan besar
  // bukan penulis soalnya, jadi sesi ini muncul TANPA aksi apa pun dari mereka.
  // Ketukan cuma MENAVIGASI ke SesiAktifView yang sudah ada; tombol "Mulai
  // sesi" di sana yang sebenarnya menjalankan ulangan.
  const superSesiSiap = berjalan.filter(s => s.superSesiId != null && s.mulaiPada == null)
  const berjalanBiasa = berjalan.filter(s => !(s.superSesiId != null && s.mulaiPada == null))

  return (
    <div className="relative flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="bg-white border-b border-slate-100 px-3 h-12 flex items-center gap-2 shrink-0 shadow-sm">
        <Lambang className="w-7 h-7 rounded-xl" />
        <span className="text-sm font-bold text-slate-800">{NAMA_APLIKASI}</span>
        <div className="flex-1" />
        {/* Admin (satu email tertentu, lihat EMAIL_ADMIN_UTAMA) melihat pintasan
            Admin di sini alih-alih pintasan Riwayat -- akses admin tetap ada
            lewat baris "Admin" di tab Saya kalau suatu saat perlu dua jalan,
            tapi header ini yang mereka pakai sehari-hari. Guru lain sama sekali
            tidak melihat bedanya: pintasan Riwayat mereka tidak berubah. */}
        {adalahAdmin ? (
          <button type="button" onClick={onBukaAdmin} title="Admin"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 active:bg-indigo-50 transition-colors">
            <Ikon nama="perisai" className="w-5 h-5" />
          </button>
        ) : (
          <button type="button" onClick={onKeRiwayat} title="Semua formulir"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-500 active:bg-slate-100 transition-colors">
            <Ikon nama="dokumen" className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Strip statis di luar area scroll -- menutup celah "kartu mengintip" di
          titik pertemuan header dengan konten yang lewat di baliknya. */}
      <div className="h-2 bg-slate-50 shrink-0" />

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 pb-24">
        <div className="flex flex-col gap-6 pt-5">

          {kelasTersedia.length > 0 && (
            <div>
              <LabelBlok>Kelas Super Sesi siap diambil</LabelBlok>
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
              <LabelBlok>Super Sesi siap dimulai</LabelBlok>
              <div className="flex flex-col gap-2">
                {superSesiSiap.map(s => (
                  <BarisBerjalan key={s.id} warna="indigo" judul={s.judul}
                    keterangan={`Super Sesi ${s.superSesiJudul} · ketuk untuk mulai`}
                    onClick={() => onKeSesi(s.id)} />
                ))}
              </div>
            </div>
          )}

          {berjalanBiasa.length > 0 && (
            <div>
              <LabelBlok>Sedang berjalan</LabelBlok>
              <div className="flex flex-col gap-2">
                {berjalanBiasa.map(s => (
                  <BarisBerjalan key={s.id} judul={s.judul}
                    keterangan={`Sesi live · kode ${s.kodeJoin} · ${s.muridJoined.length} murid`}
                    onClick={() => onKeSesi(s.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Guru yang BELUM punya formulir dapat kartu yang menjelaskan
              alurnya, bukan grid kosong tanpa petunjuk. Begitu sudah punya,
              kartu itu menyusut jadi ajakan ringkas. */}
          {daftar.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
              <p className="text-base font-bold text-slate-800">Mulai dari formulir</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Tulis soal pilihan ganda di satu formulir, lalu tekan Kirim. Sesi lahir dengan kodenya
                sendiri, murid bergabung tanpa akun, dan nilainya dihitung di server.
              </p>
              <button type="button" onClick={onBaru} disabled={membuat}
                className="w-full h-12 rounded-xl bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-4">
                <span className="text-sm font-bold text-white">{membuat ? 'Membuat…' : 'Buat formulir pertama'}</span>
                <Ikon nama="kanan" className="w-4 h-4 text-white" tebal={2} />
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">Atau biarkan AI menulisnya, atau bawa dari Google Form/PDF</p>
            </div>
          ) : (
            <KartuAjakan ikon="tambah" warna="indigo" judul={membuat ? 'Membuat…' : 'Formulir baru'}
              keterangan="Tulis soal pilihan ganda dari nol" onClick={onBaru} />
          )}

          <div>
            <LabelBlok>Atau bawa dari luar</LabelBlok>
            <div className="flex flex-col gap-2">
              {CARA.map(c => (
                <button key={c.id} type="button" onClick={() => onImpor(c.id)}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 flex items-center gap-3 text-left active:bg-slate-50 transition-colors">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.warna}`}>
                    <Ikon nama={c.ikon} className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-700">{c.judul}</span>
                    <span className="block text-xs text-slate-400 mt-0.5 leading-snug">{c.keterangan}</span>
                  </span>
                  <Chevron />
                </button>
              ))}
            </div>
          </div>

          {/* Kartu penuh sendiri, bukan satu ubin kecil di grid: ini yang paling
              sering dipakai guru per pertemuan, jadi wajar dapat penekanan
              lebih. Hue emerald -- BUKAN indigo -- supaya dua kartu bergradasi
              di layar yang sama tetap bisa dibedakan sekilas. */}
          <KartuAjakan ikon="sesi" warna="emerald" judul="Sesi"
            keterangan={berjalan.length > 0
              ? `${berjalan.length} sedang dibuka · ${semuaSesi.length} total`
              : 'Pantau kelas, kunci layar, dan nilai'}
            onClick={() => onKeSesi()} />

          {/* Kepala sekolah saja (role, dicek klien -- server tetap yang
              menegakkan lewat adalah_kepsek() di RPC Super Sesi). Selalu di
              BAWAH kartu Sesi, bukan menggantikannya: kepala sekolah tetap
              guru mapel biasa untuk formulir/sesinya sendiri. */}
          {adalahKepsek && (
            <KartuAjakan ikon="sesi" warna="violet" judul="Super Sesi"
              keterangan="Kumpulkan soal dari guru mapel, tugaskan pengawas, mulai serentak"
              onClick={onKeSuperSesi} />
          )}

        </div>
      </div>
    </div>
  )
}
