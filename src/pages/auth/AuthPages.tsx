import { useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNav } from '../../context/NavContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { NAMA_APLIKASI } from '../../lib/aplikasi'

// Empat layar auth dalam satu berkas: bentuknya sama (judul + kartu form), dan
// panel branding dua-nada Luang (AuthLayout/AuthBrandPanel) tidak ikut disalin.
// Semuanya KHUSUS GURU: murid bergabung ke sesi tanpa akun (MuridSesiPage).

function Kerangka({ judul, subjudul, children }: { judul: string; subjudul: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-linear-to-b from-indigo-600 to-indigo-700">
      <div className="min-h-full flex flex-col justify-center px-5 py-10 max-w-md mx-auto">
        <div className="text-center mb-6">
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">{NAMA_APLIKASI}</p>
          <h1 className="text-2xl font-bold text-white mt-1">{judul}</h1>
          <p className="text-indigo-200 text-sm mt-1">{subjudul}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl px-5 py-6">{children}</div>
      </div>
    </div>
  )
}

function Galat({ teks }: { teks: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{teks}</div>
}

function TautanTeks({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== konfirmasi) { setError('Password tidak cocok'); return }
    if (password.length < 6) { setError('Password minimal 6 karakter'); return }
    setLoading(true)
    const errMsg = await register(nama.trim(), email.trim(), password)
    if (errMsg) setError(errMsg)
    setLoading(false)
  }

  return (
    <Kerangka judul="Daftar Guru" subjudul="Murid tidak perlu mendaftar — cukup kode sesi">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nama Lengkap" type="text" value={nama} onChange={e => setNama(e.target.value)} autoComplete="name" required />
        <Input label="Email" type="email" placeholder="nama@sekolah.sch.id" value={email}
          onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <Input label="Password" type="password" placeholder="Min. 6 karakter" value={password}
          onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
        <Input label="Konfirmasi Password" type="password" placeholder="Ulangi password" value={konfirmasi}
          onChange={e => setKonfirmasi(e.target.value)} autoComplete="new-password" required />

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
        <button type="button" onClick={() => void handleBatal()} className="text-sm font-medium text-slate-400 hover:text-slate-500">
          Batal, kembali ke Masuk
        </button>
      </div>
    </Kerangka>
  )
}
