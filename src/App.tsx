import { Suspense, lazy } from 'react'
import { useAuth } from './context/AuthContext'
import { useNav } from './context/NavContext'
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth/AuthPages'
import { PageFallback } from './components/PageFallback'

// Lazy per peran: murid yang cuma mau mengetik kode tidak ikut mengunduh Bank
// Soal dan layar kendali guru, dan sebaliknya.
const GuruHome = lazy(() => import('./pages/guru/GuruHome').then(m => ({ default: m.GuruHome })))
const MuridHome = lazy(() => import('./pages/murid/MuridHome').then(m => ({ default: m.MuridHome })))

export function App() {
  const { authLoading } = useAuth()
  const { screen } = useNav()

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-teks-2 text-sm">Memuat...</p>
        </div>
      </div>
    )
  }

  switch (screen.name) {
    case 'login': return <LoginPage />
    case 'register': return <RegisterPage />
    case 'forgotPassword': return <ForgotPasswordPage />
    case 'resetPassword': return <ResetPasswordPage />
    case 'guru': return <Suspense fallback={<PageFallback />}><GuruHome /></Suspense>
    case 'murid': return <Suspense fallback={<PageFallback />}><MuridHome /></Suspense>
  }
}
