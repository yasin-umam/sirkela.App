import type { IsiSoal } from '../types'
import { MAKS_PILIHAN } from './soal'

// ─── Tempel teks -> soal, TANPA Google (tidak ada OAuth, tidak ada API) ───────
// Satu-satunya cara impor dari Google Form di aplikasi ini: salin teks dari
// halaman RESPONDEN Google Form (Ctrl+A, Ctrl+C), tempel di satu kotak.
// Aturannya cuma satu -- soal dipisah BARIS KOSONG, baris pertama tiap blok =
// pertanyaan, sisanya = pilihan.
//
// Kunci jawaban TIDAK PERNAH ikut lewat cara ini: teks polos yang tersalin dari
// Google Form tidak pernah membawa info "ini yang benar" (itu ikon, bukan teks),
// baik dari halaman edit maupun responden. Guru menandainya sendiri di layar
// Tinjau (DialogImpor) lewat kartu soal yang sama seperti editor biasa.
//
// Parsernya sengaja sederhana (pisah baris kosong), bukan "pintar" menebak-nebak
// struktur -- hasil yang salah pisah tetap gampang dibetulkan di layar Tinjau
// karena kartunya bisa disunting, dihapus, dan ditambah manual.

export interface HasilTempel {
  soal: IsiSoal[]
  /** Blok yang tidak jadi soal (kurang dari 2 baris pilihan), dikelompokkan per alasan. */
  dilewati: { alasan: string; jumlah: number }[]
}

/**
 * Baris "sampah" baku Google Form yang ikut tersalin saat select-all (tombol,
 * footer, penanda wajib/poin) -- daftar terbaik-usaha, ID & EN, supaya tidak
 * nyasar jadi pertanyaan/opsi. Kalau ada yang lolos, tetap bisa dibetulkan di
 * layar Tinjau; daftar ini boleh ditambah begitu ada contoh nyata yang lolos.
 */
const BARIS_ABAIKAN: RegExp[] = [
  /^\*$/,
  /^(wajib diisi|required|this is a required question)\.?$/i,
  /^\d+\s*(poin|point)s?$/i,
  /^(bagian|section)\s+\d+\s+(dari|of)\s+\d+$/i,
  /^(kirim|submit|berikutnya|next|kembali|back|clear form|hapus formulir)$/i,
  /^(google formulir|google forms)$/i,
  /^jangan pernah mengirimkan sandi melalui google formulir\.?$/i,
  /^never submit passwords through google forms\.?$/i,
  /^konten ini tidak dibuat (atau|maupun) didukung oleh google\.?$/i,
  /^this content is neither created nor endorsed by google\.?$/i,
  /^formulir ini dibuat di dalam .+\.?$/i,
  /^this form was created (inside|within) .+\.?$/i,
  /^(laporkan penyalahgunaan|report abuse)$/i,
  /^(persyaratan layanan|terms of service)$/i,
  /^(kebijakan privasi|privacy policy)$/i,
  /^(masuk ke google untuk menyimpan kemajuan anda|sign in to google to save your progress)\b.*$/i,
  /^(lihat skor anda setelah mengirim|view score after submission)$/i,
]

export function uraikanTempelan(teks: string): HasilTempel {
  const baris = teks
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(b => b.trim())
    .filter(b => !BARIS_ABAIKAN.some(re => re.test(b)))

  // Kelompokkan baris NON-KOSONG yang berurutan jadi satu blok.
  const blok: string[][] = []
  let sekarang: string[] = []
  for (const b of baris) {
    if (b === '') {
      if (sekarang.length) { blok.push(sekarang); sekarang = [] }
    } else {
      sekarang.push(b)
    }
  }
  if (sekarang.length) blok.push(sekarang)

  const soal: IsiSoal[] = []
  const dilewati = new Map<string, number>()
  const lewati = (alasan: string) => dilewati.set(alasan, (dilewati.get(alasan) ?? 0) + 1)

  for (const b of blok) {
    const [pertanyaan, ...pilihan] = b
    if (pilihan.length < 2) { lewati('kurang dari 2 opsi'); continue }
    soal.push({ pertanyaan, pilihan: pilihan.slice(0, MAKS_PILIHAN), jawabanBenar: null })
  }

  return { soal, dilewati: [...dilewati].map(([alasan, jumlah]) => ({ alasan, jumlah })) }
}
