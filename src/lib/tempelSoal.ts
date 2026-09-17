import type { IsiSoal } from '../types'
import { MAKS_PILIHAN } from './soal'

// ─── Tempel teks -> soal, TANPA Google (tidak ada OAuth, tidak ada API) ───────
// Satu-satunya cara impor dari Google Form di aplikasi ini: salin teks dari
// halaman RESPONDEN Google Form (Ctrl+A, Ctrl+C) -- atau tempel soal bergaya
// dokumen/Word/PDF yang sudah bernomor -- lalu tempel di satu kotak.
//
// Kunci jawaban TIDAK PERNAH ikut lewat cara ini: teks polos yang tersalin dari
// Google Form tidak pernah membawa info "ini yang benar" (itu ikon, bukan teks),
// baik dari halaman edit maupun responden. Guru menandainya sendiri di layar
// Tinjau (DialogImpor) lewat kartu soal yang sama seperti editor biasa -- yang
// karenanya juga jadi jaring pengaman kalau pemisahan di bawah ini meleset.
//
// Dua GAYA pemisah, dipilih otomatis dari isi teksnya:
//   bernomor    -- ada baris berawalan "1." / "2)" dst. Pemisah soalnya baris
//                  bernomor itu SENDIRI, bukan baris kosong -- gaya dokumen
//                  sering punya baris kosong di ANTARA pertanyaan dan opsinya
//                  ("1. Soal?\n\nA. Opsi"), jadi baris kosong tidak boleh
//                  dipakai sebagai pemisah di gaya ini atau soal & opsi
//                  pertamanya kepisah jadi dua blok.
//   baris kosong -- bawaan (tanpa nomor sama sekali, gaya paste Google Form
//                  polos): baris pertama tiap blok = pertanyaan, sisanya = opsi.
// Awalan "A. " / "b) " di opsi selalu dibuang di kedua gaya -- tampilan murid
// memang tanpa huruf (lihat FormulirResponden), jadi teks yang tersimpan pun
// tanpa huruf.

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

/** "1. ", "2) " -- nomor soal gaya dokumen. */
const AWALAN_NOMOR = /^\d{1,3}[.)]\s+/
/** "A. ", "b) " -- label opsi gaya dokumen, dibuang (murid tidak melihat huruf). */
const AWALAN_HURUF = /^[A-Za-z][.)]\s+/

function kelompokkanBernomor(baris: string[]): string[][] {
  const blok: string[][] = []
  let sekarang: string[] | null = null
  for (const b of baris) {
    if (b === '') continue // baris kosong BUKAN pemisah di gaya ini
    if (AWALAN_NOMOR.test(b)) {
      if (sekarang) blok.push(sekarang)
      sekarang = [b]
    } else if (sekarang) {
      sekarang.push(b)
    }
    // baris sebelum nomor pertama (judul formulir dsb.) diabaikan
  }
  if (sekarang) blok.push(sekarang)
  return blok
}

function kelompokkanBarisKosong(baris: string[]): string[][] {
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
  return blok
}

export function uraikanTempelan(teks: string): HasilTempel {
  const baris = teks
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(b => b.trim())
    .filter(b => !BARIS_ABAIKAN.some(re => re.test(b)))

  const bernomor = baris.some(b => AWALAN_NOMOR.test(b))
  const blok = bernomor ? kelompokkanBernomor(baris) : kelompokkanBarisKosong(baris)

  const soal: IsiSoal[] = []
  const dilewati = new Map<string, number>()
  const lewati = (alasan: string) => dilewati.set(alasan, (dilewati.get(alasan) ?? 0) + 1)

  for (const b of blok) {
    const [pertanyaanMentah, ...pilihanMentah] = b
    if (pilihanMentah.length < 2) { lewati('kurang dari 2 opsi'); continue }
    soal.push({
      pertanyaan: pertanyaanMentah.replace(AWALAN_NOMOR, '').trim(),
      pilihan: pilihanMentah.slice(0, MAKS_PILIHAN).map(p => p.replace(AWALAN_HURUF, '').trim()),
      jawabanBenar: null,
    })
  }

  return { soal, dilewati: [...dilewati].map(([alasan, jumlah]) => ({ alasan, jumlah })) }
}
