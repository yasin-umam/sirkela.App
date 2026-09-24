import { NAMA_APLIKASI } from '../lib/aplikasi'

// ─── Lambang aplikasi ────────────────────────────────────────────────────────
// SVG sebaris, bukan berkas gambar: lambangnya cuma dua bentuk, dan sebagai
// berkas ia akan jadi satu request tambahan yang menahan layar pertama.
// Luang memakai logo gambar miliknya sendiri; aplikasi ini bukan Luang, jadi
// lambangnya dibuat sendiri -- yang disalin cuma bahasa warnanya (indigo).
//
// Bentuknya: tulisan "SMKN" di atas angka "2" -- lambang sekolah pemakai. Ditulis
// sebagai teks SVG (bukan teks HTML) supaya ikut mengecil/membesar bersama
// kotaknya di semua ukuran (w-7 di header, w-11 di pintu depan murid).

export function Lambang({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-200 ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" textAnchor="middle" className="w-4/5 h-4/5" aria-hidden>
        <text x="12" y="10.5" fontSize="6.6" fontWeight="800">SMKN</text>
        <text x="12" y="20.5" fontSize="11" fontWeight="800">2</text>
      </svg>
    </span>
  )
}

/** Lambang + nama, untuk kepala laman auth dan pintu depan murid. */
export function Logo({ ukuran = 'w-9 h-9', kelasTeks = 'text-lg' }: { ukuran?: string; kelasTeks?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Lambang className={ukuran} />
      <span className={`font-bold tracking-tight text-slate-800 ${kelasTeks}`}>{NAMA_APLIKASI}</span>
    </span>
  )
}
