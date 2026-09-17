# Sesi Soal — CLAUDE.md

Aplikasi terpisah yang HANYA memuat **Formulir Soal + Sesi Kelas + Kunci Layar Sesi**,
disalin dari Luang (`C:\Users\yasin\Projects\Luang`) per 2026-09-17. Guru menulis
soal pilihan ganda (atau mengimpornya dari Google Form), menekan Kirim untuk membuka
sesi, murid bergabung lewat kode/QR/link, mengerjakan, dinilai di server, guru
meninjau dan mem-veto nilai.

**Tampilan meniru Google Form**, untuk guru & murid yang sudah terbiasa di sana:
halaman guru adalah SATU editor formulir (kartu kepala berpita ungu, kartu
pertanyaan dengan garis biru saat disunting, "Kunci jawaban", tab Pertanyaan ·
Jawaban · Setelan, tombol Kirim); layar murid adalah tampilan responden.

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

### Impor dari Google Form
Tanpa OAuth, tanpa API, tanpa setup Google Cloud apa pun — dan karenanya tanpa
batas jumlah guru atau status Testing/Published untuk diurus. Guru menyalin teks
dari halaman **responden** Google Form (Ctrl+A, Ctrl+C) dan menempelnya di satu
kotak (`DialogImpor`, parser di `lib/tempelSoal.ts`). Aturannya cuma satu — soal
dipisah **baris kosong**, baris pertama tiap blok jadi pertanyaan, sisanya jadi
opsi; baris sampah baku Google Form (tombol, footer, penanda wajib/poin) disaring
lewat daftar regex terbaik-usaha, belum diuji dengan tempelan nyata.

Kunci jawaban kuis TIDAK PERNAH ikut tersalin — itu ikon di Google Form, bukan
teks, baik dari halaman edit maupun responden. Karena itu layar Tinjau di
`DialogImpor` bukan cuma daftar ringkas: tiap soal tampil sebagai kartu
`KartuPertanyaan` yang BISA disunting penuh (betulkan blok yang salah pisah,
hapus, tambah manual), dan guru menandai kunci di situ sebelum menekan Impor.
Sebelumnya ada juga jalur OAuth + Google Forms API (kunci ikut otomatis) tapi
itu ditinggalkan karena setupnya (Google Cloud project, OAuth consent screen,
batas 100 test user selama status Testing) terlalu berat untuk manfaatnya.

Sakelar darurat kunci layar (membebaskan SEMUA murid di semua sesi tanpa rilis):
```sql
update public.pengaturan_sesi set kunci_layar_aktif = false where id = 1;
```

## Struktur

```
src/
  context/   Auth · Nav (penjaga tombol kembali) · Sesi · Formulir (simpan otomatis)
  lib/       sesiMurid (RPC murid + antrean offline) · sesiGuru (jawaban & veto)
             kunciLayar (sensor + fullscreen + wake lock) · sesiCapture (?sesi=)
             soal (masalahSoal = cermin validasi server, uuid) · tempelSoal (impor teks)
  components/
    ui/      Button · Card · Dialog · Input · Sakelar · Ikon (SVG Material) · TeksOtomatis
    FormulirResponden (tampilan responden, dipakai murid & pratinjau guru)
    BagikanSesi (kode + QR + link) · LembarKonfirmasi · ScannerQr · TombolZoom
  pages/
    auth/    AuthPages (login, daftar, lupa & reset password) — khusus guru
    guru/    GuruHome (kepala + tab + laci ☰ + dialog) · TabPertanyaan · KartuPertanyaan
             TabJawaban (sesi, ringkasan, murid, veto) · TabSetelan
             DialogKirim · DialogImpor · Laci · Pratinjau
    murid/   MuridHome (tanpa tab) · MuridSesiPage · KerjakanSesi
supabase/migrations/
  20260917000000_skema_awal.sql       # skema lengkap, lihat kepalanya
  20260917100000_murid_tanpa_akun.sql # M1, M2
  20260917200000_formulir.sql         # F1, F2, F3
```

Tidak ada router. `AppScreen` (`types.ts`): `login | register | forgotPassword |
resetPassword | guru | murid`. Tanpa sesi login, layar awalnya `murid` (pintu
depan = kode sesi, dengan tautan "Kamu guru? Masuk"); murid anonim juga `murid`,
jadi membuat/membuang identitas tidak me-mount ulang MuridHome. Tab editor guru
hidup di state lokal GuruHome.

**Simpan otomatis (FormulirContext):** layar menulis ke state lokal dulu; database
menyusul lewat SATU antrean berurutan (insert soal baru harus mendahului update
ketikan pertamanya). Ketikan di-debounce 600 ms per soal dan di-flush sebelum
pindah formulir, saat tab disembunyikan, dan sebelum Kirim (`simpanSekarang`). Id
soal dibuat di klien (`buatUuid`) supaya soal baru langsung bisa diketik.

**Tombol kembali di GuruHome:** dua `<Penjaga>` — anak pertama (diperiksa paling
akhir) menutup arsip & kembali ke tab Pertanyaan; anak terakhir menutup dialog &
laci. Penangan diperiksa dari yang terakhir ter-mount.

## Aturan yang ditegakkan DATABASE

Penomoran sama dengan Luang supaya bisa dicocokkan dengan catatan di sana.

| | Aturan |
|---|---|
| A1 | Kunci jawaban tidak pernah sampai ke murid: murid tidak punya policy apa pun di `sesi_kelas`; konten keluar lewat `ambil_konten_sesi()` yang membuang `jawabanBenar` |
| A2 | Kode sesi divalidasi hanya di server (`gabung_sesi`) |
| A3 | Satu akun sekali join per sesi (`unique (sesi_id, murid_id)`). Untuk murid, "akun" = identitas anonim satu perangkat — lihat catatan di bawah |
| A4 | Sinyal pengawasan tidak pernah mengubah NILAI |
| A5 | Autosave idempoten (PK `jawaban_sesi`) |
| A6 | Konten sesi = SALINAN soal. Mengedit/menghapus formulir tidak mengubah sesi |
| A7 | Waktu dari server (`mulai_pada` via RPC, `sekarang_server` di tiap RPC) |
| A8 | `akhiri_sesi` / `mulai_sesi` idempoten |
| K1 | Status kunci di server (`sesi_murid.terkunci_pada`) |
| K2 | Hanya guru pemilik yang membuka kunci, lewat RPC |
| K3 | Kunci tidak menyentuh nilai; `selesaikan_murid` tetap jalan saat terkunci |
| K4 | Kunci opt-in per formulir/sesi, bawaan mati |
| K5 | Keputusan mengunci HANYA di `catat_peristiwa()`; cermin kliennya `JENIS_PENGUNCI` (`lib/kunciLayar.ts`) — ubah keduanya bersamaan |
| K6 | (klien) antrean offline mengirim jawaban SEBELUM peristiwa |
| K7 | `sesi_murid` TIDAK BOLEH punya policy UPDATE — satu policy = murid menghapus kuncinya sendiri lewat REST |
| M1 | Peran dari JENIS akun, bukan metadata klien (`handle_new_user`): anonim = murid, email = guru. Siapa pun bisa membuat akun anonim, jadi `role` di metadata tidak dipercaya |
| M2 | `bank_soal`, `sesi_kelas`, `formulir` punya policy RESTRICTIVE `adalah_guru()` — tanpa ini akun anonim dari internet bisa membuat sesi lewat REST |
| F1 | Soal boleh DRAF (kunci null, 1 opsi, pertanyaan kosong) karena editor menyimpan tiap ketikan. Yang tetap dijaga CHECK: kunci (kalau ada) menunjuk opsi yang ada |
| F2 | Sesi hanya lahir dari `buka_sesi_formulir()`: server memeriksa kelengkapan (pesan "Soal nomor N: …"), merakit snapshot dari `bank_soal`, dan membuat kode unik. Cermin kliennya `masalahSoal()` — kalimat & urutan sama, ubah keduanya bersamaan |
| F3 | Soal hanya bisa masuk formulir milik guru yang sama (policy restrictive; FK saja tidak memeriksa RLS) |

Kunci efektif = sakelar darurat DAN `sesi_kelas.kunci_layar` DAN `terkunci_pada`
terisi. Kunci pertama baru bisa lahir 30 dtk (`kunci_layar_jeda_detik()`) setelah
kunci dinyalakan, supaya murid tidak terkunci oleh aturan yang belum ia lihat.

Pengujian: skema awal diuji di PGlite dengan skema `auth` tiruan (63 skenario:
RLS, A1, K7, jeda, veto, pemakaian ulang kode); M1/M2/F1–F3 plus alur murid anonim
dan backfill data lama diuji dengan cara yang sama (53 skenario); `uraikanTempelan`
(lib/tempelSoal.ts) diuji dengan teks contoh (8 skenario: pemisah baris kosong,
CRLF, baris sampah, blok kurang dari 2 opsi, batas 10 opsi). Skema awal sudah
terpasang di project Supabase `lpddqyfarfdakmudfhbf`; `murid_tanpa_akun` dan
`formulir` BELUM.

**A3 tanpa akun murid lebih lemah dan itu disengaja.** Murid yang sudah mengirim
bisa bergabung lagi sebagai identitas baru (identitasnya dibuang sesudah dinilai;
mode privat juga cukup). Guru melihatnya sebagai dua baris dengan nama sama dan
bisa mem-veto. Pilihan sebaliknya (identitas dipertahankan) membuat murid kedua di
HP yang sama mewarisi jawaban & nilai murid pertama.

**Menghapus formulir tidak menghapus sesinya** (`sesi_kelas.formulir_id` on delete
set null). Sesi yatim itu muncul di laci ☰ → **Arsip sesi**, satu-satunya jalan
membuka nilainya lagi.

## Beda sengaja dari Luang

**Skema** (tidak ada data lama yang dijaga, jadi sisa sejarah Luang dibuang):
- `nilai_murid.ujian_id` + `asal` → `sesi_id` ber-FK ke `sesi_kelas`. Kolom lama
  itu sisa fitur Ujian yang sudah dihapus di Luang.
- `selesai_pada_ms` (bigint) → `selesai_pada` (timestamptz) di `sesi_kelas` & `nilai_murid`.
- `profiles`: klien hanya SELECT profil sendiri + UPDATE kolom `nama` (grant per
  kolom). Di Luang policy `for all` membuat murid bisa mengganti role-nya sendiri.
- Kelompok simpan Bank Soal (`simpan_id` + mapel/kelas/jurusan per baris) diganti
  tabel `formulir`; `bank_soal.urutan` WAJIB karena UPDATE memindahkan baris di
  heap Postgres. `sesi_kelas.mapel/kelas` dibuang, diganti `formulir_id` + `deskripsi`.
- `nilai_murid.nilai` CHECK 0–100; guru hanya SELECT + UPDATE (Luang `for all`).
- `gabung_sesi` menyaring `status = 'aktif'` SAAT mencari kode. Kode hanya unik di
  antara sesi aktif, jadi di Luang `limit 1` bisa memungut sesi lama yang sudah
  selesai dengan kode sama dan menolak murid dengan "Sesi sudah berakhir".
- `ambil_konten_sesi` hanya meneruskan konten `tipe = 'soal'`; tipe lain dibuang,
  bukan diteruskan apa adanya.
- Jenis peristiwa native (`split_screen`, `sematan_*`) dibuang bersama jembatan
  `window.LuangSesi`.

**Klien:**
- **Satu halaman editor ala Google Form** menggantikan tab Sesi · Bank Soal · Saya.
  Tidak ada lagi menambah/mengeluarkan grup soal di sesi yang sedang berjalan —
  sesi memuat seluruh formulir saat Kirim.
- **Impor dari Google Form** lewat tempel teks, tanpa OAuth/API apa pun (lihat penjelasan di atas).
- **Murid tanpa akun** (Luang: murid mendaftar dengan email). Pendaftaran tidak
  lagi punya pilihan peran.
- Layar murid tanpa huruf A/B/C di opsi — sama dengan responden Google Form.
- Hapus pertanyaan tanpa konfirmasi, dengan "Urungkan" 6 detik (pola Google Form).
- "Akhiri sesi" minta konfirmasi; veto hanya menerima bilangan bulat 0–100.

## Yang belum ditangani
- Murid yang menutup aplikasi sebelum Kirim tidak punya baris nilai
  (`akhiri_sesi` tidak menyelesaikan murid yang tertinggal) — sama dengan Luang.
- Soal satu formulir dimuat tanpa paginasi; `max_rows` 1000 memotong diam-diam.
- Gambar di soal (termasuk dari impor Google Form) belum didukung.
- Tidak ada seret-lepas untuk mengurutkan soal; baru tombol naik/turun.
- Batas simpan log `sesi_peristiwa` (data perilaku anak, UU PDP).
- Akun anonim murid menumpuk di `auth.users` (satu per perangkat per sesi yang
  dikirim). JANGAN dibersihkan dengan menghapus usernya: `sesi_murid` &
  `jawaban_sesi` ber-`on delete cascade`, jadi jawaban di layar guru ikut hilang
  (`nilai_murid` selamat karena `set null`).
- CAPTCHA untuk login anonim (disarankan Supabase untuk mencegah pembuatan akun
  massal) — belum dipasang.
- PWA (manifest + service worker), hapus akun.
