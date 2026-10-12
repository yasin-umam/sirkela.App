import { Document, ImageRun, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import type { Formulir, Soal } from '../types'
import { HURUF_OPSI } from '../components/Gelembung'
import { urlGambarSoal } from './gambarSoal'
import { JUDUL_BAWAAN, kelasJurusan } from './soal'
import { teksPolosSoal } from './teksMatematika'

// ─── Unduh formulir sebagai .docx ─────────────────────────────────────────────
// Murni klien (paket `docx`, di-pack ke Blob lewat Packer.toBlob) -- tidak ada
// Edge Function. Satu-satunya yang diambil dari jaringan adalah gambar soal
// (GET ke bucket publik), karena berkas .docx harus membawa gambarnya sendiri.
// TANPA kunci jawaban (permintaan pemilik produk, 2026-09-23): berkasnya boleh
// langsung dibagikan apa adanya, bukan cuma buat arsip guru sendiri.

/** Piksel pada 96 dpi; menjaga gambar tetap di dalam margin halaman A4 bawaan. */
const LEBAR_GAMBAR_MAKS = 420
const TINGGI_GAMBAR_MAKS = 520

function namaBerkas(judul: string): string {
  const bersih = (judul.trim() || JUDUL_BAWAAN).replace(/[\\/:*?"<>|]/g, '-')
  return `${bersih}.docx`
}

interface GambarTermuat { data: ArrayBuffer; lebar: number; tinggi: number }

/** null = gagal diambil/dibaca; satu gambar yang rusak tidak boleh menggagalkan seluruh unduhan. */
async function muatGambar(path: string): Promise<GambarTermuat | null> {
  try {
    const res = await fetch(urlGambarSoal(path))
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const { width: lebar, height: tinggi } = bitmap
    bitmap.close()
    return { data: await blob.arrayBuffer(), lebar, tinggi }
  } catch {
    return null
  }
}

export async function unduhFormulirDocx(formulir: Formulir, soal: Soal[]): Promise<void> {
  const gambar = await Promise.all(soal.map(s => s.gambar ? muatGambar(s.gambar) : null))

  const paragraf: Paragraph[] = [
    new Paragraph({ text: formulir.judul.trim() || JUDUL_BAWAAN, heading: HeadingLevel.HEADING_1 }),
  ]

  const keterangan = [kelasJurusan(formulir.kelas, formulir.jurusan), formulir.mapel.trim()].filter(Boolean).join(' · ')
  if (keterangan) {
    paragraf.push(new Paragraph({ children: [new TextRun({ text: keterangan, bold: true })], spacing: { after: 120 } }))
  }
  if (formulir.deskripsi.trim()) {
    paragraf.push(new Paragraph({ text: formulir.deskripsi.trim(), spacing: { after: 200 } }))
  }

  // Rumus LaTeX (lihat lib/teksMatematika.ts) diturunkan ke Unicode satu baris
  // di sini -- BUKAN persamaan Word asli (OMML). Dokumen .docx tetap terbaca,
  // cuma pecahan/akar tampil `a/b`/`√(...)` alih-alih bertingkat seperti di layar.
  soal.forEach((s, i) => {
    const pertanyaan = teksPolosSoal(s.pertanyaan).trim()
    paragraf.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}. ${pertanyaan || '(pertanyaan kosong)'}`, bold: true })],
      spacing: { before: 200 },
    }))
    if (s.gambar) {
      const g = gambar[i]
      if (g) {
        const skala = Math.min(1, LEBAR_GAMBAR_MAKS / g.lebar, TINGGI_GAMBAR_MAKS / g.tinggi)
        paragraf.push(new Paragraph({
          children: [new ImageRun({
            type: 'jpg',
            data: g.data,
            transformation: { width: Math.round(g.lebar * skala), height: Math.round(g.tinggi * skala) },
            altText: { name: `Gambar soal ${i + 1}`, description: `Gambar untuk soal nomor ${i + 1}` },
          })],
          indent: { left: 360 },
          spacing: { before: 80, after: 80 },
        }))
      } else {
        paragraf.push(new Paragraph({
          children: [new TextRun({ text: '[gambar tidak dapat dimuat]', italics: true })],
          indent: { left: 360 },
        }))
      }
    }
    s.pilihan.forEach((p, j) => {
      const opsi = teksPolosSoal(p).trim()
      paragraf.push(new Paragraph({ text: `${HURUF_OPSI[j] ?? j + 1}. ${opsi || '(opsi kosong)'}`, indent: { left: 360 } }))
    })
  })

  const dokumen = new Document({ sections: [{ children: paragraf }] })
  const blob = await Packer.toBlob(dokumen)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaBerkas(formulir.judul)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
