import type { ReactNode } from 'react'

// ─── Lapis kendali mengambang, sejajar KARTU (bukan jendela) ─────────────────
// `fixed` polos (mis. `fixed bottom-4 right-4`) menempel ke tepi JENDELA
// browser, sementara <body> dibatasi `max-width: 430px; margin: 0 auto` di layar
// sempit (index.css). Di viewport yang sedikit lebih lebar dari kartunya,
// kendali polos itu nongol DI LUAR kartu.
//
// Baris di dalam meniru aturan body itu (`max-w-107.5 desktop:max-w-none
// mx-auto`, breakpoint `desktop:` = 440px) supaya tepi kanannya PERSIS tepi
// kanan kartu yang terlihat.
//
// `pointer-events-none` di lapis luar supaya area kosong tidak memblokir ketukan
// ke konten di baliknya; anak yang bisa disentuh WAJIB `pointer-events-auto`.
export function LapisMengambang({ posisi, children }: {
  /** Kelas positioning untuk lapis `fixed`-nya, mis. `'inset-x-0 bottom-4'`. */
  posisi: string
  children: ReactNode
}) {
  return (
    <div className={`fixed z-30 pointer-events-none ${posisi}`}>
      <div className="max-w-107.5 desktop:max-w-none mx-auto px-4 flex justify-end">
        {children}
      </div>
    </div>
  )
}
