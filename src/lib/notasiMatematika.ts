// ─── Notasi matematika SATU BARIS: cadangan untuk tempat tanpa renderer ──────
// Mengubah LaTeX dan notasi gaya pemrograman (`x^2`, `sqrt(x)`, `2*3`, `>=`)
// menjadi simbol Unicode yang terbaca manusia (x², √(x), ×, ≥). Rumus di soal
// disimpan sebagai LaTeX di dalam `$...$` (lihat teksMatematika.ts) dan
// dirender bertipografi lewat KaTeX (`components/TeksSoal.tsx`); modul ini
// cuma dipakai untuk tiga hal yang memang tidak bisa memakai renderer itu:
//   1. cadangan SEBELUM KaTeX selesai dimuat, dan kalau gagal dimuat (offline);
//   2. konteks teks murni: pratinjau ringkas di daftar (RelPertanyaan,
//      RiwayatDesktop), dan ekspor .docx yang tidak menerjemahkan ke persamaan
//      Word asli;
//   3. teks DI LUAR `$...$` yang model/guru masih menulis dengan notasi
//      pemrograman tanpa membungkusnya dengan tanda dolar.
//
// Yang TIDAK disentuh: tanda `$` yang tidak membungkus rumus (harga "$5"),
// garis isian `____`, dan kurung kurawal himpunan `{1, 2, 3}`.

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', k: 'ᵏ', m: 'ᵐ',
  n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
}

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', s: 'ₛ', t: 'ₜ', x: 'ₓ',
}

// Semua karakter harus punya padanan, kalau tidak dikembalikan null: pangkat yang
// separuh naik separuh tidak ("aᵐ⁺q") lebih menyesatkan daripada `^(m+q)` utuh.
function petakan(teks: string, peta: Record<string, string>): string | null {
  const bersih = teks.replace(/\s+/g, '')
  if (!bersih) return null
  let hasil = ''
  for (const ch of bersih) {
    const p = peta[ch]
    if (!p) return null
    hasil += p
  }
  return hasil
}

function pangkat(isi: string): string {
  // `o` ikut dianggap derajat: "30^o" cara lazim guru mengetik sudut tanpa simbol °.
  if (['\\circ', '∘', 'o', '°'].includes(isi.trim())) return '°'
  return petakan(isi, SUPER) ?? `^(${isi})`
}

function subskrip(isi: string): string {
  return petakan(isi, SUB) ?? `_(${isi})`
}

// "Sederhana" = aman ditulis tanpa kurung di pecahan/akar: SATU bilangan atau SATU
// huruf, boleh berpangkat. "x+1" tidak sederhana ("x+1/2" dibaca x + ½), dan "a⁶b⁴"
// juga tidak: "√a⁶b⁴" tanpa kurung tidak jelas apakah b⁴ ikut di bawah akar.
function sederhana(s: string): boolean {
  const t = s.trim()
  if (/^(\d+([.,]\d+)?|\p{L})[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]*$/u.test(t)) return true
  // Satu grup berkurung utuh -- "(x+1)" atau "√(a⁶b⁴)" -- sudah satu kesatuan;
  // membungkusnya lagi cuma menghasilkan "((x+1))/2".
  const grup = /^[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]*√?\((.*)\)[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]*$/u.exec(t)
  if (!grup) return /^[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]*√(\d+|\p{L})$/u.test(t)
  let dalam = 0
  for (const ch of grup[1]) {
    if (ch === '(') dalam++
    else if (ch === ')' && --dalam < 0) return false
  }
  return dalam === 0
}

function kurungi(s: string): string {
  const t = s.trim()
  return sederhana(t) ? t : `(${t})`
}

// Baca satu argumen perintah LaTeX mulai dari posisi `i`: grup `{...}` seimbang,
// atau satu karakter (`\frac12`). Mengembalikan isi + posisi setelahnya.
function bacaArgumen(s: string, i: number): { isi: string; akhir: number } | null {
  let j = i
  while (j < s.length && s[j] === ' ') j++
  if (j >= s.length) return null
  if (s[j] !== '{') return { isi: s[j], akhir: j + 1 }
  let dalam = 0
  for (let k = j; k < s.length; k++) {
    if (s[k] === '{') dalam++
    else if (s[k] === '}') {
      dalam--
      if (dalam === 0) return { isi: s.slice(j + 1, k), akhir: k + 1 }
    }
  }
  return null
}

// Perintah LaTeX -> simbol. Penutup `(?![A-Za-z])`, BUKAN `\b`: `\int_0^1` dan
// `\sum_{k=1}` harus terbaca (garis bawah itu karakter kata, jadi `\b` tidak
// pernah jatuh di antara "t" dan "_" dan `\int` mentah bocor ke murid), sedangkan
// `\leq5` cukup dengan angka di belakangnya. Yang tidak boleh cuma huruf lanjutan
// (`\inx` bukan `\in`).
const PERINTAH_SIMBOL: [string, string][] = [
  ['times', '×'], ['div', '÷'], ['cdot', '·'], ['pm', '±'], ['mp', '∓'],
  ['leq|le', '≤'], ['geq|ge', '≥'], ['neq|ne', '≠'], ['approx', '≈'],
  ['infty', '∞'], ['degree', '°'], ['angle', '∠'], ['triangle', '△'],
  ['parallel', '∥'], ['perp', '⊥'], ['rightarrow|to', '→'], ['leftarrow', '←'],
  ['Rightarrow', '⇒'], ['Leftarrow', '⇐'], ['Leftrightarrow', '⇔'], ['leftrightarrow', '↔'],
  ['in', '∈'], ['notin', '∉'], ['subseteq', '⊆'], ['subset', '⊂'], ['supset', '⊃'],
  ['cup', '∪'], ['cap', '∩'], ['emptyset|varnothing', '∅'], ['setminus', '∖'],
  ['sum|Sigma', 'Σ'], ['int', '∫'], ['prod', '∏'], ['pi', 'π'], ['theta', 'θ'], ['alpha', 'α'],
  ['beta', 'β'], ['gamma', 'γ'], ['delta', 'δ'], ['Delta', 'Δ'], ['lambda', 'λ'], ['Lambda', 'Λ'],
  ['mu', 'μ'], ['rho', 'ρ'], ['sigma', 'σ'], ['phi|varphi', 'φ'], ['omega', 'ω'], ['Omega', 'Ω'],
  ['epsilon|varepsilon', 'ε'], ['eta', 'η'], ['tau', 'τ'], ['psi', 'ψ'], ['xi', 'ξ'], ['zeta', 'ζ'], ['kappa', 'κ'],
  ['circ', '°'], ['cdots|ldots|dots', '…'], ['nabla', '∇'], ['partial', '∂'], ['forall', '∀'], ['exists', '∃'],
  ['therefore', '∴'], ['because', '∵'], ['neg', '¬'], ['land|wedge', '∧'], ['lor|vee', '∨'],
  ['ll', '≪'], ['gg', '≫'], ['sim', '∼'], ['cong', '≅'], ['equiv', '≡'], ['propto', '∝'], ['prime', '′'],
  ['sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|arcsin|arccos|arctan|log|ln|lim|max|min|det', '$&'],
]

const SIMBOL: [RegExp, string][] = [
  // '$&' = nama fungsi (sin, log, lim...): backslash-nya dibuang, hurufnya dipertahankan.
  ...PERINTAH_SIMBOL.map(([nama, ganti]): [RegExp, string] => ganti === '$&'
    ? [new RegExp(`\\\\(${nama})(?![A-Za-z])`, 'g'), '$1']
    : [new RegExp(`\\\\(?:${nama})(?![A-Za-z])`, 'g'), ganti]),
  [/\\%/g, '%'], [/\\\{/g, '{'], [/\\\}/g, '}'],
  [/\\left\s*|\\right\s*/g, ''], [/\\[,;:!]|\\q?quad(?![A-Za-z])/g, ' '],
  // Spasi LaTeX `\ ` (a\ \text{cm}) -- dulu meninggalkan garis miring mentah.
  [/\\ /g, ' '],
  [/\\(?:displaystyle|textstyle|scriptstyle)(?![A-Za-z])\s*/g, ''],
]

function bersihkanLatex(s: string): string {
  let t = s

  // \text{..}, \mathrm{..}, dst -> isinya saja.
  t = t.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf|mathtt|mathbb|mathcal|textbf|textit|textrm|boldsymbol|operatorname|overline|underline|vec|hat|bar|tilde)\s*\{([^{}]*)\}/g, '$1')

  // \frac & \sqrt butuh pembacaan kurung seimbang (argumen bisa bersarang), jadi
  // diproses berulang dari kemunculan PALING DALAM ke luar lewat rekursi isi.
  for (let aman = 0; aman < 50; aman++) {
    const m = /\\(d|t)?frac|\\sqrt/.exec(t)
    if (!m) break
    const mulai = m.index
    if (m[0].endsWith('frac')) {
      const a = bacaArgumen(t, mulai + m[0].length)
      const b = a && bacaArgumen(t, a.akhir)
      if (!a || !b) { t = t.slice(0, mulai) + t.slice(mulai + m[0].length); continue }
      const ganti = `${kurungi(bersihkanLatex(a.isi))}/${kurungi(bersihkanLatex(b.isi))}`
      t = t.slice(0, mulai) + ganti + t.slice(b.akhir)
    } else {
      let pos = mulai + m[0].length
      let akarKe = ''
      const opsional = /^\s*\[([^\]]*)\]/.exec(t.slice(pos))
      if (opsional) { akarKe = petakan(opsional[1], SUPER) ?? ''; pos += opsional[0].length }
      const a = bacaArgumen(t, pos)
      if (!a) { t = t.slice(0, mulai) + '√' + t.slice(pos); continue }
      t = t.slice(0, mulai) + `${akarKe}√${kurungi(bersihkanLatex(a.isi))}` + t.slice(a.akhir)
    }
  }

  // Derajat lebih dulu dari pangkat berkurawal: `^{\circ}` harus jadi °, bukan
  // pangkat dari simbol yang sudah terlanjur diganti.
  t = t.replace(/\^\s*\{\s*\\circ\s*\}|\^\s*\\circ(?![A-Za-z])/g, '°')

  for (const [pola, ganti] of SIMBOL) t = t.replace(pola, ganti)
  // Sisa \left( ... \right) meninggalkan spasi di dalam kurung.
  return t.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
}

/**
 * `pangkas = false` untuk POTONGAN teks (bagian di luar `$...$`): tanpa itu spasi
 * di tepi potongan ("Setelah " sebelum `$t$`) ikut terbuang dan kata menempel ke
 * rumusnya.
 */
export function rapikanNotasiMatematika(teks: string, pangkas = true): string {
  if (!teks) return teks
  let t = teks

  // Pembungkus rumus. `$...$` cuma dibuka kalau isinya memang berbau rumus --
  // "$5 dan $10" di soal ekonomi tidak boleh kehilangan tandanya. Satu huruf/nama
  // pendek ("Fungsi $W$") juga rumus: dulu lolos dan tanda `$`-nya tampil ke murid.
  t = t.replace(/\$\$([^$]+)\$\$/g, '$1')
  t = t.replace(/\$([^$\n]+)\$/g, (utuh, isi: string) =>
    /[\\^_{}]/.test(isi) || /^\p{L}[\p{L}\p{N}']{0,3}$/u.test(isi) ? isi : utuh)
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, '$1').replace(/\\\[([\s\S]*?)\\\]/g, '$1')

  if (t.includes('\\')) t = bersihkanLatex(t)

  // Pangkat & subskrip berkurawal -- di LUAR cabang LaTeX karena model juga menulis
  // `x^{m+n}` tanpa satu backslash pun.
  t = t.replace(/\^\s*\{([^{}]*)\}/g, (_, isi: string) => pangkat(isi))
  // Simbol operator besar (∫ Σ ∏) juga membawa batas: `\int_0^1` harus jadi ∫₀¹.
  t = t.replace(/(?<=[\p{L}\p{N})∫Σ∏])_\s*\{([^{}]*)\}/gu, (_, isi: string) => subskrip(isi))

  // Notasi gaya pemrograman / teks polos.
  // Pangkat tanpa kurawal: x^2, 10^-3, a^(m+n). Sengaja cuma SATU angka-berderet
  // atau SATU huruf -- "x^2y" hampir pasti berarti x²·y, bukan x pangkat "2y".
  t = t.replace(/\^\s*(\([^()]+\)|-?\d+|-?[A-Za-z])/g, (_, isi: string) =>
    pangkat(isi.startsWith('(') ? isi.slice(1, -1) : isi))
  // Subskrip rumus kimia/indeks: H_2O, x_1. Hanya setelah huruf/angka/kurung supaya
  // garis isian "____" tidak tersentuh.
  t = t.replace(/(?<=[A-Za-z0-9)∫Σ∏])_(\d+)/g, (_, isi: string) => subskrip(isi))
  t = t.replace(/\bsqrt\s*\(/g, '√(')
  t = t.replace(/(?<=[\d)])\s*\*\s*(?=[\d(])/g, ' × ')
  t = t.replace(/<=>/g, '⇔').replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/!=/g, '≠')

  t = t.replace(/[ \t]{2,}/g, ' ')
  return pangkas ? t.trim() : t
}

/**
 * Isi SATU rumus LaTeX (tanpa pembungkus `$`) -> teks Unicode satu baris, untuk
 * cadangan tampilan dan konteks teks murni. Lingkungan berbaris (aligned, cases,
 * matrix...) tidak bisa dipertahankan bentuknya: `\begin/\end` dibuang, `\\`
 * jadi pindah baris (blok) atau "; " (sebaris), dan `&` jadi spasi.
 */
export function latexKeUnicode(latex: string, blok = false): string {
  let t = latex
  t = t.replace(/\\begin\{[A-Za-z*]+\}(?:\{[^{}]*\})?/g, '').replace(/\\end\{[A-Za-z*]+\}/g, '')
  t = t.replace(/\s*\\\\(?:\[[^\]]*\])?\s*/g, blok ? '\n' : '; ')
  t = t.replace(/&/g, ' ')
  t = rapikanNotasiMatematika(t, false)
  // Baris kosong/sisa "; " di ujung akibat `\\` penutup lingkungan.
  return t.replace(/(?:;\s*)+$/, '').replace(/[ \t]*\n[ \t]*/g, '\n').trim()
}
