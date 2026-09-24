import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import type { Formulir, Soal } from '../types'
import { HURUF_OPSI } from '../components/LayarMurid'
import { JUDUL_BAWAAN } from './soal'

// ─── Unduh formulir sebagai .docx ─────────────────────────────────────────────
// Murni klien (paket `docx`, di-pack ke Blob lewat Packer.toBlob) -- tidak ada
// Edge Function, tidak menyentuh server sama sekali. TANPA kunci jawaban
// (permintaan pemilik produk, 2026-09-23): berkasnya boleh langsung dibagikan
// apa adanya, bukan cuma buat arsip guru sendiri.

function namaBerkas(judul: string): string {
  const bersih = (judul.trim() || JUDUL_BAWAAN).replace(/[\\/:*?"<>|]/g, '-')
  return `${bersih}.docx`
}

export async function unduhFormulirDocx(formulir: Formulir, soal: Soal[]): Promise<void> {
  const paragraf: Paragraph[] = [
    new Paragraph({ text: formulir.judul.trim() || JUDUL_BAWAAN, heading: HeadingLevel.HEADING_1 }),
  ]

  const keterangan = [formulir.kelas.trim(), formulir.mapel.trim()].filter(Boolean).join(' · ')
  if (keterangan) {
    paragraf.push(new Paragraph({ children: [new TextRun({ text: keterangan, bold: true })], spacing: { after: 120 } }))
  }
  if (formulir.deskripsi.trim()) {
    paragraf.push(new Paragraph({ text: formulir.deskripsi.trim(), spacing: { after: 200 } }))
  }

  soal.forEach((s, i) => {
    paragraf.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}. ${s.pertanyaan.trim() || '(pertanyaan kosong)'}`, bold: true })],
      spacing: { before: 200 },
    }))
    s.pilihan.forEach((p, j) => {
      paragraf.push(new Paragraph({ text: `${HURUF_OPSI[j] ?? j + 1}. ${p.trim() || '(opsi kosong)'}`, indent: { left: 360 } }))
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
