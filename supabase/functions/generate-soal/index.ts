import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Generate dari topik -> soal lewat AI (OpenRouter, Claude Haiku) ─────────
// Ditambahkan 2026-09-22 atas permintaan eksplisit: guru menulis topik/materi,
// AI MENGARANG soal pilihan ganda dari nol -- BEDA dari impor-pdf yang cuma
// MEMBACA dokumen yang guru sudah punya. Lihat "Generate dari Topik (AI)" di
// CLAUDE.md untuk kenapa ini sebelumnya sengaja tidak ikut disalin dari Luang,
// dan kenapa sekarang ditambahkan tanpa kredit/billing Luang.
//
// Struktur berkas ini SENGAJA sedekat mungkin dengan impor-pdf/index.ts: sama
// pola tool-call-dipaksa, sama pola validasi longgar di server, sama bentuk
// balikan (HasilTempel) -- supaya keduanya gampang dibandingkan & dirawat
// bersamaan kalau salah satu berubah.

const MODEL = 'anthropic/claude-haiku-4.5'
const MAKS_PILIHAN = 10 // cermin src/lib/soal.ts (MAKS_PILIHAN)
const MAKS_JUMLAH_SOAL = 20 // cermin MAKS_JUMLAH_SOAL di src/lib/generateSoal.ts
const MAKS_PANJANG_TOPIK = 500 // karakter -- cukup untuk beberapa kalimat materi, bukan tempelan dokumen utuh

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
    description: 'Catat daftar soal pilihan ganda yang baru dikarang, sesuai topik dan jumlah yang diminta.',
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
                description: 'Empat opsi jawaban, tanpa label huruf di depannya ("A.", "b)"). Persis satu yang benar.',
              },
              kunciIndex: {
                type: 'integer',
                description: 'Indeks (mulai dari 0) opsi yang benar. WAJIB diisi dan benar-benar tepat -- kamu yang mengarang soal ini, jadi kamu yang menentukan jawabannya, bukan menebak dari dokumen orang lain.',
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

function buatPrompt(topik: string, jumlah: number, kesulitan: string): string {
  return `Buat ${jumlah} soal pilihan ganda tingkat kesulitan ${kesulitan} tentang materi berikut, untuk murid ` +
    `Indonesia:\n\n"${topik}"\n\nTiap soal WAJIB punya persis 4 opsi jawaban, hanya SATU yang benar, dan opsi ` +
    `pengecoh harus masuk akal (bukan jawaban yang jelas salah). Periksa ulang hitungan/faktanya sebelum ` +
    `menjawab -- kunci yang salah membingungkan murid dan membuat guru kehilangan kepercayaan. Tulis dalam ` +
    `Bahasa Indonesia. Lalu panggil catat_soal dengan hasilnya.`
}

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
  if (errGuru || !guru) return json({ error: 'Hanya guru yang bisa generate soal' }, 403)

  let body: { topik?: string; jumlah?: number; kesulitan?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Permintaan tidak valid' }, 400)
  }

  const topik = typeof body.topik === 'string' ? body.topik.trim() : ''
  if (!topik) return json({ error: 'Topik tidak boleh kosong' }, 400)
  if (topik.length > MAKS_PANJANG_TOPIK) {
    return json({ error: `Topik terlalu panjang (maksimal ${MAKS_PANJANG_TOPIK} karakter)` }, 400)
  }

  const jumlahMentah = body.jumlah
  const jumlah = typeof jumlahMentah === 'number' && Number.isInteger(jumlahMentah)
    ? Math.min(Math.max(jumlahMentah, 1), MAKS_JUMLAH_SOAL)
    : 5

  const kesulitan = (['mudah', 'sedang', 'sulit'] as const).includes(body.kesulitan as 'mudah' | 'sedang' | 'sulit')
    ? body.kesulitan!
    : 'sedang'

  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!openrouterKey) return json({ error: 'Server belum disetel untuk generate soal' }, 500)

  let aiRes: Response
  try {
    aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: buatPrompt(topik, jumlah, kesulitan) }],
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

  // Validasi longgar di server -- jangan percaya keluaran AI mentah-mentah,
  // sama seperti impor-pdf. Beda dari sana, kunciIndex DIWAJIBKAN di prompt
  // (AI mengarang jawabannya sendiri, bukan menebak dari dokumen), tapi tetap
  // di-clamp ke rentang opsi di sini -- guru masih WAJIB memeriksanya sendiri
  // di layar Tinjau sebelum Impor (lihat pesan klien di DialogImpor).
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
    return json({ error: 'AI tidak menghasilkan soal yang valid, coba topik lain atau ulangi' }, 422)
  }

  return json({
    soal,
    dilewati: dilewati > 0 ? [{ alasan: 'ditulis AI dengan bentuk tidak valid', jumlah: dilewati }] : [],
  })
})
