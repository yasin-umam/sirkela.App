import { useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNav } from '../../context/NavContext'
import { cekKodeSekolah, gabungSekolah } from '../../lib/sekolah'
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
    <div className="h-full overflow-y-auto hide-scrollbar bg-alas">
      <div className="min-h-full flex flex-col justify-center gap-4 px-4 py-10 max-w-md mx-auto">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="text-center px-2">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-tinta">{judul}</h1>
          <p className="text-[15px] text-tinta-2 mt-1.5">{subjudul}</p>
        </div>
        <div className="bg-white rounded-[20px] border border-garis px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

function Galat({ teks }: { teks: string }) {
  return <p className="text-sm font-medium text-jingga-gelap">{teks}</p>
}

function TautanTeks({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-semibold text-biru hover:underline">
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
        <span className="text-sm text-teks-3">Belum punya akun? </span>
        <TautanTeks onClick={() => goTo({ name: 'register' })}>Daftar</TautanTeks>
      </div>
      <div className="mt-3 pt-4 border-t border-garis text-center">
        <span className="text-sm text-teks-3">Murid? </span>
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
      setError('Kode sekolah tidak ditemukan. Tanyakan ke kepala sekolahmu.')
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
        <Input label="Kode Sekolah" type="text" placeholder="Tanyakan ke kepala sekolahmu" value={kodeSekolah}
          onChange={e => setKodeSekolah(e.target.value)} autoComplete="off" required />

        {error && <Galat teks={error} />}
        <Button type="submit" size="lg" fullWidth disabled={loading}>{loading ? 'Mendaftar...' : 'Daftar'}</Button>
      </form>
      <div className="mt-5 text-center">
        <span className="text-sm text-teks-3">Sudah punya akun? </span>
        <TautanTeks onClick={() => goTo({ name: 'login' })}>Masuk</TautanTeks>
      </div>
    </Kerangka>
  )
}

/**
 * Guru LAMA (akun lahir sebelum konsep sekolah ada) masih di "Sekolah Default",
 * jadi kepala sekolahnya tidak melihatnya dan kelas Super Sesi tidak sampai ke
 * mereka. Layar ini muncul SEKALI sesudah login (App.tsx, `perluKodeSekolah`):
 * kode sekolah dari kepala sekolah diperiksa dulu (nama sekolahnya ditampilkan
 * sebagai konfirmasi), baru gabung_sekolah() dipanggil. Konfirmasi itu penting
 * karena langkahnya SATU ARAH -- salah kode berarti nyangkut di sekolah yang
 * salah sampai pemilik memindahkannya lewat SQL.
 * "Nanti saja" hanya melewatinya untuk sesi ini; layar muncul lagi saat masuk berikutnya.
 */
export function HubungkanSekolahPage({ onLewati }: { onLewati: () => void }) {
  const { selesaiKodeSekolah, logout } = useAuth()
  const [kode, setKode] = useState('')
  const [langkah, setLangkah] = useState<'isi' | 'konfirmasi'>('isi')
  const [namaSekolah, setNamaSekolah] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function periksa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const bersih = kode.trim()
    // 'DEFAULT' memang ada sebagai sekolah, tapi itu tempat akun ini SEKARANG.
    if (bersih.toUpperCase() === 'DEFAULT') { setError('Kode sekolah tidak ditemukan. Tanyakan ke kepala sekolahmu.'); return }
    setLoading(true)
    const nama = await cekKodeSekolah(bersih)
    setLoading(false)
    if (!nama) { setError('Kode sekolah tidak ditemukan. Tanyakan ke kepala sekolahmu.'); return }
    setNamaSekolah(nama)
    setLangkah('konfirmasi')
  }

  async function hubungkan() {
    setError(''); setLoading(true)
    const hasil = await gabungSekolah(kode.trim())
    setLoading(false)
    if ('galat' in hasil) { setError(hasil.galat); setLangkah('isi'); return }
    selesaiKodeSekolah()
  }

  return (
    <Kerangka judul="Hubungkan ke Sekolah" subjudul="Supaya kepala sekolahmu mengenali akunmu">
      {langkah === 'isi' ? (
        <form onSubmit={periksa} className="flex flex-col gap-4">
          <p className="rounded-xl bg-biru-tipis border border-biru-muda px-4 py-3 text-[13.5px] leading-relaxed text-tinta-2">
            Akunmu belum terhubung ke sekolah mana pun, jadi kepala sekolah belum melihatmu dan
            kelas Super Sesi belum sampai ke kamu. Masukkan kode sekolah dari kepala sekolahmu.
          </p>
          <Input label="Kode Sekolah" type="text" placeholder="Tanyakan ke kepala sekolahmu" value={kode}
            onChange={e => { setKode(e.target.value); setError('') }} autoComplete="off" autoFocus required />
          {error && <Galat teks={error} />}
          <Button type="submit" size="lg" fullWidth disabled={loading || !kode.trim()}>{loading ? 'Memeriksa...' : 'Lanjut'}</Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-isian border border-garis px-4 py-4 text-center">
            <p className="text-[13px] text-teks-3">Kamu akan terhubung ke</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-tinta">{namaSekolah}</p>
          </div>
          <p className="text-[13.5px] leading-relaxed text-tinta-2">
            Pastikan ini sekolahmu. Setelah terhubung, akunmu <strong className="text-tinta">tidak bisa
            dipindahkan sendiri</strong> ke sekolah lain.
          </p>
          {error && <Galat teks={error} />}
          <div className="flex gap-2.5">
            <Button type="button" variant="secondary" size="lg" className="flex-1" disabled={loading}
              onClick={() => { setLangkah('isi'); setError('') }}>Ganti kode</Button>
            <Button type="button" size="lg" className="flex-1" disabled={loading} onClick={() => void hubungkan()}>
              {loading ? 'Menghubungkan...' : 'Hubungkan'}
            </Button>
          </div>
        </div>
      )}
      <div className="mt-5 pt-4 border-t border-garis flex items-center justify-center gap-5">
        <TautanTeks onClick={onLewati}>Nanti saja</TautanTeks>
        <button type="button" onClick={() => void logout()} className="text-sm font-medium text-teks-3 hover:text-tinta-2">Keluar</button>
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
          <div className="bg-hijau-tint border border-hijau/25 rounded-xl px-4 py-3 text-sm text-hijau-teks">
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
        <button type="button" onClick={() => void handleBatal()} className="text-sm font-medium text-teks-3 hover:text-tinta-2">
          Batal, kembali ke Masuk
        </button>
      </div>
    </Kerangka>
  )
}
