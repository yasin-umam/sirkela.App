import type { ReactNode } from 'react'

// ─── Tabel desktop ───────────────────────────────────────────────────────────
// Kerangka tabel berbasis grid CSS (bukan <table>): barisnya TOMBOL utuh yang
// bisa ditekan, dan kolomnya ditentukan pemanggil lewat kelas `grid-cols-[...]`.
// Dipakai Riwayat dan layar Sesi (daftar sesi) -- hanya di desktop; HP memakai
// baris bertumpuk. Teks kepala kolom mengikuti gaya Eyebrow.

export function KepalaTabel({ kolom, judul }: { kolom: string; judul: string[] }) {
  return (
    <div className={`grid ${kolom} items-center gap-x-4 px-6 h-12`}>
      {judul.map((t, i) => (
        <span key={i} className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-teks-3">{t}</span>
      ))}
    </div>
  )
}

/**
 * `aksi`: tombol di ujung kanan baris (mis. hapus). Tombol tak boleh bersarang di dalam
 * tombol, jadi ia SAUDARA tombol baris yang ditaruh melayang di atas kolom terakhir --
 * pemanggil mengosongkan isi kolom itu (24px) untuk baris yang membawa aksi.
 */
export function BarisTabel({ kolom, onClick, children, aksi }: {
  kolom: string; onClick: () => void; children: ReactNode; aksi?: ReactNode
}) {
  const baris = (
    <button type="button" onClick={onClick}
      className={`grid ${kolom} w-full items-center gap-x-4 px-6 min-h-17 text-left border-t border-garis-2 hover:bg-isian transition-colors`}>
      {children}
    </button>
  )
  if (!aksi) return baris
  return (
    <div className="relative">
      {baris}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">{aksi}</div>
    </div>
  )
}
