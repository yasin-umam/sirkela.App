import type { HasilTempel } from './tempelSoal'
import { supabase } from './supabase'

// ─── Generate dari topik -> soal lewat AI (Edge Function `generate-soal`) ────
// Ditambahkan 2026-09-22: guru menulis topik/materi, AI MENGARANG soal pilihan
// ganda dari nol di SERVER (kunci OpenRouter tidak pernah ke klien -- lihat
// supabase/functions/generate-soal). Hasilnya berbentuk HasilTempel yang SAMA
// dengan uraikanTempelan()/imporPdf(), jadi DialogImpor memakai satu layar
// Tinjau untuk ketiga sumber -- guru tetap menandai/memeriksa kunci sendiri
// sebelum Impor, sama seperti dua sumber lainnya (lihat CLAUDE.md).

export const MAKS_JUMLAH_SOAL = 20 // cermin MAKS_JUMLAH_SOAL di supabase/functions/generate-soal/index.ts
export const MAKS_PANJANG_TOPIK = 500 // cermin MAKS_PANJANG_TOPIK di supabase/functions/generate-soal/index.ts

export type Kesulitan = 'mudah' | 'sedang' | 'sulit'

export async function generateSoal(topik: string, jumlah: number, kesulitan: Kesulitan): Promise<HasilTempel> {
  const bersih = topik.trim()
  if (!bersih) throw new Error('Topik tidak boleh kosong')
  if (bersih.length > MAKS_PANJANG_TOPIK) throw new Error(`Topik terlalu panjang (maksimal ${MAKS_PANJANG_TOPIK} karakter)`)

  const { data, error } = await supabase.functions.invoke('generate-soal', {
    body: { topik: bersih, jumlah, kesulitan },
  })

  if (error) {
    let pesan = error.message
    try {
      const context = (error as { context?: Response }).context
      const isi = await context?.json()
      if (isi?.error) pesan = isi.error
    } catch {
      // respons bukan JSON -- pakai pesan bawaan
    }
    throw new Error(pesan || 'Gagal generate soal')
  }

  return data as HasilTempel
}
