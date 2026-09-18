import type { HasilTempel } from './tempelSoal'
import { supabase } from './supabase'

// ─── Impor PDF -> soal lewat AI (Edge Function `impor-pdf`) ──────────────────
// Guru mengunggah PDF (ekspor Microsoft 365, Google Form, atau dokumen soal
// apa pun); AI yang membacanya di SERVER (kunci OpenRouter tidak pernah ke
// klien -- lihat supabase/functions/impor-pdf). Hasilnya berbentuk HasilTempel
// yang SAMA dengan uraikanTempelan() di tempelSoal.ts, jadi DialogImpor bisa
// memakai satu layar Tinjau untuk kedua sumber: kunci jawaban dari AI cuma
// tebakan, guru tetap menandainya sendiri sebelum Impor.

const MAKS_BYTE_PDF = 15_000_000 // ~15 MB, cermin MAKS_BYTE_PDF di supabase/functions/impor-pdf/index.ts

function bacaSebagaiDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Gagal membaca berkas'))
    r.readAsDataURL(file)
  })
}

export async function imporPdf(file: File): Promise<HasilTempel> {
  if (file.type !== 'application/pdf') throw new Error('Berkas harus PDF')
  if (file.size > MAKS_BYTE_PDF) throw new Error('PDF terlalu besar (maksimal 15 MB)')

  const fileData = await bacaSebagaiDataUrl(file)
  const { data, error } = await supabase.functions.invoke('impor-pdf', {
    body: { filename: file.name, fileData },
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
    throw new Error(pesan || 'Gagal mengimpor PDF')
  }

  return data as HasilTempel
}
