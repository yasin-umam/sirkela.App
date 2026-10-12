// ─── Teks soal dengan rumus bertipografi ─────────────────────────────────────
// Soal disimpan sebagai TEKS dengan LaTeX di dalam `$...$` (sebaris) dan
// `$$...$$` (blok / beberapa baris). Kolomnya tetap teks -- tidak ada migration;
// `bank_soal`, `konten_list` sesi & kiriman Super Sesi membawanya apa adanya.
// Soal lama tanpa `$` tampil persis seperti dulu.
//
// Modul ini MURNI (tanpa React, tanpa KaTeX) supaya bisa diuji sendiri:
//   - pecahSegmen()        teks -> potongan teks / rumus sebaris / rumus blok
//   - normalisasiSoal()    membersihkan keluaran model saat masuk
//   - teksPolosSoal()      cadangan satu-baris untuk tempat tanpa renderer
//   - perbaikiJsonModel()  JSON dari model, TAHAN backslash LaTeX
// Yang menyentuh KaTeX: components/TeksSoal.tsx (tampil) dan lib/katexMuat.ts
// (pemuat + validasi). Kalimat aturan prompt (ATURAN_LATEX_SOAL) TIDAK ikut di
// sini -- dia hidup sendiri di supabase/functions/generate-soal/index.ts (Deno),
// karena Edge Function dan klien (Vite) adalah dua target bundel berbeda; kalau
// pola `$...$`/`$$...$$` di POLA_SEGMEN berubah, cocokkan juga di sana.

import { rapikanNotasiMatematika, latexKeUnicode } from './notasiMatematika'

export interface Segmen {
  jenis: 'teks' | 'inline' | 'blok'
  isi: string
}

// Urutan alternatif PENTING: `\$` (dolar yang di-escape) lebih dulu supaya tidak
// dibaca pembuka rumus. `$...$` sebaris mengikuti aturan Pandoc/TeX: isinya tidak
// boleh diawali atau diakhiri spasi, dan penutupnya tidak boleh langsung diikuti
// angka -- itu yang membuat "$5 dan $10" (harga) tetap teks biasa.
const POLA_SEGMEN =
  /\\\$|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g

/** Pecah teks soal jadi teks biasa + rumus. `\$` dikembalikan menjadi `$` di teks. */
export function pecahSegmen(teks: string): Segmen[] {
  const hasil: Segmen[] = []
  const dorongTeks = (isi: string) => {
    if (!isi) return
    const terakhir = hasil[hasil.length - 1]
    if (terakhir && terakhir.jenis === 'teks') terakhir.isi += isi
    else hasil.push({ jenis: 'teks', isi })
  }
  let akhir = 0
  for (const m of teks.matchAll(POLA_SEGMEN)) {
    const mulai = m.index ?? 0
    dorongTeks(teks.slice(akhir, mulai))
    akhir = mulai + m[0].length
    if (m[0] === '\\$') { dorongTeks('$'); continue }
    const blok = m[1] ?? m[2]
    if (blok != null) hasil.push({ jenis: 'blok', isi: blok.trim() })
    else hasil.push({ jenis: 'inline', isi: (m[3] ?? m[4]).trim() })
  }
  dorongTeks(teks.slice(akhir))
  return hasil
}

/**
 * Teks polos: rumus -> Unicode satu baris. Dipakai (1) sebagai tampilan selama
 * KaTeX belum termuat / gagal termuat, (2) di konteks teks murni -- pratinjau
 * ringkas di daftar, ekspor .docx.
 */
export function teksPolosSoal(teks: string | null | undefined): string {
  if (!teks) return ''
  if (!/[$\\]/.test(teks)) return teks
  return pecahSegmen(teks)
    .map(s => s.jenis === 'teks' ? s.isi
      : s.jenis === 'blok' ? `\n${latexKeUnicode(s.isi, true)}\n`
      : latexKeUnicode(s.isi))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Lingkungan berbaris. Di dalamnya `\\` = pindah baris.
const POLA_LINGKUNGAN = /(\\begin\{(aligned|align\*?|cases|array|[pbvBV]?matrix|gathered|split)\}[\s\S]*?\\end\{\2\})/g

/**
 * Perbaikan kecil pada isi SATU rumus. Kalau model menulis `\\` (pindah baris)
 * sebagai LaTeX mentah di dalam string JSON, `JSON.parse` mengubahnya menjadi
 * SATU backslash -- barisnya menyatu. Di dalam lingkungan berbaris, satu backslash
 * yang diikuti spasi/baris baru hampir pasti pindah baris yang hilang tadi.
 */
export function perbaikiLatex(latex: string): string {
  return latex
    .trim()
    .replace(POLA_LINGKUNGAN, blok => blok.replace(/(?<!\\)\\(?=[ \t\r\n])/g, '\\\\'))
}

/**
 * Keluaran model -> bentuk simpan. Rumus dipertahankan sebagai LaTeX (dirapikan);
 * teks di LUAR rumus masih dibersihkan dari notasi gaya pemrograman (`x^2` ->
 * `x²`) karena model kadang tetap menulisnya tanpa `$`. `$` literal di teks
 * di-escape lagi supaya hasilnya idempoten (dibaca ulang tetap sama).
 */
export function normalisasiSoal(teks: string): string {
  if (!teks) return teks
  return pecahSegmen(teks)
    .map(s => {
      if (s.jenis === 'teks') return rapikanNotasiMatematika(s.isi, false).replace(/\$/g, '\\$')
      const isi = perbaikiLatex(s.isi)
      return s.jenis === 'blok' ? `$$${isi}$$` : `$${isi}$`
    })
    .join('')
    .trim()
}

// ─── JSON dari model, tahan backslash LaTeX ──────────────────────────────────
// LaTeX di dalam string JSON butuh backslash DOBEL (`\\frac`), dan model sering
// lupa -- termasuk lewat tool-call paksa (`catat_soal` di generate-soal/index.ts):
// tool-call cuma menjamin SINTAKS JSON-nya sah, bukan escape yang benar SECARA
// SEMANTIK. Akibatnya bukan galat: `\f`, `\t`, `\n`, `\r`, `\b` adalah escape JSON
// yang SAH, jadi "\frac" lolos JSON.parse diam-diam sebagai karakter form-feed +
// "rac", "\text" jadi tab + "ext", "\neq" jadi baris baru + "eq", "\right" jadi
// carriage return. Escape lain (`\s`, `\(`, `\p`...) membuat JSON.parse gagal
// total. Jadi backslash LaTeX diperbaiki SEBELUM parse.
//
// Yang ambigu (b f n r t) hanya dianggap LaTeX kalau seluruh deret hurufnya
// adalah perintah yang dikenal -- "\nSoal" tetap baris baru, "\neq" jadi LaTeX.
const PERINTAH_AMBIGU: Record<string, ReadonlySet<string>> = {
  b: new Set(['beta', 'bar', 'begin', 'binom', 'boldsymbol', 'big', 'bigg', 'because', 'bullet', 'bmod', 'bot']),
  f: new Set(['frac', 'forall']),
  n: new Set(['neq', 'ne', 'nu', 'nabla', 'not', 'notin', 'ni', 'nleq', 'ngeq', 'nmid', 'nsubseteq', 'ncong', 'nolimits', 'neg']),
  r: new Set(['right', 'rho', 'rightarrow', 'rangle', 'rfloor', 'rceil', 'rbrace', 'rbrack', 'rm']),
  t: new Set(['text', 'textbf', 'textit', 'textrm', 'textsf', 'texttt', 'times', 'theta', 'to', 'tan', 'tanh', 'tfrac', 'therefore', 'triangle', 'tilde', 'top', 'tau']),
}

/** Perbaiki backslash & karakter kontrol mentah di dalam string JSON keluaran model.
 *  Idempoten untuk JSON yang sudah benar. */
export function perbaikiJsonModel(mentah: string): string {
  let hasil = ''
  let dalamString = false
  for (let i = 0; i < mentah.length; i++) {
    const c = mentah[i]
    if (c === '\\') {
      const n = mentah[i + 1]
      if (n === undefined) { hasil += '\\\\'; break }
      // Escape yang sah dan jelas: dipertahankan.
      if (n === '\\' || n === '"' || n === '/') { hasil += c + n; i++; continue }
      if (n === 'u' && /^[0-9a-fA-F]{4}/.test(mentah.slice(i + 2, i + 6))) { hasil += mentah.slice(i, i + 6); i += 5; continue }
      if ('bfnrt'.includes(n)) {
        const nama = /^[A-Za-z]+/.exec(mentah.slice(i + 1))![0]
        if (!PERINTAH_AMBIGU[n].has(nama)) { hasil += c + n; i++; continue } // escape JSON sungguhan
      }
      // Backslash LaTeX (atau escape tak sah): jadikan backslash literal.
      hasil += '\\\\'
      continue
    }
    if (c === '"') dalamString = !dalamString
    // Baris baru/tab MENTAH di dalam string membuat JSON.parse gagal; model
    // menulisnya pada pertanyaan berbaris banyak.
    if (dalamString && c < ' ') {
      hasil += c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
      continue
    }
    hasil += c
  }
  return hasil
}
