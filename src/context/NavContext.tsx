import { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AppScreen, User } from '../types'
import { useAuth } from './AuthContext'
import { tangkapSesiDariUrl } from '../lib/sesiCapture'

/**
 * Penangan tombol kembali perangkat. `true` = tekanan itu DIPAKAI (ada lapisan
 * yang ditutup), `false` = teruskan ke penangan berikutnya.
 */
export type PenanganKembali = () => boolean

interface NavContextValue {
  screen: AppScreen
  goTo: (screen: AppScreen) => void
  /** Lihat useKembali() -- itu pintu yang dipakai layar, bukan ini. */
  daftarKembali: (fn: PenanganKembali) => () => void
  /**
   * Rantai penangan kembali yang sama dengan tombol perangkat, TANPA jaring
   * terakhirnya. Dipakai panah di layar supaya "kembali" berarti hal yang sama
   * dari mana pun ditekan. `false` = tidak ada yang menanggapi.
   */
  mintaKembali: () => boolean
}

const NavContext = createContext<NavContextValue | null>(null)

/** Berapa lama "tekan sekali lagi untuk keluar" berlaku. */
const JEDA_KELUAR_MS = 2200

export function NavProvider({ children }: { children: ReactNode }) {
  const { user, authLoading, passwordRecovery } = useAuth()
  const [screen, setScreen] = useState<AppScreen>(() => {
    // Kode sesi dari link guru (?sesi=ABC-123). Ditangkap sebelum apa pun
    // mengubah URL -- login/pendaftaran di tengah jalan akan menghapusnya.
    tangkapSesiDariUrl()
    // Tanpa sesi login, pintu depannya layar KODE SESI, bukan Login: murid tidak
    // punya akun, dan guru cuma satu ketukan "Masuk" dari sana.
    return { name: 'murid' }
  })
  const [konfirmasiKeluar, setKonfirmasiKeluar] = useState(false)
  const prevUser = useRef<User | null>(null)

  // useLayoutEffect supaya layar ikut berubah sebelum paint pertama -- mencegah
  // kilasan Login sebelum lompat ke beranda.
  useLayoutEffect(() => {
    if (authLoading) return
    // prevUser SENGAJA tidak diperbarui di sini: begitu clearPasswordRecovery
    // dipanggil, efek ini lanjut ke routing normal di bawah.
    if (passwordRecovery) { setScreen({ name: 'resetPassword' }); return }
    const sebelumnya = prevUser.current
    prevUser.current = user
    if ((user?.id ?? null) === (sebelumnya?.id ?? null)) return
    if (user) setScreen(user.role === 'guru' ? { name: 'guru' } : { name: 'murid' })
    // Guru yang keluar kembali ke Masuk. Murid anonim yang identitasnya dibuang
    // sesudah mengirim jawaban TETAP di layar murid -- nama layarnya sama, jadi
    // MuridHome tidak di-mount ulang dan layar hasilnya tidak hilang.
    else setScreen(sebelumnya?.role === 'guru' ? { name: 'login' } : { name: 'murid' })
  }, [user, authLoading, passwordRecovery])

  const goTo = useCallback((s: AppScreen) => setScreen(s), [])

  // ─── Tombol kembali perangkat ──────────────────────────────────────────────
  // Tanpa router, tombol kembali Android (dan usap-dari-tepi) langsung MENUTUP
  // aplikasi: riwayatnya cuma satu entri. Satu entri PENJAGA didorong ke
  // riwayat; tombol kembali memakannya (popstate, aplikasi tidak tertutup), kita
  // kerjakan maunya, lalu penjaganya dipasang lagi di slot yang sama.

  // Penanda per MUAT HALAMAN, bukan boolean: state entri riwayat ikut tersimpan
  // melewati reload, dan boolean akan menyimpulkan "sudah terpasang" padahal
  // entri penjaganya sudah tidak ada -- tekanan pertama sesudah refresh menutup
  // aplikasi.
  const idPenjaga = useRef(Math.random().toString(36).slice(2))
  const penanganKembali = useRef<PenanganKembali[]>([])

  const daftarKembali = useCallback((fn: PenanganKembali) => {
    penanganKembali.current.push(fn)
    return () => {
      const i = penanganKembali.current.indexOf(fn)
      if (i !== -1) penanganKembali.current.splice(i, 1)
    }
  }, [])

  const screenRef = useRef(screen)
  screenRef.current = screen

  /** Dari yang TERAKHIR mendaftar: komponen paling baru ter-mount = paling dekat ke mata. */
  const mintaKembali = useCallback((): boolean => {
    for (let i = penanganKembali.current.length - 1; i >= 0; i--) {
      if (penanganKembali.current[i]()) return true
    }
    return false
  }, [])

  const tanganiKembali = useCallback((): boolean => {
    if (mintaKembali()) return true
    // resetPassword sengaja tidak ikut: tautan email cuma bisa dipakai sekali.
    const s = screenRef.current
    if (s.name === 'register' || s.name === 'forgotPassword') {
      setScreen({ name: 'login' })
      return true
    }
    // Masuk dibuka dari layar kode sesi (atau sesudah guru keluar); mundur dari
    // sana kembali ke pintu depan, bukan menutup aplikasi.
    if (s.name === 'login') {
      setScreen({ name: 'murid' })
      return true
    }
    return false
  }, [mintaKembali])

  const pasangPenjaga = useCallback(() => {
    const st = window.history.state as { sesiSoalNav?: string } | null
    if (st?.sesiSoalNav === idPenjaga.current) return
    window.history.pushState({ ...(st ?? {}), sesiSoalNav: idPenjaga.current }, '')
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const onPop = () => {
      window.clearTimeout(timer)
      if (tanganiKembali()) {
        setKonfirmasiKeluar(false)
        pasangPenjaga()
        return
      }
      // Tidak ada lagi yang bisa ditutup. Penjaga SENGAJA tidak dipasang lagi
      // selama beberapa detik: tekanan kedua jatuh ke riwayat sungguhan dan
      // benar-benar menutup aplikasi -- pola dua-ketuk Android.
      setKonfirmasiKeluar(true)
      timer = window.setTimeout(() => {
        setKonfirmasiKeluar(false)
        pasangPenjaga()
      }, JEDA_KELUAR_MS)
    }

    pasangPenjaga()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.clearTimeout(timer)
    }
  }, [tanganiKembali, pasangPenjaga])

  // supabase-js memanggil history.replaceState untuk membersihkan token dari URL
  // sesudah login/pemulihan sandi, dan itu menimpa penanda kita.
  useEffect(() => {
    if (!konfirmasiKeluar) pasangPenjaga()
  }, [screen, konfirmasiKeluar, pasangPenjaga])

  const value = useMemo<NavContextValue>(() => ({
    screen, goTo, daftarKembali, mintaKembali,
  }), [screen, goTo, daftarKembali, mintaKembali])

  return (
    <NavContext.Provider value={value}>
      {children}
      {konfirmasiKeluar && (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-6 pointer-events-none">
          <p className="rounded-full bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 shadow-lg">
            Tekan sekali lagi untuk keluar
          </p>
        </div>
      )}
    </NavContext.Provider>
  )
}

/**
 * Gerbang "layar ini sedang benar-benar terlihat", diwariskan ke seluruh pohon
 * di bawahnya. Tab yang pernah dibuka tetap TER-MOUNT; tanpa gerbang ini tombol
 * kembali bisa menutup lapisan di tab yang tidak kelihatan.
 */
const LayarAktifContext = createContext(true)

export function LayarAktif({ aktif, children }: { aktif: boolean; children: ReactNode }) {
  return <LayarAktifContext.Provider value={aktif}>{children}</LayarAktifContext.Provider>
}

/**
 * Mendaftarkan satu penangan tombol kembali selama komponennya ter-mount DAN
 * gerbangnya terbuka. `aktif` eksplisit menang; kosong = diwarisi dari
 * `<LayarAktif>` terdekat. Penangan disimpan lewat ref, jadi selalu membaca
 * state terbaru tanpa didaftarkan ulang.
 */
export function useKembali(fn: PenanganKembali, aktif?: boolean): void {
  const { daftarKembali } = useNav()
  const warisan = useContext(LayarAktifContext)
  const nyala = aktif ?? warisan
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!nyala) return
    return daftarKembali(() => ref.current())
  }, [daftarKembali, nyala])
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav harus digunakan dalam NavProvider')
  return ctx
}
