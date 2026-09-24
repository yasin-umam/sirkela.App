// ─── Ikon garis, kosakata yang sama dengan Luang ─────────────────────────────
// SVG sebaris, bukan font ikon: font yang belum termuat menampilkan NAMA ikonnya
// ("delete", "content_copy") sebagai teks di tengah kartu.
//
// GARIS (`fill: none` + `stroke: currentColor`), bukan glif padat. Sebelum
// 2026-09-22 isinya path Material Icons yang padat, meniru Google Form; diganti
// saat aplikasi didesain ulang mengikuti Luang, yang memakai ikon garis
// (Heroicons outline) di seluruh layarnya. Mencampur keduanya terlihat seperti
// dua aplikasi yang ditempel jadi satu: glif padat selalu tampak lebih berat
// daripada tetangganya pada ukuran yang sama.
//
// Tebal garis mengikuti Luang: 1.5 untuk ikon yang sekadar menemani teks, 2
// untuk ikon yang berdiri sendiri sebagai tombol atau sedang aktif.

const PATH = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  tutup: 'M6 18L18 6M6 6l12 12',
  silang: 'M6 18L18 6M6 6l12 12',
  tambah: 'M12 4v16m8-8H4',
  tambahLingkar: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  impor: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3',
  // Dua cabang menyatu -- dipakai untuk "Impor soal" (menggabungkan soal dari
  // luar ke formulir yang sedang dibuka), beda dari `impor` (tray + panah turun)
  // yang dipakai di kartu ajakan Menu untuk arti "bawa dari luar" secara umum.
  gabung: ['M21 18a3 3 0 11-6 0 3 3 0 016 0z', 'M9 6a3 3 0 11-6 0 3 3 0 016 0z', 'M6 21V9a9 9 0 0 0 9 9'],
  hapus: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  duplikat: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  naik: 'M5 10l7-7m0 0l7 7m-7-7v18',
  turun: 'M19 14l-7 7m0 0l-7-7m7 7V3',
  lihat: ['M15 12a3 3 0 11-6 0 3 3 0 016 0z', 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'],
  centang: 'M5 13l4 4L19 7',
  centangLingkar: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  kunciJawaban: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-5 7l2 2 4-4',
  dokumen: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  soal: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  sesi: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  profil: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  // Ikon tab "Menu" -- path yang sama dengan BottomNav Luang.
  kisi: 'M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v7H4v-7zm9 0h7v7h-7v-7z',
  orang: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  awan: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.002 4.002 0 003 15z',
  awanSelesai: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  galat: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  kunci: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  kirim: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  tautan: 'M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m6.5-6.5l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0',
  qr: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
  bagikan: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  muatUlang: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  keluar: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  bawah: 'M19 9l-7 7-7-7',
  kanan: 'M9 5l7 7-7 7',
  kembali: 'M10 19l-7-7m0 0l7-7m-7 7h18',
  jam: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  pensil: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  setelan: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  perisai: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  surat: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  // Percikan -- kosakata "AI" yang sama dipakai UI lain (bukan chip/robot),
  // dipakai satu-satunya untuk Generate dari Topik supaya "ini yang mengarang
  // dari nol" gampang dibedakan sekilas dari ikon "impor" (baca dokumen).
  ai: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
  // Tiga titik -- garis nol-panjang + strokeLinecap round, trik yang sama
  // dipakai titik seru `galat` di atas.
  lainnya: 'M12 6h.01M12 12h.01M12 18h.01',
} satisfies Record<string, string | string[]>

export type NamaIkon = keyof typeof PATH

export function Ikon({ nama, className = 'w-6 h-6', tebal = 1.8 }: {
  nama: NamaIkon
  className?: string
  /** 1.5 = ikon pendamping teks · 2 = ikon yang berdiri sendiri / sedang aktif. */
  tebal?: number
}) {
  const d = PATH[nama]
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      {(Array.isArray(d) ? d : [d]).map(p => (
        <path key={p} d={p} strokeWidth={tebal} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** Tombol ikon persegi-bulat (area sentuh 40px), sama dengan tombol ikon Luang. */
export function TombolIkon({ nama, label, onClick, disabled, className = '', ukuran = 'w-5 h-5' }: {
  nama: NamaIkon
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  ukuran?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-all ${className}`}>
      <Ikon nama={nama} className={ukuran} />
    </button>
  )
}
