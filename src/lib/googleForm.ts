import type { IsiSoal } from '../types'

// ─── Impor dari Google Form lewat Forms API ───────────────────────────────────
// Kunci jawaban kuis TIDAK ada di halaman publik formulir; satu-satunya jalan
// membacanya dari browser adalah Forms API dengan token OAuth akun yang punya
// akses EDIT ke formulir itu. Token diminta lewat Google Identity Services
// (popup), hanya dengan scope baca, dan hanya hidup di memori tab ini.
//
// Tidak ada server di tengah: forms.googleapis.com mengizinkan CORS, jadi
// token tidak pernah melewati Supabase.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/forms.body.readonly'

/** false = VITE_GOOGLE_CLIENT_ID belum diisi; layar impor menjelaskan setup-nya. */
export const imporGoogleTersedia = !!CLIENT_ID

// ─── Google Identity Services (bentuk minimal yang dipakai) ──────────────────

interface JawabanToken {
  access_token?: string
  expires_in?: number
  error?: string
}
interface KlienToken {
  requestAccessToken: () => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (r: JawabanToken) => void
            error_callback?: (e: { type: string }) => void
          }) => KlienToken
          hasGrantedAllScopes: (r: JawabanToken, ...scopes: string[]) => boolean
        }
      }
    }
  }
}

let muatSkrip: Promise<void> | null = null
let klien: KlienToken | null = null
let token: { nilai: string; kedaluwarsa: number } | null = null
let menunggu: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null

function selesaikanTunggu(hasil: { token: string } | { galat: string }) {
  const t = menunggu
  menunggu = null
  if (!t) return
  if ('token' in hasil) t.resolve(hasil.token)
  else t.reject(new Error(hasil.galat))
}

/**
 * Dipanggil saat layar impor DIBUKA, bukan saat tombol ditekan: popup login
 * hanya boleh dibuka langsung dari gestur, dan skrip yang baru dimuat setelah
 * klik membuat popup-nya diblokir browser.
 */
export async function siapkanGoogle(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Impor Google Form belum dikonfigurasi (VITE_GOOGLE_CLIENT_ID kosong).')
  if (!muatSkrip) {
    muatSkrip = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { muatSkrip = null; reject(new Error('Gagal memuat layanan Google. Periksa koneksi.')) }
      document.head.appendChild(s)
    })
  }
  await muatSkrip
  if (klien || !window.google) return
  klien = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: r => {
      if (r.error || !r.access_token) {
        selesaikanTunggu({ galat: 'Login Google gagal. Coba lagi.' })
        return
      }
      // Layar izin Google membiarkan pengguna MENCENTANG-LEPAS scope. Tanpa
      // pemeriksaan ini kegagalannya baru muncul sebagai 403 yang membingungkan.
      if (!window.google!.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) {
        selesaikanTunggu({ galat: 'Izin membaca Google Form tidak diberikan. Coba lagi dan centang izinnya.' })
        return
      }
      // Dikurangi semenit supaya token tidak kedaluwarsa di tengah permintaan.
      token = { nilai: r.access_token, kedaluwarsa: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 }
      selesaikanTunggu({ token: r.access_token })
    },
    error_callback: e => {
      selesaikanTunggu({
        galat: e.type === 'popup_closed' ? 'Login Google dibatalkan.'
          : e.type === 'popup_failed_to_open' ? 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'
          : 'Login Google gagal. Coba lagi.',
      })
    },
  })
}

/** HARUS dipanggil langsung dari handler klik, tanpa `await` apa pun sebelumnya. */
export function mintaTokenGoogle(): Promise<string> {
  if (token && Date.now() < token.kedaluwarsa) return Promise.resolve(token.nilai)
  if (!klien) return Promise.reject(new Error('Layanan Google belum siap. Tunggu sebentar lalu coba lagi.'))
  return new Promise((resolve, reject) => {
    selesaikanTunggu({ galat: 'Dibatalkan' })
    menunggu = { resolve, reject }
    klien!.requestAccessToken()
  })
}

// ─── Link -> formId ──────────────────────────────────────────────────────────

/**
 * Forms API hanya menerima id dari link EDIT (…/forms/d/<id>/edit). Link untuk
 * responden (…/forms/d/e/<id>/viewform, forms.gle) memakai id lain yang ditolak
 * API dengan 404 -- ditangkap di sini dengan penjelasan, bukan dilempar ke API.
 */
export function ekstrakIdFormulir(teks: string): { id: string } | { galat: string } {
  const t = teks.trim()
  if (!t) return { galat: 'Tempel link formulirnya dulu.' }
  if (/forms\.gle\//i.test(t) || /\/forms\/d\/e\//i.test(t)) {
    return { galat: 'Itu link untuk responden. Buka formulirnya di Google Forms, lalu salin link dari address bar halaman EDIT (…/forms/d/…/edit).' }
  }
  const m = t.match(/\/forms\/d\/([a-zA-Z0-9_-]{20,})/)
  if (m) return { id: m[1] }
  if (/^[a-zA-Z0-9_-]{30,}$/.test(t)) return { id: t }
  return { galat: 'Link tidak dikenali. Tempel link dari halaman edit Google Form.' }
}

// ─── Ambil & terjemahkan ─────────────────────────────────────────────────────

export interface HasilImpor {
  formId: string
  judul: string
  deskripsi: string
  soal: IsiSoal[]
  /** Item yang tidak bisa jadi soal pilihan ganda, dikelompokkan per alasan. */
  dilewati: { alasan: string; jumlah: number }[]
  /** Soal pilihan ganda tanpa kunci (formulirnya bukan kuis, atau kunci belum diisi). */
  tanpaKunci: number
  /** Soal yang punya gambar -- gambarnya tidak ikut, teksnya ikut. */
  bergambar: number
}

interface OpsiGForm { value?: string; isOther?: boolean; image?: unknown }
interface ItemGForm {
  title?: string
  description?: string
  questionItem?: {
    image?: unknown
    question?: {
      choiceQuestion?: { type?: string; options?: OpsiGForm[] }
      grading?: { correctAnswers?: { answers?: { value?: string }[] } }
      textQuestion?: unknown
      scaleQuestion?: unknown
      dateQuestion?: unknown
      timeQuestion?: unknown
      fileUploadQuestion?: unknown
      ratingQuestion?: unknown
    }
  }
  questionGroupItem?: unknown
}
interface FormGForm {
  formId: string
  info?: { title?: string; documentTitle?: string; description?: string }
  items?: ItemGForm[]
}

export async function ambilGoogleForm(formId: string, tokenAkses: string): Promise<HasilImpor> {
  let res: Response
  try {
    res = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, {
      headers: { Authorization: `Bearer ${tokenAkses}` },
    })
  } catch {
    throw new Error('Tidak ada koneksi. Coba lagi.')
  }

  if (!res.ok) {
    const pesan = await res.json().then((b: { error?: { message?: string } }) => b.error?.message ?? '').catch(() => '')
    if (res.status === 401) {
      token = null
      throw new Error('Login Google sudah habis. Tekan Lanjut sekali lagi.')
    }
    if (res.status === 403 && /has not been used|is disabled|not enabled/i.test(pesan)) {
      throw new Error('Google Forms API belum diaktifkan di project Google Cloud aplikasi ini.')
    }
    if (res.status === 403) {
      throw new Error('Akun Google ini tidak punya akses edit ke formulir tersebut. Login dengan akun pemilik atau kolaboratornya.')
    }
    if (res.status === 404) throw new Error('Formulir tidak ditemukan. Pastikan link dari halaman edit formulir.')
    throw new Error(pesan || `Gagal membaca formulir (${res.status}).`)
  }

  return terjemahkan(await res.json() as FormGForm)
}

function terjemahkan(form: FormGForm): HasilImpor {
  const soal: IsiSoal[] = []
  const dilewati = new Map<string, number>()
  const lewati = (alasan: string) => dilewati.set(alasan, (dilewati.get(alasan) ?? 0) + 1)
  let tanpaKunci = 0
  let bergambar = 0

  for (const item of form.items ?? []) {
    const q = item.questionItem?.question
    if (!q) {
      // Judul bagian, pemisah halaman, gambar, video: bukan pertanyaan, tidak
      // dilaporkan. Petak pilihan (grid) memang pertanyaan -- dilaporkan.
      if (item.questionGroupItem) lewati('petak pilihan (grid)')
      continue
    }
    const cq = q.choiceQuestion
    if (!cq) {
      lewati(q.textQuestion ? 'jawaban singkat / paragraf'
        : q.scaleQuestion ? 'skala linier'
        : q.dateQuestion || q.timeQuestion ? 'tanggal / waktu'
        : q.fileUploadQuestion ? 'unggah file'
        : q.ratingQuestion ? 'rating'
        : 'jenis lain')
      continue
    }
    // Kotak centang = "pilih semua yang benar"; satu kunci tidak bisa menilainya.
    if (cq.type === 'CHECKBOX') { lewati('kotak centang'); continue }

    // "Lainnya…" adalah isian bebas, bukan opsi yang bisa jadi kunci.
    const opsi = (cq.options ?? []).filter(o => !o.isOther)
    if (opsi.some(o => !o.value?.trim())) { lewati('opsi berupa gambar saja'); continue }
    if (opsi.length < 2) { lewati('kurang dari 2 opsi'); continue }

    const pilihan = opsi.map(o => o.value!.trim())
    const benar = q.grading?.correctAnswers?.answers?.[0]?.value?.trim()
    const kunci = benar !== undefined ? pilihan.indexOf(benar) : -1
    if (kunci === -1) tanpaKunci++
    if (item.questionItem?.image || opsi.some(o => o.image)) bergambar++

    soal.push({
      pertanyaan: [item.title?.trim(), item.description?.trim()].filter(Boolean).join('\n'),
      pilihan,
      jawabanBenar: kunci === -1 ? null : kunci,
    })
  }

  return {
    formId: form.formId,
    judul: form.info?.title?.trim() || form.info?.documentTitle?.trim() || 'Formulir tanpa judul',
    deskripsi: form.info?.description?.trim() ?? '',
    soal,
    dilewati: [...dilewati].map(([alasan, jumlah]) => ({ alasan, jumlah })),
    tanpaKunci,
    bergambar,
  }
}
