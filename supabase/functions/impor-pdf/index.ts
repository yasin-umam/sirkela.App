import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Impor PDF -> soal lewat AI (OpenRouter, Claude Haiku) ───────────────────
// Guru mengunggah PDF (ekspor Microsoft 365, Google Form, atau dokumen soal
// apa pun); Haiku membaca PDF-nya LANGSUNG (dukungan dokumen native di model,
// tanpa OCR terpisah -- lihat MODEL & fetch ke OpenRouter di bawah) dan
// mengembalikan daftar soal lewat tool call, supaya bentuknya selalu JSON
// valid alih-alih berharap model menulis JSON mentah dengan benar.
//
// Kunci API OpenRouter cuma hidup di sini (secret server via `supabase
// secrets set OPENROUTER_API_KEY=...`), TIDAK PERNAH ke klien.
//
// Kunci jawaban dari AI cuma TEBAKAN, bukan sumber kebenaran -- sama seperti
// tempelSoal.ts di klien, guru WAJIB meninjau & menandai kunci sendiri di
// layar Tinjau (DialogImpor) sebelum Impor. Makanya validasi di sini longgar
// (skip blok yang jelas rusak, tapi tidak berusaha "membetulkan" isinya).

const MODEL = 'anthropic/claude-haiku-4.5'
const MAKS_PILIHAN = 10 // cermin src/lib/soal.ts (MAKS_PILIHAN) -- ubah keduanya bersamaan
const MAKS_BYTE_PDF = 15_000_000 // ~15 MB, cermin MAKS_BYTE_PDF di src/lib/imporPdf.ts

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const ALAT_CATAT_SOAL = {
  type: 'function',
  function: {
    name: 'catat_soal',
    description: 'Catat daftar soal pilihan ganda yang berhasil dibaca dari dokumen, urut sesuai dokumen.',
    parameters: {
      type: 'object',
      properties: {
        soal: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pertanyaan: { type: 'string', description: 'Teks pertanyaan, tanpa nomor urut di depannya.' },
              pilihan: {
                type: 'array',
                items: { type: 'string' },
                description: 'Teks tiap opsi jawaban, tanpa label huruf di depannya ("A.", "b)").',
              },
              kunciIndex: {
                type: 'integer',
                description: 'Indeks (mulai dari 0) opsi yang benar, HANYA kalau kuncinya benar-benar terlihat di dokumen ini (ditandai tebal/warna/centang, atau ada lampiran kunci jawaban terpisah). Isi -1 kalau tidak yakin -- jangan menebak.',
              },
            },
            required: ['pertanyaan', 'pilihan', 'kunciIndex'],
          },
        },
      },
      required: ['soal'],
    },
  },
} as const

const PROMPT = 'Dokumen ini berisi soal pilihan ganda -- bisa jadi hasil ekspor Google Form, Microsoft Forms/Word, ' +
  'atau dokumen soal biasa. Baca SEMUA soal beserta pilihannya, urut sesuai dokumen. Buang nomor urut ("1.", "2)"), ' +
  'label huruf opsi ("A.", "b)"), dan teks yang bukan bagian soal (judul formulir, footer, tombol, penanda ' +
  'wajib/poin). Kalau satu blok kurang dari 2 pilihan yang jelas, lewati blok itu saja. Lalu panggil catat_soal ' +
  'dengan hasilnya.'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Belum masuk' }, 401)

  // Peran dicek lewat RPC yang SAMA dengan RLS (public.adalah_guru()), bukan
  // diturunkan ulang di sini -- satu sumber kebenaran untuk "siapa guru" (M1/M2).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: guru, error: errGuru } = await supabase.rpc('adalah_guru')
  if (errGuru || !guru) return json({ error: 'Hanya guru yang bisa mengimpor soal' }, 403)

  let body: { filename?: string; fileData?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Permintaan tidak valid' }, 400)
  }

  const fileData = body.fileData
  if (typeof fileData !== 'string' || !fileData.startsWith('data:application/pdf;base64,')) {
    return json({ error: 'Berkas harus PDF' }, 400)
  }
  const base64 = fileData.slice('data:application/pdf;base64,'.length)
  if (base64.length * 0.75 > MAKS_BYTE_PDF) {
    return json({ error: 'PDF terlalu besar (maksimal 15 MB)' }, 400)
  }

  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!openrouterKey) return json({ error: 'Server belum disetel untuk impor PDF' }, 500)

  let aiRes: Response
  try {
    aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'file', file: { filename: body.filename || 'soal.pdf', file_data: fileData } },
          ],
        }],
        tools: [ALAT_CATAT_SOAL],
        tool_choice: { type: 'function', function: { name: 'catat_soal' } },
      }),
    })
  } catch {
    return json({ error: 'Gagal menghubungi layanan AI, coba lagi' }, 502)
  }

  if (!aiRes.ok) {
    return json({ error: `Layanan AI menolak permintaan (${aiRes.status})` }, 502)
  }

  const aiJson = await aiRes.json()
  const argsRaw = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (typeof argsRaw !== 'string') {
    return json({ error: 'AI tidak mengembalikan hasil yang bisa dibaca, coba lagi' }, 502)
  }

  let parsed: { soal?: unknown }
  try {
    parsed = JSON.parse(argsRaw)
  } catch {
    return json({ error: 'AI tidak mengembalikan hasil yang bisa dibaca, coba lagi' }, 502)
  }

  const mentah = Array.isArray(parsed.soal) ? parsed.soal : []
  const soal: { pertanyaan: string; pilihan: string[]; jawabanBenar: number | null }[] = []
  let dilewati = 0

  for (const s of mentah) {
    if (!s || typeof s !== 'object') { dilewati++; continue }
    const rec = s as Record<string, unknown>
    const pertanyaan = typeof rec.pertanyaan === 'string' ? rec.pertanyaan.trim() : ''
    const pilihanMentah = Array.isArray(rec.pilihan) ? rec.pilihan : []
    const pilihan = pilihanMentah
      .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      .map(p => p.trim())
      .slice(0, MAKS_PILIHAN)
    if (!pertanyaan || pilihan.length < 2) { dilewati++; continue }
    const kunciMentah = rec.kunciIndex
    const jawabanBenar = typeof kunciMentah === 'number' && Number.isInteger(kunciMentah) &&
      kunciMentah >= 0 && kunciMentah < pilihan.length ? kunciMentah : null
    soal.push({ pertanyaan, pilihan, jawabanBenar })
  }

  if (soal.length === 0) {
    return json({ error: 'Tidak ada soal yang terbaca dari PDF ini' }, 422)
  }

  return json({
    soal,
    dilewati: dilewati > 0 ? [{ alasan: 'tidak terbaca jelas oleh AI', jumlah: dilewati }] : [],
  })
})
