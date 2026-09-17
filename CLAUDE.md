# Sesi Soal — CLAUDE.md

Aplikasi terpisah yang HANYA memuat **Bank Soal + Sesi Kelas + Kunci Layar Sesi**,
disalin dari Luang (`C:\Users\yasin\Projects\Luang`) per 2026-09-17. Guru menulis
soal pilihan ganda, membuat sesi, murid bergabung lewat kode/QR/link, mengerjakan,
dinilai di server, guru meninjau dan mem-veto nilai.

**Hanya guru yang punya akun.** Murid tidak mendaftar/login: saat pertama bergabung,
klien memanggil `supabase.auth.signInAnonymously()` (`masukTamu` di AuthContext).
Identitas anonim itu hidup di localStorage perangkat dan dibuang begitu jawaban
dinilai (`lepasIdentitas` di MuridSesiPage), supaya teman yang memakai HP yang sama
sesudahnya bergabung sebagai orang baru.

Yang TIDAK ikut dari Luang: semua generator AI (Scan Buku, Generate Soal, Modul,
RPM, LKPD, PPT, dst), kredit/Duitku/referral, LKPD & Game di dalam sesi, Tab Nilai
lintas sesi, Riwayat murid, Inbox, aplikasi native Luang Sesi, landing page, PWA
(service worker/manifest), mode malam, hapus akun.

## Stack & perintah

React 19 + TypeScript · Vite 8 · Tailwind v4 (`@tailwindcss/vite`) · Supabase
(project BARU, bukan project Luang).

```bash
npm install
cp .env.example .env     # isi URL + anon key project Supabase baru
npm run dev
npm run build            # tsc + vite build
```

### Menyiapkan project Supabase baru
```bash
supabase link --project-ref <ref-project-baru>
supabase db push         # menjalankan supabase/migrations/
```
Di dashboard (config.toml hanya berlaku untuk `supabase start` lokal):
- **Authentication → Providers → Email → matikan "Confirm email"** (sama dengan
  Luang; tanpa itu pendaftaran berhenti di "cek email").
- **Allow anonymous sign-ins = ON** — tanpa ini murid tidak bisa bergabung sama sekali.
- **Rate Limits → anonymous sign-ins**: bawaan 30/jam **per IP**. Satu kelas di
  belakang satu wifi sekolah = satu IP. Naikkan (config lokal memakai 500).
- **Site URL** = alamat deploy (dipakai link reset password).

Sakelar darurat kunci layar (membebaskan SEMUA murid di semua sesi tanpa rilis):
```sql
update public.pengaturan_sesi set kunci_layar_aktif = false where id = 1;
```

## Struktur

```
src/
  context/   Auth · Nav (penjaga tombol kembali) · Sesi · BankSoal
  lib/       sesiMurid (RPC murid + antrean offline) · sesiGuru (jawaban & veto)
             kunciLayar (sensor + fullscreen + wake lock) · sesiCapture (?sesi=)
             soal (validasi draft, pengelompokan, huruf pilihan)
  pages/
    auth/    AuthPages (login, daftar, lupa & reset password) — khusus guru
    guru/    GuruHome (Sesi · Bank Soal · Saya) · SesiPage · LihatJawabanSoal
             BankSoalPage · FormSoal
    murid/   MuridHome (tanpa tab) · MuridSesiPage · KerjakanSesi
    SayaPage (tab Saya guru)
supabase/migrations/
  20260917000000_skema_awal.sql       # skema lengkap, lihat kepalanya
  20260917100000_murid_tanpa_akun.sql # M1, M2
```

Tidak ada router. `AppScreen` (`types.ts`): `login | register | forgotPassword |
resetPassword | guru | murid`. Tanpa sesi login, layar awalnya `murid` (pintu
depan = kode sesi, dengan tautan "Kamu guru? Masuk"); murid anonim juga `murid`,
jadi membuat/membuang identitas tidak me-mount ulang MuridHome. Tab guru hidup di
state lokal GuruHome.

## Aturan yang ditegakkan DATABASE

Penomoran sama dengan Luang supaya bisa dicocokkan dengan catatan di sana.

| | Aturan |
|---|---|
| A1 | Kunci jawaban tidak pernah sampai ke murid: murid tidak punya policy apa pun di `sesi_kelas`; konten keluar lewat `ambil_konten_sesi()` yang membuang `jawabanBenar` |
| A2 | Kode sesi divalidasi hanya di server (`gabung_sesi`) |
| A3 | Satu akun sekali join per sesi (`unique (sesi_id, murid_id)`). Untuk murid, "akun" = identitas anonim satu perangkat — lihat catatan di bawah |
| A4 | Sinyal pengawasan tidak pernah mengubah NILAI |
| A5 | Autosave idempoten (PK `jawaban_sesi`) |
| A6 | Konten sesi = SALINAN soal. Mengedit/menghapus bank soal tidak mengubah sesi |
| A7 | Waktu dari server (`mulai_pada` via RPC, `sekarang_server` di tiap RPC) |
| A8 | `akhiri_sesi` / `mulai_sesi` idempoten |
| K1 | Status kunci di server (`sesi_murid.terkunci_pada`) |
| K2 | Hanya guru pemilik yang membuka kunci, lewat RPC |
| K3 | Kunci tidak menyentuh nilai; `selesaikan_murid` tetap jalan saat terkunci |
| K4 | Kunci opt-in per sesi, bawaan mati |
| K5 | Keputusan mengunci HANYA di `catat_peristiwa()`; cermin kliennya `JENIS_PENGUNCI` (`lib/kunciLayar.ts`) — ubah keduanya bersamaan |
| K6 | (klien) antrean offline mengirim jawaban SEBELUM peristiwa |
| K7 | `sesi_murid` TIDAK BOLEH punya policy UPDATE — satu policy = murid menghapus kuncinya sendiri lewat REST |
| M1 | Peran dari JENIS akun, bukan metadata klien (`handle_new_user`): anonim = murid, email = guru. Siapa pun bisa membuat akun anonim, jadi `role` di metadata tidak dipercaya |
| M2 | `bank_soal` & `sesi_kelas` punya policy RESTRICTIVE `adalah_guru()` — tanpa ini akun anonim dari internet bisa membuat sesi lewat REST |

Kunci efektif = sakelar darurat DAN `sesi_kelas.kunci_layar` DAN `terkunci_pada`
terisi. Kunci pertama baru bisa lahir 30 dtk (`kunci_layar_jeda_detik()`) setelah
kunci dinyalakan, supaya murid tidak terkunci oleh aturan yang belum ia lihat.

Skema awal diuji menjalankan migration di PGlite dengan skema `auth` tiruan (63
skenario: RLS, A1, K7, jeda, veto, pemakaian ulang kode); M1/M2 plus alur murid
anonim penuh diuji dengan cara yang sama (28 skenario). Skema awal sudah terpasang
di project Supabase `lpddqyfarfdakmudfhbf`.

**A3 tanpa akun murid lebih lemah dan itu disengaja.** Murid yang sudah mengirim
bisa bergabung lagi sebagai identitas baru (identitasnya dibuang sesudah dinilai;
mode privat juga cukup). Guru melihatnya sebagai dua baris dengan nama sama dan
bisa mem-veto. Pilihan sebaliknya (identitas dipertahankan) membuat murid kedua di
HP yang sama mewarisi jawaban & nilai murid pertama.

## Beda sengaja dari Luang

**Skema** (tidak ada data lama yang dijaga, jadi sisa sejarah Luang dibuang):
- `nilai_murid.ujian_id` + `asal` → `sesi_id` ber-FK ke `sesi_kelas`. Kolom lama
  itu sisa fitur Ujian yang sudah dihapus di Luang.
- `selesai_pada_ms` (bigint) → `selesai_pada` (timestamptz) di `sesi_kelas` & `nilai_murid`.
- `profiles`: klien hanya SELECT profil sendiri + UPDATE kolom `nama` (grant per
  kolom). Di Luang policy `for all` membuat murid bisa mengganti role-nya sendiri.
- `bank_soal`: CHECK kunci menunjuk pilihan yang ada & minimal 2 pilihan, plus
  kolom `urutan` — WAJIB sejak soal bisa diedit: UPDATE memindahkan baris di heap
  Postgres, jadi tanpa kolom ini soal yang baru diedit pindah ke akhir kelompok.
- `nilai_murid.nilai` CHECK 0–100; guru hanya SELECT + UPDATE (Luang `for all`).
- `gabung_sesi` menyaring `status = 'aktif'` SAAT mencari kode. Kode hanya unik di
  antara sesi aktif, jadi di Luang `limit 1` bisa memungut sesi lama yang sudah
  selesai dengan kode sama dan menolak murid dengan "Sesi sudah berakhir".
- `ambil_konten_sesi` hanya meneruskan konten `tipe = 'soal'`; tipe lain dibuang,
  bukan diteruskan apa adanya.
- Jenis peristiwa native (`split_screen`, `sematan_*`) dibuang bersama jembatan
  `window.LuangSesi`.

**Klien:**
- Bank Soal bisa **mengedit per soal** dan **mengubah info kelompok**
  (mapel/kelas/jurusan) — Luang cuma tambah & hapus per kelompok. Pilihan kosong
  dibuang saat simpan dan kuncinya digeser (`validasiDraft`); Luang menyimpannya.
- Huruf pilihan dihitung (`hurufPilihan`), bukan array tetap A–E — persiapan soal
  pindahan Google Form yang bisa punya >5 pilihan.
- **Murid tanpa akun** (Luang: murid mendaftar dengan email). Pendaftaran tidak
  lagi punya pilihan peran; tab Saya murid dibuang.
- Bilah tab guru disembunyikan per tab lewat `onLayarPenuh`, bukan `navHidden`
  bersama: tab yang pernah dibuka tetap ter-mount, jadi flag bersama bisa ditimpa
  tab yang sedang tidak terlihat.
- Tab Sesi punya daftar **Selesai**: satu-satunya jalan membuka jawaban & veto
  nilai sesi yang sudah diakhiri (Luang memakai sidebar Riwayat + Tab Nilai).
- "Akhiri Sesi" minta konfirmasi; tombol kembali perangkat menutup lapisan di sesi
  aktif (QR → konfirmasi → jawaban → panel tambah → tutup sesi, tidak mengakhiri).
- Veto hanya menerima bilangan bulat 0–100.

## Yang belum ditangani
- **Impor dari Google Form** (rencana). Skema sudah disiapkan (`simpan_id` =
  satu formulir, `urutan`, huruf pilihan dinamis). Catatan: kunci jawaban kuis
  TIDAK ada di halaman publik formulir — hanya lewat Forms API (OAuth, akun
  pemilik form) atau Apps Script di dalam form (`Choice.isCorrectAnswer()`).
- Murid yang menutup aplikasi sebelum Kirim tidak punya baris nilai
  (`akhiri_sesi` tidak menyelesaikan murid yang tertinggal) — sama dengan Luang.
- Bank soal dimuat tanpa paginasi; `max_rows` 1000 memotong diam-diam.
- Batas simpan log `sesi_peristiwa` (data perilaku anak, UU PDP).
- Akun anonim murid menumpuk di `auth.users` (satu per perangkat per sesi yang
  dikirim). JANGAN dibersihkan dengan menghapus usernya: `sesi_murid` &
  `jawaban_sesi` ber-`on delete cascade`, jadi jawaban di layar guru ikut hilang
  (`nilai_murid` selamat karena `set null`).
- CAPTCHA untuk login anonim (disarankan Supabase untuk mencegah pembuatan akun
  massal) — belum dipasang.
- PWA (manifest + service worker), hapus akun.
