// Menyiapkan satu sekolah beserta akun kepala sekolahnya. Dijalankan PEMILIK
// produk (bukan pembeli) tiap kali menjual satu paket:
//
//   npm run kepsek -- --sekolah "SMK Negeri 1 Contoh" --kode SMK1-CONTOH \
//                     --email kepsek@smkn1.sch.id --nama "Budi Santoso"
//
// Yang dikerjakan, berurutan:
//   1. Mencari baris `sekolah` dengan kode itu; belum ada -> dibuat.
//   2. Menolak kalau sekolah itu SUDAH punya kepala sekolah (satu per sekolah).
//   3. Membuat akun lewat Admin API Supabase (email langsung terkonfirmasi).
//      handle_new_user() otomatis membuat profilnya, perannya 'guru'.
//   4. Menaikkan perannya jadi 'kepala_sekolah'. Kalau langkah ini gagal, akun
//      yang baru dibuat dihapus lagi supaya tidak tertinggal setengah jadi.
//
// Kunci yang dipakai: SERVICE ROLE KEY (mem-bypass RLS). JANGAN pernah masuk ke
// .env biasa atau variabel VITE_*: yang berawalan VITE_ ditanam ke bundel yang
// dilihat siapa saja. Taruh di .env.rahasia (sudah di-gitignore lewat `.env.*`),
// lihat scripts/env.rahasia.contoh. Satu berkas per project Supabase pembeli.
//
// Cara pembeli mengganti password: layar Masuk -> "Lupa password" (link reset
// dikirim ke email kepala sekolah), jadi emailnya harus yang benar-benar dipakai.

import { randomInt } from 'node:crypto'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const PETUNJUK = `
Pemakaian:
  npm run kepsek -- --sekolah "<nama sekolah>" --kode <KODE> --email <email> --nama "<nama>" [--password <sandi>]

  --sekolah   nama sekolah (dipakai hanya kalau baris sekolahnya BELUM ada)
  --kode      kode sekolah; guru memakainya di layar Daftar. Unik, tidak peka huruf besar/kecil
  --email     email kepala sekolah (juga dipakai untuk "Lupa password")
  --nama      nama kepala sekolah
  --password  opsional; kalau kosong dibuatkan sandi acak 14 karakter

Butuh SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.rahasia (lihat scripts/env.rahasia.contoh).
`

function gagal(pesan) {
  console.error(`\nGAGAL: ${pesan}\n`)
  process.exit(1)
}

// Tanpa 0/O/1/l/I supaya sandi sementara gampang dibacakan atau dikirim lewat chat.
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
function sandiAcak(panjang = 14) {
  return Array.from({ length: panjang }, () => HURUF[randomInt(HURUF.length)]).join('')
}

const { values: a } = parseArgs({
  options: {
    sekolah: { type: 'string' }, kode: { type: 'string' }, email: { type: 'string' },
    nama: { type: 'string' }, password: { type: 'string' }, bantuan: { type: 'boolean', short: 'h' },
  },
})
if (a.bantuan) { console.log(PETUNJUK); process.exit(0) }

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !kunci) {
  gagal('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi.\n'
    + 'Buat .env.rahasia (contoh: scripts/env.rahasia.contoh), lalu jalankan lewat `npm run kepsek -- ...`.')
}
const kode = a.kode?.trim().toUpperCase()
const email = a.email?.trim().toLowerCase()
const nama = a.nama?.trim()
if (!kode || !email || !nama) { console.log(PETUNJUK); gagal('--kode, --email, dan --nama wajib diisi.') }
if (a.password && a.password.length < 8) gagal('Password minimal 8 karakter.')

const supabase = createClient(url, kunci, { auth: { autoRefreshToken: false, persistSession: false } })

// ── 1. Sekolah ──
// ilike tanpa wildcard: `%`, `_`, dan `\` di kode di-escape supaya dicocokkan apa adanya.
const polaKode = kode.replace(/[\\%_]/g, m => '\\' + m)
const { data: ada, error: galatCari } = await supabase
  .from('sekolah').select('id, nama, kode_sekolah').ilike('kode_sekolah', polaKode).maybeSingle()
if (galatCari) gagal(`Gagal membaca tabel sekolah: ${galatCari.message}`)

let sekolah = ada
let sekolahBaru = false
if (!sekolah) {
  if (!a.sekolah?.trim()) gagal(`Kode ${kode} belum ada, jadi --sekolah "<nama sekolah>" wajib diisi untuk membuatnya.`)
  const { data, error } = await supabase
    .from('sekolah').insert({ nama: a.sekolah.trim(), kode_sekolah: kode }).select('id, nama, kode_sekolah').single()
  if (error) gagal(`Gagal membuat sekolah: ${error.message}`)
  sekolah = data
  sekolahBaru = true
}

// ── 2. Satu kepala sekolah per sekolah ──
const { data: kepsek, error: galatKepsek } = await supabase
  .from('profiles').select('nama').eq('sekolah_id', sekolah.id).eq('role', 'kepala_sekolah')
if (galatKepsek) gagal(`Gagal memeriksa kepala sekolah yang ada: ${galatKepsek.message}`)
if (kepsek.length > 0) {
  gagal(`${sekolah.nama} sudah punya kepala sekolah (${kepsek[0].nama}). Tidak ada yang diubah.`)
}

// ── 3. Akun ──
const password = a.password ?? sandiAcak()
const { data: dibuat, error: galatAkun } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true,
  // handle_new_user() membaca dua kunci ini untuk mengisi profil.
  user_metadata: { nama, kode_sekolah: sekolah.kode_sekolah },
})
if (galatAkun || !dibuat?.user) {
  gagal(`Gagal membuat akun: ${galatAkun?.message ?? 'tidak ada pengguna yang dikembalikan'}`
    + (sekolahBaru ? `\n(Baris sekolah ${sekolah.kode_sekolah} sudah terbuat; menjalankan ulang aman, ia akan dipakai lagi.)` : ''))
}

// ── 4. Peran ──
const { error: galatPeran } = await supabase
  .from('profiles').update({ role: 'kepala_sekolah' }).eq('id', dibuat.user.id)
if (galatPeran) {
  await supabase.auth.admin.deleteUser(dibuat.user.id)
  gagal(`Akun terbuat tapi perannya gagal dinaikkan (${galatPeran.message}). Akun itu sudah dihapus lagi; coba ulang.`)
}

console.log(`
SELESAI.

  Sekolah          : ${sekolah.nama}${sekolahBaru ? ' (baru dibuat)' : ''}
  Kode sekolah     : ${sekolah.kode_sekolah}      <- dibagikan kepala sekolah ke guru-gurunya
  Kepala sekolah   : ${nama}
  Email            : ${email}
  Password         : ${password}

Password hanya ditampilkan SEKALI ini; simpan sekarang. Kepala sekolah bisa
menggantinya lewat "Lupa password" di layar Masuk.
`)
