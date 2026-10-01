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

export function BarisTabel({ kolom, onClick, children }: { kolom: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`grid ${kolom} w-full items-center gap-x-4 px-6 min-h-17 text-left border-t border-garis-2 hover:bg-isian transition-colors`}>
      {children}
    </button>
  )
}
