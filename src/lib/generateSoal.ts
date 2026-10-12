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
export const MAKS_PANJANG_TP = 300 // cermin MAKS_PANJANG_TP di supabase/functions/generate-soal/index.ts
/** Jumlah opsi jawaban yang bisa dipilih guru (A-D atau A-E) -- cermin
 *  MAKS_JUMLAH_OPSI di supabase/functions/generate-soal/index.ts. */
export const MAKS_JUMLAH_OPSI = 5
const MIN_JUMLAH_OPSI = 4

export type Kesulitan = 'mudah' | 'sedang' | 'sulit'

export async function generateSoal(topik: string, jumlah: number, kesulitan: Kesulitan, tp = '', jumlahOpsi = MIN_JUMLAH_OPSI): Promise<HasilTempel> {
  const bersih = topik.trim()
  if (!bersih) throw new Error('Topik tidak boleh kosong')
  if (bersih.length > MAKS_PANJANG_TOPIK) throw new Error(`Topik terlalu panjang (maksimal ${MAKS_PANJANG_TOPIK} karakter)`)
  const tpBersih = tp.trim()
  if (tpBersih.length > MAKS_PANJANG_TP) throw new Error(`Tujuan pembelajaran terlalu panjang (maksimal ${MAKS_PANJANG_TP} karakter)`)
  if (!Number.isInteger(jumlahOpsi) || jumlahOpsi < MIN_JUMLAH_OPSI || jumlahOpsi > MAKS_JUMLAH_OPSI) {
    throw new Error(`Jumlah pilihan jawaban harus antara ${MIN_JUMLAH_OPSI} dan ${MAKS_JUMLAH_OPSI}`)
  }

  const { data, error } = await supabase.functions.invoke('generate-soal', {
    body: { topik: bersih, jumlah, kesulitan, tp: tpBersih, jumlahOpsi },
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
