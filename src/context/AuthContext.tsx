import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { User, Role } from '../types'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  authLoading: boolean
  /** true begitu user membuka link reset password dari email. */
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
  login: (email: string, password: string) => Promise<string | null>
  /**
   * Pendaftaran email = akun GURU (kepala sekolah dipromosikan manual sesudahnya,
   * lihat CLAUDE.md). Murid tidak mendaftar (lihat masukTamu). kodeSekolah WAJIB
   * -- handle_new_user() menolak akun non-anonim tanpa sekolah yang valid.
   */
  register: (nama: string, email: string, password: string, kodeSekolah: string) => Promise<string | null>
  /**
   * Pastikan perangkat ini punya identitas murid. Idempoten: sesi yang sudah ada
   * dipakai, bukan diganti akun anonim baru.
   */
  masukTamu: () => Promise<string | null>
  logout: () => Promise<void>
  updateNama: (nama: string) => Promise<string | null>
  sendPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_UJI_TAMPILAN) {
    const value: AuthContextValue = {
      user: { id: 'g1', nama: 'Guru Uji', email: 'guru@uji.test', role: 'guru' },
      authLoading: false, passwordRecovery: false,
      clearPasswordRecovery: () => {}, login: async () => null, register: async () => null,
      masukTamu: async () => null, logout: async () => {}, updateNama: async () => null,
      sendPasswordReset: async () => null, updatePassword: async () => null,
    }
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  }

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  async function resolveSession(userId: string, email: string): Promise<string | null> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nama, role')
      .eq('id', userId)
      .maybeSingle()

    if (error) return error.message
    if (!profile) return 'Profil tidak ditemukan. Silakan daftar ulang.'

    const p = profile as { nama: string; role: Role }
    setUser({ id: userId, nama: p.nama, email, role: p.role })
    return null
  }

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const err = await resolveSession(session.user.id, session.user.email ?? '')
        if (err) await supabase.auth.signOut()
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setUser(null)
      // Link reset password membuka app dengan token recovery; supabase-js
      // menukarnya jadi sesi sah dan memicu event ini (bukan SIGNED_IN). Profil
      // tetap dimuat, tapi NavContext memaksa layar ganti password lebih dulu.
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        void resolveSession(session.user.id, session.user.email ?? '')
        setPasswordRecovery(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    const profileError = await resolveSession(data.user.id, data.user.email ?? '')
    if (profileError) {
      await supabase.auth.signOut()
      return profileError
    }
    return null
  }, [])

  // nama & kode_sekolah dikirim lewat metadata; trigger on_auth_user_created
  // yang menulis barisnya ke profiles. Peran TIDAK dikirim: trigger
  // menurunkannya dari jenis akun (email = guru, anonim = murid), karena
  // metadata ditulis klien -- kode_sekolah cuma menentukan AFILIASI sekolah,
  // bukan peran (promosi ke kepala_sekolah tetap manual lewat SQL editor).
  const register = useCallback(async (nama: string, email: string, password: string, kodeSekolah: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nama, kode_sekolah: kodeSekolah } },
    })
    if (error) return error.message
    if (!data.user) return 'Gagal membuat akun'
    // Tanpa sesi = konfirmasi email masih menyala di dashboard Supabase.
    if (!data.session) return 'Akun dibuat. Cek email untuk konfirmasi, lalu masuk.'
    return resolveSession(data.user.id, data.user.email ?? '')
  }, [])

  // Murid tidak punya akun: identitasnya akun ANONIM Supabase, dibuat saat
  // pertama kali bergabung ke sesi dan disimpan supabase-js di localStorage
  // perangkat ini. Refresh di tengah sesi = identitas yang sama = jawaban yang
  // sama (A3, A5). Trigger on_auth_user_created menjadikannya murid.
  const masukTamu = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return null
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) return pesanMasukTamu(error.message)
    if (!data.user) return 'Gagal bergabung. Coba lagi.'
    const profileError = await resolveSession(data.user.id, '')
    if (profileError) {
      await supabase.auth.signOut()
      return profileError
    }
    return null
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const updateNama = useCallback(async (nama: string): Promise<string | null> => {
    if (!user) return 'Belum login'
    const bersih = nama.trim()
    if (!bersih) return 'Nama tidak boleh kosong'
    const { error } = await supabase.from('profiles').update({ nama: bersih }).eq('id', user.id)
    if (error) return error.message
    setUser(prev => prev ? { ...prev, nama: bersih } : prev)
    return null
  }, [user])

  const sendPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    return error ? error.message : null
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password })
    return error ? error.message : null
  }, [])

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), [])

  const value = useMemo<AuthContextValue>(() => ({
    user, authLoading, passwordRecovery, clearPasswordRecovery,
    login, register, masukTamu, logout, updateNama, sendPasswordReset, updatePassword,
  }), [user, authLoading, passwordRecovery, clearPasswordRecovery, login, register, masukTamu, logout, updateNama, sendPasswordReset, updatePassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Dua kegagalan yang PASTI terjadi di kelas kalau dashboard belum diatur, dan
// pesan aslinya tidak menunjuk ke siapa yang bisa memperbaikinya.
function pesanMasukTamu(pesan: string): string {
  if (/anonymous sign-ins are disabled/i.test(pesan)) {
    return 'Bergabung tanpa akun belum diaktifkan di server. Beri tahu gurumu.'
  }
  // Bawaan Supabase 30 akun anonim per jam per IP -- satu kelas di belakang
  // satu wifi sekolah menghabiskannya.
  if (/rate limit/i.test(pesan)) {
    return 'Terlalu banyak yang bergabung dari jaringan ini. Tunggu sebentar lalu coba lagi, atau beri tahu gurumu.'
  }
  if (/fetch|network|Failed to send/i.test(pesan)) return 'Tidak ada koneksi. Coba lagi.'
  return pesan
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus digunakan dalam AuthProvider')
  return ctx
}
