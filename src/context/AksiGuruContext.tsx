import { createContext, useContext } from 'react'

// ─── Aksi tingkat rumah guru, untuk bilah atas desktop ───────────────────────
// State "sedang membuat formulir", dialog Impor, dan dialog Kirim hidup di
// GuruHome. Bilah atas (BilahAtas) dipasang oleh tiap halaman sendiri, jadi ia
// meminjam aksinya lewat context ini alih-alih diteruskan lewat props ke setiap
// halaman satu-satu.

export interface AksiGuru {
  /** Formulir kosong baru, langsung dibuka di editor. */
  formulirBaru: () => void
  /** Impor/generate ke formulir BARU (dialog Impor langsung memilih caranya). */
  imporDariLuar: (metode: 'teks' | 'pdf' | 'ai') => void
  /** Dialog Kirim. Dengan `formulirId`, formulir itu langsung dipilih. */
  mulaiSesiBaru: (formulirId?: string) => void
  /** Buka kendali satu sesi; tanpa id = layar Sesi dengan pilihan bawaan. */
  bukaSesi: (id?: string) => void
  /** Dialog Buat Super Sesi (kepala sekolah). */
  buatSuperSesi: () => void
  /** Pindah ke layar Super Sesi (kepala sekolah). */
  keSuperSesi: (id?: string) => void
  /** Pindah ke tab Riwayat. */
  keRiwayat: () => void
  /** Buka editor satu formulir. */
  bukaFormulir: (id: string) => void
  membuat: boolean
}

const AksiGuruContext = createContext<AksiGuru | null>(null)

export const AksiGuruProvider = AksiGuruContext.Provider

export function useAksiGuru(): AksiGuru {
  const ctx = useContext(AksiGuruContext)
  if (!ctx) throw new Error('useAksiGuru harus digunakan dalam GuruHome')
  return ctx
}
