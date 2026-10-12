import { Fragment, useMemo } from 'react'
import { pecahSegmen, teksPolosSoal, type Segmen } from '../lib/teksMatematika'
import { latexKeUnicode } from '../lib/notasiMatematika'
import { useKatex, OPSI_KATEX, type Katex } from '../lib/katexMuat'

// ─── SATU-SATUNYA jalan soal tampil ke mata orang ────────────────────────────
// Semua layar yang menampilkan pertanyaan atau pilihan jawaban WAJIB lewat sini
// (KartuSoalMurid di LayarMurid.tsx -- dipakai murid DAN pratinjau guru --,
// KartuPertanyaan di mode diam/kunci, LihatJawaban). Itu bukan gaya kode, itu
// pagar: soal disimpan sebagai LaTeX di dalam `$...$`, dan layar yang menulis
// `{soal.pertanyaan}` langsung akan menampilkan `$\dfrac{a}{b}$` mentah ke murid.
//
// Tiga keadaan, semuanya aman:
//   - tanpa rumus      -> teks biasa; KaTeX tidak pernah dimuat.
//   - KaTeX belum ada  -> cadangan Unicode satu baris (teksPolosSoal), lalu
//                         berganti begitu KaTeX termuat. Tidak pernah LaTeX mentah.
//   - KaTeX ada        -> rumus bertipografi.
// Baris baru di teks dipertahankan (`whitespace-pre-line`): tanpa itu `\n` di
// pertanyaan berbaris banyak menyatu jadi satu baris.
//
// `besar`: rumus sebaris dirender bergaya BLOK (`\displaystyle`) -- pecahan dan
// batas sigma/integral berukuran penuh seperti pilihan jawaban di buku, bukan
// diperkecil seperti di tengah kalimat. Dipakai untuk pilihan jawaban.

function Rumus({ k, s, besar }: { k: Katex; s: Segmen; besar: boolean }) {
  const blok = s.jenis === 'blok'
  const html = useMemo(() => {
    try {
      const isi = besar && !blok ? `\\displaystyle ${s.isi}` : s.isi
      return k.renderToString(isi, { ...OPSI_KATEX, displayMode: blok })
    } catch {
      return null // mis. makro yang meledak (maxExpand) -- jatuh ke teks polos
    }
  }, [k, s.isi, blok, besar])

  if (html == null) return <span>{latexKeUnicode(s.isi, blok)}</span>
  // Rumus blok yang lebih lebar dari layar digeser ke samping DI DALAM kotaknya --
  // KaTeX tidak memecah rumus panjang otomatis, dan tanpa ini halaman ikut melebar.
  return blok
    ? <span className="block max-w-full overflow-x-auto overflow-y-hidden" dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />
}

export function TeksSoal({ teks, besar = false, className = '' }: {
  teks: string | null | undefined
  besar?: boolean
  className?: string
}) {
  const nilai = teks ?? ''
  const segmen = useMemo(() => {
    const s = pecahSegmen(nilai)
    // Satu baris baru di sebelah rumus blok tidak perlu jadi baris kosong.
    return s.map((seg, i) => {
      if (seg.jenis !== 'teks') return seg
      let isi = seg.isi
      if (s[i - 1]?.jenis === 'blok') isi = isi.replace(/^\n/, '')
      if (s[i + 1]?.jenis === 'blok') isi = isi.replace(/\n$/, '')
      return { ...seg, isi }
    })
  }, [nilai])
  const adaRumus = segmen.some(s => s.jenis !== 'teks')
  const k = useKatex(adaRumus)
  const kelas = `whitespace-pre-line ${className}`.trim()

  if (!adaRumus) return <span className={kelas}>{segmen[0]?.isi ?? ''}</span>
  if (!k) return <span className={kelas}>{teksPolosSoal(nilai)}</span>
  return (
    <span className={kelas}>
      {segmen.map((s, i) => s.jenis === 'teks'
        ? <Fragment key={i}>{s.isi}</Fragment>
        : <Rumus key={i} k={k} s={s} besar={besar} />)}
    </span>
  )
}
