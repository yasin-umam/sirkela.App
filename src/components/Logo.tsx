import { NAMA_APLIKASI } from '../lib/aplikasi'

// ─── Lambang aplikasi ────────────────────────────────────────────────────────
// SVG sebaris, bukan berkas gambar: lambangnya cuma dua bentuk, dan sebagai
// berkas ia akan jadi satu request tambahan yang menahan layar pertama.
//
// Bentuknya: tulisan "SMKN" di atas angka "2" -- lambang sekolah pemakai. Ditulis
// sebagai teks SVG (bukan teks HTML) supaya ikut mengecil/membesar bersama
// kotaknya di semua ukuran (w-7 di header, w-11 di pintu depan murid). Kotaknya
// tinta navy datar -- warna kartu gelap di seluruh aplikasi.

export function Lambang({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-tinta text-white ${className}`}>
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
      <span className={`font-bold tracking-tight text-tinta ${kelasTeks}`}>{NAMA_APLIKASI}</span>
    </span>
  )
}
