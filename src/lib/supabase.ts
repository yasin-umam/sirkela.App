import { createClient } from '@supabase/supabase-js'

export interface DbFormulir {
  id: string
  guru_id: string
  judul: string
  deskripsi: string
  durasi_menit: number
  kunci_layar: boolean
  gform_id: string | null
  created_at: string
  diperbarui_pada: string
}

export interface DbBankSoal {
  id: string
  guru_id: string
  formulir_id: string
  pertanyaan: string
  pilihan: string[]
  /** null = draf, kunci belum dipilih (F1). */
  jawaban_benar: number | null
  urutan: number
  created_at: string
}

export interface DbSesiKelas {
  id: string
  guru_id: string
  /** null = formulir asalnya sudah dihapus; sesinya tetap utuh (A6). */
  formulir_id: string | null
  judul: string
  deskripsi: string
  durasi_menit: number
  kode_join: string
  kode_kedaluwarsa: string
  konten_list: unknown[]
  status: 'aktif' | 'selesai'
  mulai_pada: string | null
  selesai_pada: string | null
  kunci_layar: boolean
  kunci_layar_sejak: string | null
  created_at: string
}

export interface DbSesiMurid {
  id: string
  sesi_id: string
  murid_id: string
  nama: string
  joined_at: string
  terakhir_denyut: string | null
  /** Non-null = terkunci. */
  terkunci_pada: string | null
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Gagal KERAS di awal, bukan belakangan sebagai "Failed to fetch" di layar login
// yang tidak menunjuk ke penyebabnya.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi -- salin .env.example jadi .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
