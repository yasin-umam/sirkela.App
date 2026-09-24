import { NAMA_APLIKASI } from '../lib/aplikasi'

// ─── Lambang aplikasi ────────────────────────────────────────────────────────
// SVG sebaris, bukan berkas gambar: lambangnya cuma dua bentuk, dan sebagai
// berkas ia akan jadi satu request tambahan yang menahan layar pertama.
// Luang memakai logo gambar miliknya sendiri; aplikasi ini bukan Luang, jadi
// lambangnya dibuat sendiri -- yang disalin cuma bahasa warnanya (indigo).
//
// Bentuknya: lembar soal dengan satu centang. Dua hal yang memang dikerjakan
// aplikasi ini, dan tidak ada yang lain.

export function Lambang({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-200 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3/5 h-3/5" aria-hidden>
        <path d="M7 4h7.5L19 8.5V19a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 016 19V5.5A1.5 1.5 0 017.5 4z"
          strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M9 13.2l2 2 4-4.2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
