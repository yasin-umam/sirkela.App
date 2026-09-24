import { useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNav } from '../../context/NavContext'
import { cekKodeSekolah } from '../../lib/sekolah'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Logo } from '../../components/Logo'

// Empat layar auth dalam satu berkas: bentuknya sama (logo + kartu kepala +
// kartu form), dan panel branding dua-nada milik Luang tidak ikut disalin --
// aplikasi ini cuma sekolah/guru perorangan, bukan produk yang perlu dijual
// lewat panel testimoni.
// Semuanya KHUSUS GURU: murid bergabung ke sesi tanpa akun (MuridSesiPage).

function Kerangka({ judul, subjudul, children }: { judul: string; subjudul: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto hide-scrollbar bg-slate-50 tekstur-latar">
      <div className="min-h-full flex flex-col justify-center gap-4 px-4 py-10 max-w-md mx-auto">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="text-center px-2">
          <h1 className="text-xl font-bold text-slate-800">{judul}</h1>
          <p className="text-sm text-slate-500 mt-1">{subjudul}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

function Galat({ teks }: { teks: string }) {
  return <p className="text-sm text-red-600">{teks}</p>
}

function TautanTeks({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-semibold text-indigo-600 hover:underline">
      {children}
    </button>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const { goTo } = useNav()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const errMsg = await login(email.trim(), password)
    if (errMsg) setError(errMsg)
    setLoading(false)
  }

  return (
    <Kerangka judul="Masuk Guru" subjudul="Murid tidak perlu akun">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="nama@sekolah.sch.id" value={email}
          onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <Input label="Password" type="password" placeholder="••••••••" value={password}
          onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        <div className="-mt-2 text-right">
          <TautanTeks onClick={() => goTo({ name: 'forgotPassword' })}>Lupa password?</TautanTeks>
        </div>
        {error && <Galat teks={error} />}
        <Button type="submit" size="lg" fullWidth disabled={loading}>{loading ? 'Masuk...' : 'Masuk'}</Button>
      </form>
      <div className="mt-5 text-center">
        <span className="text-sm text-slate-500">Belum punya akun? </span>
        <TautanTeks onClick={() => goTo({ name: 'register' })}>Daftar</TautanTeks>
      </div>
      <div className="mt-3 pt-4 border-t border-slate-100 text-center">
        <span className="text-sm text-slate-500">Murid? </span>
        <TautanTeks onClick={() => goTo({ name: 'murid' })}>Gabung sesi dengan kode</TautanTeks>
      </div>
    </Kerangka>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const { goTo } = useNav()
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [kodeSekolah, setKodeSekolah] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== konfirmasi) { setError('Password tidak cocok'); return }
    if (password.length < 6) { setError('Password minimal 6 karakter'); return }
    setLoading(true)
    // Dicek dulu di sini, bukan menunggu handle_new_user() menolaknya di tengah
    // signUp() -- pesan trigger belum tentu tembus apa adanya lewat GoTrue.
    const namaSekolah = await cekKodeSekolah(kodeSekolah.trim())
    if (!namaSekolah) {
      setError('Kode sekolah tidak ditemukan. Tanyakan ke kepala sekolah atau admin.')
      setLoading(false)
      return
    }
    const errMsg = await register(nama.trim(), email.trim(), password, kodeSekolah.trim())
    if (errMsg) setError(errMsg)
    setLoading(false)
  }

  return (
    <Kerangka judul="Daftar Guru" subjudul="Murid tidak perlu mendaftar, cukup kode sesi">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nama Lengkap" type="text" value={nama} onChange={e => setNama(e.target.value)} autoComplete="name" required />
        <Input label="Email" type="email" placeholder="nama@sekolah.sch.id" value={email}
          onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <Input label="Password" type="password" placeholder="Min. 6 karakter" value={password}
          onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
        <Input label="Konfirmasi Password" type="password" placeholder="Ulangi password" value={konfirmasi}
          onChange={e => setKonfirmasi(e.target.value)} autoComplete="new-password" required />
        <Input label="Kode Sekolah" type="text" placeholder="Tanyakan ke kepala sekolah/admin" value={kodeSekolah}
          onChange={e => setKodeSekolah(e.target.value)} autoComplete="off" required />

        {error && <Galat teks={error} />}
        <Button type="submit" size="lg" fullWidth disabled={loading}>{loading ? 'Mendaftar...' : 'Daftar'}</Button>
      </form>
      <div className="mt-5 text-center">
        <span className="text-sm text-slate-500">Sudah punya akun? </span>
        <TautanTeks onClick={() => goTo({ name: 'login' })}>Masuk</TautanTeks>
      </div>
    </Kerangka>
  )
}

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const { goTo } = useNav()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [terkirim, setTerkirim] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const errMsg = await sendPasswordReset(email.trim())
    setLoading(false)
    if (errMsg) setError(errMsg)
    else setTerkirim(true)
  }

  return (
    <Kerangka judul="Lupa Password" subjudul="Kami kirim link reset ke email">
      {terkirim ? (
        <div className="flex flex-col gap-4">
          {/* Kalimat yang sama untuk email terdaftar maupun tidak -- mencegah orang
              menebak email mana yang punya akun. */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
            Kalau email tersebut terdaftar, link untuk mengganti password sudah dikirim. Cek inbox atau folder spam.
          </div>
          <Button size="lg" fullWidth onClick={() => goTo({ name: 'login' })}>Kembali ke Masuk</Button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            {error && <Galat teks={error} />}
            <Button type="submit" size="lg" fullWidth disabled={loading}>{loading ? 'Mengirim...' : 'Kirim Link Reset'}</Button>
          </form>
          <div className="mt-5 text-center">
            <TautanTeks onClick={() => goTo({ name: 'login' })}>Kembali ke Masuk</TautanTeks>
          </div>
        </>
      )}
    </Kerangka>
  )
}

export function ResetPasswordPage() {
  const { updatePassword, clearPasswordRecovery, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== konfirmasi) { setError('Password tidak cocok'); return }
    if (password.length < 6) { setError('Password minimal 6 karakter'); return }
    setLoading(true)
    const errMsg = await updatePassword(password)
    setLoading(false)
    if (errMsg) { setError(errMsg); return }
    // Sesi recovery sudah sah login dengan password baru -- lanjut seperti login biasa.
    clearPasswordRecovery()
  }

  async function handleBatal() {
    // Sesi recovery ikut dibatalkan supaya tidak nyangkut "setengah login".
    await logout()
    clearPasswordRecovery()
  }

  return (
    <Kerangka judul="Password Baru" subjudul="Buat password baru untuk akunmu">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Password Baru" type="password" placeholder="Min. 6 karakter" value={password}
          onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
        <Input label="Konfirmasi Password" type="password" value={konfirmasi}
          onChange={e => setKonfirmasi(e.target.value)} autoComplete="new-password" required />
        {error && <Galat teks={error} />}
        <Button type="submit" size="lg" fullWidth disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Password Baru'}</Button>
      </form>
      <div className="mt-5 text-center">
        <button type="button" onClick={() => void handleBatal()} className="text-sm font-medium text-slate-400 hover:text-slate-600">
          Batal, kembali ke Masuk
        </button>
      </div>
    </Kerangka>
  )
}
