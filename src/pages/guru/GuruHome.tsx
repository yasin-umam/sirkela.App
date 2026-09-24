import { useEffect, useRef, useState } from 'react'
import type { ReactElement, UIEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LayarAktif, useKembali } from '../../context/NavContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { BottomNav, type TabGuru } from '../../components/BottomNav'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'
import { MenuPage } from './MenuPage'
import { RiwayatPage } from './RiwayatPage'
import { SesiPage } from './SesiPage'
import { SuperSesiPage } from './SuperSesiPage'
import { ProfilePage } from './ProfilePage'
import { AdminPage } from './AdminPage'
import { EditorFormulir } from './EditorFormulir'
import { DialogImpor } from './DialogImpor'

// ─── Rumah guru: Riwayat · Menu · Saya ───────────────────────────────────────
// Shell yang sama dengan Luang, sampai ke pembagian tabnya:
//   Riwayat -- arsip yang pernah dibuat (di Luang: dokumen; di sini: formulir & sesi)
//   Menu    -- peluncur: yang sedang berjalan, lanjutkan, buat baru, kartu Sesi
//   Saya    -- akun
// Dan seperti di Luang, **Sesi bukan slot tab sendiri**: ia layar takeover yang
// dibuka dari kartu di Menu dan menumpang sorotan slot Menu
// (`tabUntukSorotan` di BottomNav).
//
// Tab yang PERNAH dibuka tetap ter-mount selamanya, disembunyikan lewat CSS --
// bukan conditional-render. Tanpa itu tiap pindah tab membongkar-pasang isinya
// dari nol dan daftar yang sudah ter-fetch "reload" lagi tiap kali kembali.
// `LayarAktif` membungkus tiap tab supaya penangan tombol kembali milik tab
// yang TIDAK terlihat tidak ikut menanggapi -- kalau tidak, satu tekanan
// kembali bisa menutup lapisan di tab yang sedang tersembunyi.
//
// Editor formulir adalah cabang render TERPISAH (di luar bilah tab): ia layar
// kerja penuh, dan bilah tab di bawahnya cuma mengundang guru keluar di tengah
// mengetik soal.

function Penjaga({ tangani }: { tangani: () => boolean }) {
  useKembali(tangani)
  return null
}

export function GuruHome() {
  const { logout } = useAuth()
  const { aktif, pilihFormulir, buatFormulir, simpanSekarang } = useFormulir()
  const { semuaSesi, fokuskan } = useSesi()

  const [tab, setTab] = useState<TabGuru>('menu')
  /** id formulir yang sedang disunting layar penuh. null = tidak ada. */
  const [editor, setEditor] = useState<string | null>(null)
  /** Layar Admin terbuka -- cabang terpisah, sama pola dengan editor. */
  const [admin, setAdmin] = useState(false)
  const [impor, setImpor] = useState<{ tujuan: 'baru' | 'ini'; metode?: 'teks' | 'pdf' | 'ai' } | null>(null)
  const [membuat, setMembuat] = useState(false)
  const [keluar, setKeluar] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galatKeluar, setGalatKeluar] = useState<string | null>(null)
  const [kabar, setKabar] = useState<string | null>(null)
  /**
   * Satu sesi dibuka di tab Sesi, atau sub-halaman layar penuh terbuka di tab
   * Saya (Akun Saya) -- bilah tab meluncur keluar. Sama pola dengan `navHidden`
   * di Luang: BottomNav sendiri yang baca sinyal ini dan geser dirinya lewat
   * CSS transition, bukan di-unmount.
   */
  const [navHidden, setNavHidden] = useState(false)
  /**
   * Bilah tab ikut menyembunyikan diri saat isi tab digulir ke bawah (konten
   * naik), muncul lagi saat digulir ke atas -- pola umum aplikasi mobile,
   * supaya bilah tidak menutupi konten saat guru sedang membaca daftar
   * panjang. Digabung dengan `navHidden` di bawah: kalau salah satu benar,
   * bilahnya tersembunyi.
   */
  const [gulirTersembunyi, setGulirTersembunyi] = useState(false)
  const posisiGulir = useRef<{ target: EventTarget | null; y: number }>({ target: null, y: 0 })

  // Sama dengan `dikunjungi` di App.tsx Luang: tab yang pernah dibuka tetap
  // ter-mount. Ref, bukan state, supaya "ditandai pernah dibuka" langsung
  // berlaku di render yang sama saat tab berubah.
  const dikunjungi = useRef(new Set<TabGuru>(['menu']))
  dikunjungi.current.add(tab)

  useEffect(() => {
    if (!kabar) return
    const t = setTimeout(() => setKabar(null), 4000)
    return () => clearTimeout(t)
  }, [kabar])

  // Bilah kembali muncul begitu pindah tab -- guru tidak boleh mendarat di
  // tab baru dengan bilah yang sudah tersembunyi gara-gara gulir di tab lain.
  useEffect(() => { setGulirTersembunyi(false) }, [tab])

  const AMBANG_GULIR_PX = 8
  const ZONA_ATAS_PX = 24

  // Scroll TIDAK bubble, tapi capture-phase di ancestor tetap menangkapnya
  // dari elemen `overflow-y-auto` mana pun di dalam tab yang aktif -- satu
  // penangan di sini cukup untuk semua halaman, tidak perlu diteruskan lewat
  // props ke tiap RiwayatPage/MenuPage/ProfilePage satu-satu.
  function tanganiGulir(e: UIEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement
    if (typeof el.scrollTop !== 'number') return
    const posisi = posisiGulir.current
    const yLama = posisi.target === el ? posisi.y : el.scrollTop
    const y = el.scrollTop
    posisiGulir.current = { target: el, y }
    if (y < ZONA_ATAS_PX) { setGulirTersembunyi(false); return }
    const delta = y - yLama
    if (delta > AMBANG_GULIR_PX) setGulirTersembunyi(true)
    else if (delta < -AMBANG_GULIR_PX) setGulirTersembunyi(false)
  }

  function bukaEditor(id: string) {
    pilihFormulir(id)
    setEditor(id)
  }

  async function formulirBaru() {
    if (membuat) return
    setMembuat(true)
    try {
      setEditor(await buatFormulir())
    } catch {
      setKabar('Gagal membuat formulir. Coba lagi.')
    } finally {
      setMembuat(false)
    }
  }

  function bukaSesi(id?: string) {
    fokuskan(id ?? null)
    setTab('sesi')
  }

  function bukaSuperSesi() {
    setTab('superSesi')
  }

  function pantauSesi(id: string) {
    setEditor(null)
    bukaSesi(id)
  }

  async function jalankanKeluar() {
    setSibuk(true); setGalatKeluar(null)
    try {
      await simpanSekarang()
      await logout()
    } catch (e) {
      setGalatKeluar(e instanceof Error ? e.message : 'Gagal keluar, coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  // ── Editor formulir: cabang terpisah, tanpa bilah tab ──
  if (editor) {
    return (
      <>
        <EditorFormulir
          onKeluar={() => setEditor(null)}
          onPantauSesi={pantauSesi}
          onImpor={() => setImpor({ tujuan: 'ini' })}
          onTerhapus={() => { setEditor(null); setKabar('Formulir dihapus') }}
        />
        {impor && (
          <DialogImpor tujuan={impor.tujuan} metodeAwal={impor.metode} onTutup={() => setImpor(null)}
            onSelesai={n => { setImpor(null); setKabar(`${n} pertanyaan diimpor`) }} />
        )}
        <Kabar teks={kabar} />
      </>
    )
  }

  // ── Admin: cabang terpisah, tanpa bilah tab ──
  // Dibuka lewat pintasan di header MenuPage (cuma tampil untuk satu email
  // admin, lihat EMAIL_ADMIN_UTAMA) atau baris "Admin" di tab Saya -- dua
  // pintu, satu state, supaya tidak ada dua sumber kebenaran soal "admin
  // sedang terbuka atau tidak".
  if (admin) {
    return (
      <>
        <AdminPage onKembali={() => setAdmin(false)} />
        <Kabar teks={kabar} />
      </>
    )
  }

  const sesiBerjalan = semuaSesi.filter(s => s.status === 'aktif').length

  return (
    <div className="relative h-full flex flex-col bg-slate-50">
      {/* Anak PERTAMA = diperiksa paling akhir: pulang ke Menu baru dikerjakan
          setelah semua lapisan di atasnya sempat menutup diri. Tab Sesi &
          Super Sesi punya penangannya sendiri (SesiPage/SuperSesiPage), jadi
          tidak ikut di sini. */}
      <Penjaga tangani={() => {
        if (tab === 'menu' || tab === 'sesi' || tab === 'superSesi') return false
        setTab('menu')
        return true
      }} />

      <div className="flex-1 overflow-hidden" onScrollCapture={tanganiGulir}>
        <div className={tab === 'riwayat' ? 'h-full tab-masuk' : 'hidden'}>
          <LayarAktif aktif={tab === 'riwayat'}>
            {dikunjungi.current.has('riwayat') && (
              <RiwayatPage onBukaFormulir={bukaEditor} onBukaSesi={id => bukaSesi(id)} />
            )}
          </LayarAktif>
        </div>

        <div className={tab === 'menu' ? 'h-full tab-masuk' : 'hidden'}>
          <LayarAktif aktif={tab === 'menu'}>
            <MenuPage
              membuat={membuat}
              onBaru={() => void formulirBaru()}
              onImpor={metode => setImpor({ tujuan: 'baru', metode })}
              onKeSesi={bukaSesi}
              onKeSuperSesi={bukaSuperSesi}
              onKeRiwayat={() => setTab('riwayat')}
              onBukaAdmin={() => setAdmin(true)}
            />
          </LayarAktif>
        </div>

        {dikunjungi.current.has('sesi') && (
          <div className={tab === 'sesi' ? 'h-full tab-masuk' : 'hidden'}>
            <LayarAktif aktif={tab === 'sesi'}>
              <SesiPage onKeluar={() => setTab('menu')} onLayarPenuh={setNavHidden} />
            </LayarAktif>
          </div>
        )}

        {dikunjungi.current.has('superSesi') && (
          <div className={tab === 'superSesi' ? 'h-full tab-masuk' : 'hidden'}>
            <LayarAktif aktif={tab === 'superSesi'}>
              <SuperSesiPage onKeluar={() => setTab('menu')} onLayarPenuh={setNavHidden} />
            </LayarAktif>
          </div>
        )}

        {dikunjungi.current.has('saya') && (
          <div className={tab === 'saya' ? 'h-full tab-masuk' : 'hidden'}>
            <LayarAktif aktif={tab === 'saya'}>
              <ProfilePage onKeluar={() => { setGalatKeluar(null); setKeluar(true) }} onLayarPenuh={setNavHidden}
                onBukaAdmin={() => setAdmin(true)} />
            </LayarAktif>
          </div>
        )}
      </div>

      {/* Selalu ter-mount -- bilahnya sendiri yang menggeser dirinya keluar
          layar lewat transition, supaya sembunyi/munculnya halus, bukan
          langsung hilang seperti kalau di-unmount. */}
      <BottomNav tab={tab} tersembunyi={navHidden || gulirTersembunyi} lencanaSesi={sesiBerjalan}
        onPilih={t => { setNavHidden(false); setGulirTersembunyi(false); setTab(t) }} />

      {impor && (
        <DialogImpor tujuan={impor.tujuan} metodeAwal={impor.metode} onTutup={() => setImpor(null)}
          onSelesai={n => {
            setImpor(null)
            setKabar(`${n} pertanyaan diimpor`)
            // Impor 'baru' membuat formulirnya sendiri lalu menjadikannya aktif;
            // guru diantar langsung ke editornya, karena kuncinya masih harus
            // diperiksa dan satu-satunya tempat melakukannya ada di sana.
            if (aktif) setEditor(aktif.id)
          }} />
      )}

      {keluar && (
        <LembarKonfirmasi
          judul="Keluar dari akun?"
          pesan={<>
            Formulirmu tersimpan di akun. Masuk lagi dengan email dan password untuk melanjutkan.
            {galatKeluar && <span className="block mt-2 text-red-600">{galatKeluar}</span>}
          </>}
          labelAksi="Keluar"
          sibuk={sibuk}
          onAksi={() => void jalankanKeluar()}
          onBatal={() => setKeluar(false)}
        />
      )}

      <Kabar teks={kabar} />

      {/* Anak TERAKHIR = diperiksa lebih dulu: lapisan yang menutupi halaman
          ditutup satu per satu dari yang paling atas. */}
      <Penjaga tangani={() => {
        if (keluar) { if (!sibuk) setKeluar(false); return true }
        if (impor) { setImpor(null); return true }
        return false
      }} />
    </div>
  )
}

/** Pesan sekilas di kaki layar. Satu tempat supaya bentuknya tidak bercabang. */
export function Kabar({ teks }: { teks: string | null }): ReactElement | null {
  if (!teks) return null
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-50 max-w-[calc(100%-2rem)] rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
      {teks}
    </div>
  )
}
