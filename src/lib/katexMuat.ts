// ─── Pemuat KaTeX: dimuat MALAS, sekali, dan tidak pernah membuat layar gagal ──
// KaTeX (+ CSS + huruf) baru diunduh saat ada soal yang memuat rumus -- soal
// tanpa rumus, dan semua layar lain di sesi-soal, tidak membayarnya sama sekali
// (wifi sekolah, lihat alasan serupa untuk font di CLAUDE.md).
//
// `janji` di-reset kalau pemuatan gagal (offline, chunk basi setelah deploy),
// supaya ketukan berikutnya boleh mencoba lagi alih-alih menyimpan galat lama
// selamanya. Selama belum termuat, pemakai memakai teksPolosSoal() -- lihat
// components/TeksSoal.tsx.

import { useEffect, useState } from 'react'
import { pecahSegmen, perbaikiLatex } from './teksMatematika'
import { latexKeUnicode } from './notasiMatematika'

export type Katex = typeof import('katex')['default']

let modul: Katex | null = null
let janji: Promise<Katex> | null = null

export function muatKatex(): Promise<Katex> {
  janji ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')])
    .then(([m]) => {
      modul = (m as unknown as { default?: Katex }).default ?? (m as unknown as Katex)
      return modul
    })
    .catch(galat => { janji = null; throw galat })
  return janji
}

/** Katex kalau sudah termuat, `null` kalau belum. Memicu pemuatan hanya saat `butuh`. */
export function useKatex(butuh: boolean): Katex | null {
  const [k, setK] = useState<Katex | null>(modul)
  useEffect(() => {
    if (!butuh || k) return
    let batal = false
    muatKatex().then(m => { if (!batal) setK(m) }).catch(() => { /* tetap di teks polos */ })
    return () => { batal = true }
  }, [butuh, k])
  return k
}

/** Opsi render yang sama di seluruh aplikasi. `trust: false` = `\href`, `\url`,
 *  `\includegraphics` mati -- LaTeX datang dari model AI dan dari guru. */
export const OPSI_KATEX = {
  throwOnError: false,
  strict: 'ignore',
  trust: false,
  maxExpand: 1000,
  maxSize: 30,
} as const

/** Apakah satu rumus lolos KaTeX tanpa galat penguraian? */
function rumusValid(k: Katex, isi: string, blok: boolean): boolean {
  try {
    k.renderToString(isi, { ...OPSI_KATEX, throwOnError: true, displayMode: blok })
    return true
  } catch {
    return false
  }
}

/**
 * Bentuk simpan yang AMAN: rumus yang tidak bisa diurai KaTeX diganti teks
 * Unicode-nya, supaya murid tidak pernah melihat rumus merah. Dipanggil di
 * DialogImpor.tsx saat keluaran Generate dari Topik masuk (satu-satunya jalur
 * yang diminta menulis LaTeX, lihat ATURAN_LATEX_SOAL di generate-soal/index.ts);
 * Impor PDF/teks dan soal yang diketik guru sendiri tetap apa adanya -- di sana
 * galat merah di pratinjau justru memberi tahu guru untuk membetulkan. KaTeX
 * gagal dimuat -> teks dikembalikan tanpa validasi (TeksSoal tetap punya
 * cadangannya sendiri).
 */
export async function pastikanRumusValid(teks: string): Promise<string> {
  const segmen = pecahSegmen(teks)
  if (!segmen.some(s => s.jenis !== 'teks')) return teks
  let k: Katex
  try { k = await muatKatex() } catch { return teks }
  return segmen
    .map(s => {
      if (s.jenis === 'teks') return s.isi.replace(/\$/g, '\\$')
      const isi = perbaikiLatex(s.isi)
      if (rumusValid(k, isi, s.jenis === 'blok')) return s.jenis === 'blok' ? `$$${isi}$$` : `$${isi}$`
      return latexKeUnicode(isi, s.jenis === 'blok').replace(/\$/g, '\\$')
    })
    .join('')
}
