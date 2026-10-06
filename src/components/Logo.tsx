import { NAMA_APLIKASI } from '../lib/aplikasi'
import logoSmk from '../assets/logo-smk.webp'

// ─── Lambang aplikasi ────────────────────────────────────────────────────────
// Logo resmi SMKN 2 Sungai Lilin (segi lima ungu), bukan lagi kotak navy bertulisan
// "SMKN 2" (sampai 2026-10-06). Berkasnya diimpor lewat Vite, jadi dapat nama ber-hash
// dan di-cache selamanya oleh browser.
//
// Latar putih bawaan JPEG-nya sudah dihapus (transparan), jadi cocok di sidebar putih
// maupun latar layar abu-abu. Tanpa kotak, tanpa `rounded-*` di pemanggil: sudut
// bulat memotong ujung-ujung segi limanya.
//
// Ganti logo = timpa `src/assets/logo-smk.webp`. Pakai latar transparan (atau putih
// bersih yang dihapus dulu) dan sisi yang kira-kira persegi; ia ditampilkan dengan
// `object-contain` di kotak w-x h-x milik pemanggil.

export function Lambang({ className = 'w-9 h-9' }: { className?: string }) {
  // alt kosong: namanya selalu tertulis di sebelahnya (Logo, sidebar, kepala Menu).
  return <img src={logoSmk} alt="" draggable={false} className={`shrink-0 object-contain select-none ${className}`} />
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
