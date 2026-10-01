import { Ikon } from './ui/Ikon'

// ─── Gelembung jawaban ───────────────────────────────────────────────────────
// Inti bahasa desain "Lembar Jawab": huruf opsi dalam lingkaran, seperti lembar
// jawab komputer (LJK). Satu komponen dipakai di semua tempat opsi muncul --
// layar murid, kartu pertanyaan guru, tinjauan nilai -- supaya "B" yang dilihat
// murid, "B" yang ditandai guru sebagai kunci, dan "B" di tinjauan nilai adalah
// bentuk yang sama.
//
//   kosong  -- kontur abu, huruf
//   dipilih -- terisi biru (diarsir)
//   benar   -- terisi hijau + centang (kunci yang dijawab benar / kunci terpilih)
//   salah   -- kontur jingga + silang (jawaban murid yang salah)
//   kunci   -- kontur hijau + huruf (kunci yang TIDAK dipilih murid)
//
// benar/salah membawa IKON, bukan cuma hue: murid dan guru dengan buta warna
// merah-hijau tetap bisa membacanya.

export type StatusGelembung = 'kosong' | 'dipilih' | 'benar' | 'salah' | 'kunci'

export const HURUF_OPSI = 'ABCDEFGHIJ'

const UKURAN = {
  sm: { kotak: 'w-5.5 h-5.5 text-[10.5px]', ikon: 'w-3 h-3' },
  md: { kotak: 'w-6.5 h-6.5 text-xs', ikon: 'w-3.5 h-3.5' },
  lg: { kotak: 'w-7.5 h-7.5 text-[13px]', ikon: 'w-4 h-4' },
}

const GAYA: Record<StatusGelembung, string> = {
  kosong: 'border-pinggir text-tinta-2 bg-white',
  dipilih: 'border-biru bg-biru text-white',
  benar: 'border-hijau bg-hijau text-white',
  salah: 'border-jingga bg-white text-jingga',
  kunci: 'border-hijau bg-white text-hijau',
}

export function Gelembung({ indeks, status = 'kosong', ukuran = 'md' }: {
  /** Posisi opsi (0 = A). */
  indeks: number
  status?: StatusGelembung
  ukuran?: keyof typeof UKURAN
}) {
  const u = UKURAN[ukuran]
  return (
    <span className={`rounded-full border-2 shrink-0 flex items-center justify-center font-mono font-medium ${u.kotak} ${GAYA[status]}`}>
      {status === 'benar' ? <Ikon nama="centang" className={u.ikon} tebal={3.2} />
        : status === 'salah' ? <Ikon nama="tutup" className={u.ikon} tebal={3.2} />
        : HURUF_OPSI[indeks] ?? indeks + 1}
    </span>
  )
}
