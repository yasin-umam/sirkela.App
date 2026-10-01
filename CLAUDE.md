# Sesi Soal — CLAUDE.md

Aplikasi terpisah yang HANYA memuat **Formulir Soal + Sesi Kelas + Kunci Layar Sesi**,
disalin dari Luang (`C:\Users\yasin\Projects\Luang`) per 2026-09-17. Guru menulis
soal pilihan ganda (atau mengimpornya dari Google Form / PDF), menekan Kirim untuk
membuka sesi, murid bergabung lewat kode/QR/link, mengerjakan, dinilai di server,
guru meninjau dan mem-veto nilai.

**Tampilan "Lembar Jawab"** (2026-10-01, desain ulang dari versi 2026-09-22 yang
meniru Luang, yang sebelumnya meniru Google Form): kertas ujian dan lembar jawab
komputer (LJK), BUKAN tiruan Luang lagi. Struktur navigasinya (bilah tab Riwayat ·
Menu · Saya, Sesi menumpang sorotan Menu) tetap sama dengan Luang; yang berganti
adalah bahasa visualnya. Lihat "Bahasa desain: Lembar Jawab" di bawah untuk
palet, huruf, dan aturannya.

Sisi guru menyalin bentuk shell Luang SAMPAI KE NAMA TABNYA, bukan cuma warnanya:
`GuruHome` adalah rumah bertab **Riwayat · Menu · Saya**, dan **Sesi bukan slot
tab sendiri** — persis pola `tabUntukHighlight`/"Sesi Kelas" Luang. Tab **Menu**
(`MenuPage.tsx`, bawaan saat masuk) adalah peluncur: blok "Sedang berjalan" kalau
ada sesi live, kartu ajakan biru "Formulir baru", lalu baris "Atau bawa dari
luar" — Generate dari topik (AI) · Tempel dari Google Form · Unggah PDF,
masing-masing baris PENUH (ikon + judul +
keterangan + panah), bukan grid ikon kecil — bentuknya menyalin layar "Soal"
Luang (`GenerateSoal.tsx`, dibuka lewat tile Soal di grid OperasionalPage),
dengan Scan Buku dikecualikan (lihat "Generate dari Topik (AI)" di bawah untuk
kenapa Scan Buku tetap di luar tapi Generate dari Topik sekarang ikut). Kartu
ajakan tinta (navy gelap) "Sesi" di paling bawah tetap satu-satunya pintu ke layar Sesi.
Tab **Riwayat** (`RiwayatPage.tsx`) adalah arsip lengkap dengan dua pil
(Formulir/Sesi), pengganti laci ☰ lama. Tab **Saya** (`ProfilePage.tsx`) adalah
akun: kartu profil + angka ringkas, lalu grup baris (Akun Saya, Akses — tempat
setelan otorisasi nanti dibangun, Keluar).

Layar Sesi (`SesiPage.tsx`) dan Jawaban & Nilai (`LihatJawaban.tsx`) adalah
TAKEOVER layar penuh yang menumpuk di atas bilah tab (`navHidden`, sama pola
dengan Luang) — dibuka dari kartu ajakan di Menu atau baris di Riwayat, ditutup
dengan panah kembali yang mengembalikan ke bilah tab. Menyunting satu formulir
membuka `EditorFormulir.tsx` sebagai cabang render TERPISAH (di luar bilah tab
sama sekali, seperti OperasionalPage Luang saat digenerate).

Layar murid (`LayarMurid.tsx`, dulu `FormulirResponden.tsx`) memakai kartu &
warna yang sama dengan sisi guru, dengan opsi berupa GELEMBUNG berhuruf A/B/C
(`Gelembung.tsx`, `HURUF_OPSI` ikut diekspor dari sana) yang terisi biru saat
dipilih, seperti lembar jawab komputer.

**Hanya staf yang punya akun** (guru DAN, sejak 2026-09-24, kepala sekolah —
lihat Super Sesi di bawah). Murid tidak mendaftar/login: saat pertama bergabung,
klien memanggil `supabase.auth.signInAnonymously()` (`masukTamu` di AuthContext).
Identitas anonim itu hidup di localStorage perangkat dan dibuang begitu jawaban
dinilai (`lepasIdentitas` di MuridSesiPage), supaya teman yang memakai HP yang sama
sesudahnya bergabung sebagai orang baru. Kepala sekolah juga akun EMAIL biasa
(masuk lewat layar Masuk yang sama dengan guru) — yang membedakannya cuma
`profiles.role`, dan peran itu HANYA bisa ditulis server. Sejak 2026-10-01
akun kepala sekolah TIDAK lahir dari dalam app: pemilik produk menyiapkannya
lewat `scripts/buat-kepala-sekolah.mjs`, karena aplikasi dijual sepaket dengan
akun itu (lihat "Menyiapkan sekolah & kepala sekolah" di bawah). Tidak ada peran
admin, layar admin, maupun alur pengajuan di dalam app.

Yang TIDAK ikut dari Luang: generator AI Luang LAIN di luar Soal (Scan Buku,
Modul, RPM, LKPD, PPT, dst — lihat pengecualian Soal di bawah), kredit/Duitku/
referral, LKPD & Game di dalam sesi, Tab Nilai lintas sesi, Riwayat murid, Inbox,
aplikasi native Luang Sesi, landing page, PWA (service worker/manifest), mode
malam, hapus akun.

**Pengecualian 2026-09-18: Impor PDF** (lihat di bawah) MEMBACA dokumen yang
guru sudah punya, bukan mengarang soal baru.

**Pengecualian 2026-09-22: Generate dari Topik (AI)** (lihat di bawah) BALIK
mencabut larangan "tanpa generator AI yang mengarang dari nol" — tapi HANYA
untuk Soal, dan HANYA jalur `topik bebas` milik Luang (bukan `dari RPM/Modul`,
yang memang tidak ada apa-apanya di app ini). Permintaan eksplisit dari
pemilik produk, dengan sadar bahwa ini membalik alasan awal ("MENGARANG dari
nol" sengaja tidak ikut) — dicatat di sini supaya perubahan pikirannya jelas,
bukan diam-diam ditimpa. Scan Buku (OCR foto buku), Modul, RPM, LKPD, PPT
TETAP di luar cakupan — permintaannya cuma soal generate dari topik bebas,
bukan seluruh hub konten AI Luang.

## Bahasa desain: Lembar Jawab (2026-10-01)

Konsepnya diambil dari kertas ujian dan LJK yang sudah dikenal murid: kartu putih
berbingkai garis tipis (tanpa bayangan, tanpa gradasi), gelembung jawaban yang
"diarsir" saat dipilih, kode sesi berbentuk karcis dengan garis sobekan, dan stempel
jingga untuk yang menyangkut waktu dan kunci. Dirancang dulu di Claude Design
(kanvas "Sesi Soal Redesign") lalu diterapkan ke kode; kanvasnya satu-satunya
tempat melihat papan Bahasa Desain utuh.

**Palet TERTUTUP** (`index.css`): `--color-*: initial` membuang semua warna bawaan
Tailwind, jadi `bg-indigo-600`/`text-slate-400` TIDAK menghasilkan apa pun.
Tailwind membuang kelas yang tidak dikenalnya TANPA pesan galat, jadi token yang
salah ketik cuma terlihat di layar; periksa dengan membandingkan semua kelas
berwarna di `src` dengan CSS hasil `npm run build` (itu yang dilakukan waktu
redesain: 860 kelas warna + 637 kelas ukuran, semuanya menghasilkan CSS).
- `tinta` #0F1A3A teks utama & kartu gelap (hero sesi, kartu Sesi di Menu) ·
  `tinta-2` teks isi · `teks-3` keterangan · `pinggir`/`pinggir-2` kontur gelembung
  & tombol · `garis`/`garis-2` bingkai & pemisah · `isian` · `alas` latar layar
- `biru` aksi utama & jawaban dipilih (+ `-gelap`/`-tint`/`-tipis`/`-muda`)
- `jingga` waktu, kunci layar, peringatan, DAN galat/bahaya (satu rumpun, tidak
  ada merah) (+ `-gelap` untuk teks, `-tint`/`-tipis`/`-garis`)
- `hijau` kunci jawaban benar & sesi berjalan (+ `-teks`/`-tint`/`-muda`)

**Aturan yang menjaga keterbacaan:** warna benar/salah SELALU ditemani ikon atau kata
("Kunci", "Dijawab salah", "Terkunci"), tidak pernah hue saja (buta warna
merah-hijau); teks kecil pakai `teks-3` ke atas (kontras ≥ 4.5), `pinggir` cuma untuk
kontur; angka besar (nilai, rata-rata) memakai sans proporsional, DM Mono hanya
untuk jam dan kode; meter satu ramp (lintasan tint, isi penuh).

**Bentuk:** dialog = lembar yang naik dari bawah di HP (`Dialog`), kartu di tengah
di ≥ 640px; bilah tab bawah menandai slot aktif dengan pil `biru-tint`; judul tab
(Menu/Riwayat/Saya) berupa judul besar di badan layar, bukan bilah putih; layar
penuh (Sesi, Nilai, Super Sesi, editor) memakai bilah putih tipis dengan panah kembali.

**Beda dari kanvas desain, sengaja:** editor TIDAK punya tab Setelan (dibuang
2026-09-22); kunci layar Super Sesi per KELAS (per sesi), bukan satu sakelar serentak,
karena server tidak punya RPC untuk itu; dialog Kirim langsung menjalankan pilihan
yang diketuk (tidak ada tombol "Buka sesi" terpisah) seperti sebelumnya.

### Tampilan desktop (2026-10-01)

Sebelumnya desktop cuma kolom HP yang dilebarkan (maks 672px) dengan bilah tab
bawah 430px di tengah. Sekarang ≥ 1024px (breakpoint `lg` Tailwind) punya
kerangka sendiri; 440-1023px (tablet) tetap tata letak HP yang dipusatkan
(`desktop:max-w-2xl`, bilah tab ikut selebar kolomnya).

- **Dua cara membedakan HP dan desktop, jangan dicampur sembarangan:** kelas
  `lg:` untuk beda ukuran/susunan biasa (satu markup, satu sumber kebenaran);
  hook `useDesktop()` (`lib/useDesktop.ts`, harus sama dengan `lg`) HANYA kalau
  strukturnya berbeda jauh (tabel vs daftar bertumpuk di Riwayat/Sesi, master-detail
  vs akordeon di Jawaban & nilai).
- **Sidebar guru** (`SidebarGuru.tsx`) menggantikan `BottomNav` (`lg:hidden`).
  Beda struktural dari HP: **Sesi dan Super Sesi punya item sendiri** (di HP
  menumpang sorotan Menu); tab Saya diwakili kartu akun di dasar sidebar dengan
  tombol Keluar. Editor tetap cabang render terpisah TANPA sidebar.
- **Menu:** dua kolom (kiri membuat soal, kanan status), urutan DOM satu dan
  kolom diatur `lg:order-*`. `KartuBerjalan` (kode, sisa waktu, tombol buka
  kendali) cuma di desktop; HP tetap `BarisBerjalan`.
- **Riwayat & daftar Sesi:** tabel (`TabelDesktop.tsx`: `KepalaTabel`/`BarisTabel`).
- **Sesi berjalan:** kolom kiri 380px (kode & QR, sisa waktu, durasi, kunci layar),
  kanan murid dalam dua kolom. **Penyaring murid (Semua/Terkunci/Senyap) cuma di
  desktop** dan hanya menyaring tampilan; `keadaanPeserta()` satu-satunya tempat
  "terkunci/senyap" dihitung (dipakai penyaring dan baris peserta).
- **Jawaban & nilai:** empat angka di atas, lalu tabel murid + panel detail murid
  terpilih (veto, jawaban per soal). Di desktop tampilan bawaan `murid`.
- **Editor:** tiga kolom -- rel pertanyaan (`RelPertanyaan`), kartu-kartu
  (`TabPertanyaan`, tetap satu-satunya kolom yang menggulir), panel "Siap
  dikirim?" + pratinjau kecil (`PanelKirim`), semua di `PanelEditor.tsx`.
  Panelnya turunan MURNI dari data formulir (`masalahSoal`, `masalahFormulir`),
  tanpa keadaan atau panggilan server baru. Terhubung ke kartu lewat `lompat`
  dan `onFokus` di `TabPertanyaan`. Bilah alat mengambang HP disembunyikan di desktop.
- **Super Sesi (kepala sekolah):** kepala mendatar + TABEL kiriman; baris yang
  berjalan bisa dibuka (kunci per kelas, daftar murid). Kartu HP dan baris tabel
  hidup berdampingan di `KartuSubmisi` (satu `lg:hidden`, satu `hidden lg:grid`).
- **Murid:** pintu depan dua kolom (judul + tiga langkah | karcis; tombol Pindai
  QR disembunyikan karena PC lab tidak punya kamera). Layar mengerjakan: panel
  peta jawaban + tombol Kirim menempel di kiri, bilah kirim bawah dan strip bulat
  atas disembunyikan.
- **Jebakan kelas:** `Button` sudah membawa `inline-flex`, jadi `hidden` biasa
  TIDAK menyembunyikannya (yang dipakai: `max-lg:hidden`). Kelas yang dibuang
  Tailwind diam-diam tidak ketahuan sampai dilihat di layar.

## Stack & perintah

React 19 + TypeScript · Vite 8 · Tailwind v4 (`@tailwindcss/vite`) · Supabase
· Plus Jakarta Sans + DM Mono dibundel lewat `@fontsource` (tanpa Google Fonts:
wifi sekolah, dan IP murid tidak perlu bocor ke pihak ketiga)
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
supabase secrets set OPENROUTER_API_KEY=<kunci-openrouter>   # dipakai Impor PDF DAN Generate dari Topik
supabase functions deploy impor-pdf
supabase functions deploy generate-soal
```
Di dashboard (config.toml hanya berlaku untuk `supabase start` lokal):
- **Authentication → Providers → Email → matikan "Confirm email"** (sama dengan
  Luang; tanpa itu pendaftaran berhenti di "cek email").
- **Allow anonymous sign-ins = ON** — tanpa ini murid tidak bisa bergabung sama sekali.
- **Rate Limits → anonymous sign-ins**: bawaan 30/jam **per IP**. Satu kelas di
  belakang satu wifi sekolah = satu IP. Naikkan (config lokal memakai 500).
- **Site URL** = alamat deploy (dipakai link reset password).
- **Sekolah & kepala sekolah pertama**: dibuat skrip pemilik, bukan SQL editor
  (`npm run kepsek -- ...`, lihat "Menyiapkan sekolah & kepala sekolah"). Sebelum
  ada baris `sekolah`, guru tidak bisa mendaftar (`handle_new_user()` menolak akun
  non-anonim tanpa kode sekolah yang valid).

### Deploy: Cloudflare Pages, sama dengan Luang
Project **Pages** yang dibuat lewat **Workers & Pages → Create → tab Pages →
Connect to Git** (`yasin-umam/sirkela.App`, branch `main`). Tiap push ke `main`
dibangun ulang otomatis. Build command `npm run build`, output `dist`, versi Node
dari `.node-version`. Environment variables (Production & Preview):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — nilainya ditanam Vite SAAT build,
jadi mengubahnya butuh build ulang (Retry deployment atau push baru).
- Repo harus masuk daftar akses aplikasi GitHub **Cloudflare Workers and Pages**
  (github.com/settings/installations). Repo baru TIDAK ikut otomatis kalau
  aksesnya "Only select repositories" — tanpa itu push tidak memicu apa pun.
- JANGAN dibuat sebagai Worker (tombol Create membuka Workers lebih dulu). Project
  pertama `sirkela-app.…workers.dev` salah jalur begitu: tidak tersambung ke Git,
  sempat diberi `wrangler.jsonc`, dan tidak pernah dibangun dari push. Tanda
  project yang benar di daftar dashboard: ikon petir, alamat `….pages.dev`, dan
  pesan commit terakhir tampil di bawah namanya.
- Tidak ada router URL (cuma `?sesi=` di query), jadi tidak perlu `_redirects`.

### Impor dari Google Form
Tanpa OAuth, tanpa API, tanpa setup Google Cloud apa pun — dan karenanya tanpa
batas jumlah guru atau status Testing/Published untuk diurus. Guru menyalin teks
dari halaman **responden** Google Form (Ctrl+A, Ctrl+C) dan menempelnya di satu
kotak (`DialogImpor`, parser di `lib/tempelSoal.ts`). Dua gaya, dipilih otomatis:
- **Bernomor** (ada baris `1.` / `2)`): baris bernomor memulai soal baru, baris
  sesudahnya opsi. Baris kosong DIABAIKAN — gaya dokumen lazim punya baris kosong
  di antara pertanyaan dan opsinya, dan memakainya sebagai pemisah membuat opsi A
  terbaca sebagai pertanyaan (bug nyata, sudah ditemukan guru).
- **Tanpa nomor**: soal dipisah **baris kosong**, baris pertama tiap blok jadi
  pertanyaan, sisanya opsi.

Di kedua gaya, awalan `1.` dibuang dari pertanyaan dan `A.` / `b)` dari opsi
(layar murid menggambar hurufnya sendiri dari posisi opsi — lihat `HURUF_OPSI`
di `LayarMurid.tsx` — teks tersimpan tidak boleh membawa huruf juga). Baris
sampah baku Google Form (tombol, footer, penanda wajib/poin) disaring lewat
daftar regex terbaik-usaha.

Kunci jawaban kuis TIDAK PERNAH ikut tersalin — itu ikon di Google Form, bukan
teks, baik dari halaman edit maupun responden. Karena itu layar Tinjau di
`DialogImpor` bukan cuma daftar ringkas: tiap soal tampil sebagai kartu
`KartuPertanyaan` yang BISA disunting penuh (betulkan blok yang salah pisah,
hapus, tambah manual), dan guru menandai kunci di situ sebelum menekan Impor.
Sebelumnya ada juga jalur OAuth + Google Forms API (kunci ikut otomatis) tapi
itu ditinggalkan karena setupnya (Google Cloud project, OAuth consent screen,
batas 100 test user selama status Testing) terlalu berat untuk manfaatnya.

### Impor PDF (AI, ditambah 2026-09-18)
Jalur kedua di `DialogImpor` (guru memilih Tempel teks vs Unggah PDF di layar
pertama), untuk migrasi dari Microsoft 365 atau Google Form yang diekspor/dicetak
jadi PDF, atau dokumen soal apa pun. Beda dari Impor teks: bukan cuma regex, PDF-nya
dibaca AI (`anthropic/claude-haiku-4.5` lewat **OpenRouter**, dipilih karena murah
dan mendukung dokumen PDF native tanpa OCR terpisah).

- **Klien** (`lib/imporPdf.ts`): baca berkas jadi data URL base64, kirim ke Edge
  Function lewat `supabase.functions.invoke('impor-pdf', ...)` — otomatis membawa
  JWT sesi guru, jadi tidak perlu pegang token manual. Batas 15 MB di klien DAN
  server (`MAKS_BYTE_PDF`, dua tempat, cermin satu sama lain).
- **Server** (`supabase/functions/impor-pdf/index.ts`, Deno Edge Function): kunci
  `OPENROUTER_API_KEY` cuma hidup di sini (secret, lihat setup di atas) — TIDAK
  PERNAH ke klien, beda dari Impor teks yang murni klien. Peran guru dicek lewat
  RPC `adalah_guru()` yang SAMA dengan RLS (bukan diturunkan ulang), jadi murid
  anonim ditolak 403 sebelum PDF-nya dikirim ke OpenRouter. AI dipaksa balas lewat
  **tool call** (`catat_soal`, bukan minta AI menulis JSON mentah) supaya bentuknya
  selalu valid; server lalu memvalidasi tiap soal (buang blok tanpa pertanyaan atau
  kurang dari 2 opsi, potong opsi ke-11 dst, clamp kunci ke rentang opsi) sebelum
  dikirim balik — jangan percaya keluaran AI mentah-mentah.
- Hasilnya berbentuk `HasilTempel` yang SAMA dengan `uraikanTempelan()` (Impor
  teks), jadi memakai layar Tinjau (`KartuPertanyaan`) yang SAMA persis.
- **Kunci jawaban dari AI cuma TEBAKAN**, sama seperti Impor teks yang memang tidak
  pernah membawanya sama sekali — bedanya di sini AI KADANG menebak benar (kalau
  dokumennya menandai kunci dengan jelas) tapi juga bisa salah (diuji manual: AI
  sempat menjawab "5 + 7 = 11"). Guru tetap WAJIB menandai/memeriksa kunci di layar
  Tinjau sebelum Impor — pesan di layar itu disesuaikan per sumber (`metode` di
  `DialogImpor`) supaya guru tahu mana yang "tidak pernah ada kuncinya" (teks),
  "ada tebakan, periksa lagi" (PDF), atau "AI menulis sendiri, tetap bisa salah"
  (Generate — lihat di bawah).

### Generate dari Topik (AI, ditambah 2026-09-22)
Jalur ketiga di `DialogImpor` ("Generate dari topik", baris pertama di layar
pilih cara). Beda mendasar dari dua jalur lain: TIDAK ADA dokumen sumber sama
sekali — guru menulis topik/materi bebas (mis. "Perkalian pecahan untuk kelas 5
SD"), pilih jumlah soal (1–20, cermin `MAKS_JUMLAH_SOAL` di klien & server) dan
tingkat kesulitan (mudah/sedang/sulit), lalu AI **MENGARANG** soal pilihan ganda
dari nol. Ini fitur "generator AI yang mengarang dari nol" yang tadinya sengaja
TIDAK ikut disalin dari Luang — lihat pengecualian di bagian pembuka kenapa
sekarang ditambahkan, dan kenapa cuma jalur ini (bukan Scan Buku, bukan jalur
"dari RPM/Modul" milik `GenerateSoal.tsx` Luang, yang memang tidak punya
padanan di app ini).

- **Klien** (`lib/generateSoal.ts`): kirim `{ topik, jumlah, kesulitan }` ke Edge
  Function lewat `supabase.functions.invoke('generate-soal', ...)`. Tanpa berkas,
  tanpa base64 -- jauh lebih ringan daripada Impor PDF.
- **Server** (`supabase/functions/generate-soal/index.ts`, Deno Edge Function):
  strukturnya SENGAJA sedekat mungkin dengan `impor-pdf/index.ts` (auth lewat
  `adalah_guru()`, model `anthropic/claude-haiku-4.5` lewat OpenRouter, tool call
  `catat_soal`, validasi longgar di server) supaya keduanya gampang dirawat
  bersamaan. Beda satu tempat: `kunciIndex` DIWAJIBKAN di skema tool-nya (bukan
  boleh -1 seperti Impor PDF) karena AI mengarang jawabannya sendiri, bukan
  menebak dari dokumen orang lain — tapi server tetap meng-clamp ke rentang opsi
  yang ada, tidak dipercaya mentah-mentah.
- **TANPA kredit/kuota Luang** — sesuai permintaan, fitur ini TIDAK menyalin
  `useKreditGenerate`/billing Luang sama sekali. Artinya sama seperti Impor PDF:
  satu guru yang generate berkali-kali memakai kredit OpenRouter yang sama untuk
  semua guru, tanpa batas per akun (lihat "Yang belum ditangani").
- Hasilnya berbentuk `HasilTempel` yang SAMA, jadi memakai layar Tinjau
  (`KartuPertanyaan`) yang SAMA dengan dua jalur lain — guru tetap WAJIB memeriksa
  kunci sebelum Impor, walau AI yang menulis soal DAN kuncinya sekaligus: AI bisa
  salah hitung atau salah fakta pada materi yang dikarangnya sendiri, sama seperti
  bug "5 + 7 = 11" yang pernah ditemukan di Impor PDF.

### Super Sesi (ditambah 2026-09-24)
Peran KETIGA, `kepala_sekolah`, dan tiga tabel baru (`sekolah`, `super_sesi`,
`super_sesi_soal`) untuk kebutuhan yang sama sekali tidak ada di Luang: saat
ulangan semester, guru yang MENGAWAS di kelas biasanya BUKAN guru mapel yang
menulis soalnya. Super Sesi memisahkan "siapa menulis soal" dari "siapa
menjalankan sesi di kelas":

1. Guru mapel menulis formulir seperti biasa, lalu menekan Kirim membawanya
   LANGSUNG ke pilihan jenis sesi di `DialogKirim` (2026-09-24 redesain: tanpa
   layar info perantara dengan satu tombol "Buka sesi" seperti sebelumnya) —
   dua kartu sejajar, **Sesi Mandiri** (buka & kelola sendiri, cocok untuk
   ulangan harian) dan **Kirim ke Super Sesi** (satu baris per Super Sesi yang
   sedang `mengumpulkan` di sekolahnya; kosong = kartu ini tampil redup dengan
   keterangan "Belum ada Super Sesi yang dibuka kepala sekolah", bukan hilang
   sama sekali — guru tetap tahu fitur ini ada). Memilih Super Sesi memanggil
   RPC `kirim_ke_super_sesi()`, yang menyalin soalnya — validasi kelengkapan &
   bentuk snapshot SAMA PERSIS dengan `buka_sesi_formulir()`, difaktor bersama
   lewat `masalah_soal_formulir()`/`rakit_snapshot_soal()` supaya keduanya
   tidak pernah menyimpang — jadi satu baris `super_sesi_soal` baru, TANPA
   membuka sesi apa pun dulu.
2. Kepala sekolah (`SuperSesiPage.tsx`, dibuka dari kartu "Super Sesi" di
   `MenuPage.tsx` — sejak 2026-09-24 kepala sekolah memakai `GuruHome` yang
   SAMA dengan guru, bukan shell terpisah lagi, lihat "kepala sekolah
   berbagi GuruHome" di bawah) membuat Super Sesi (insert langsung, sama
   pola dengan `formulir`) dan melihat semua kiriman lewat RPC
   `pantau_super_sesi()` (dipoling tiap 10 detik seperti `LihatJawaban.tsx`,
   karena kepala sekolah TIDAK punya akses RLS ke `sesi_kelas`/`sesi_murid`
   pengawas — lihat SS3). **Tidak ada lagi langkah menugaskan pengawas
   satu-satu** (RPC `tugaskan_pengawas_super_sesi()` DIHAPUS 2026-09-25,
   lihat poin 4) — permintaan eksplisit pemilik produk: kepala sekolah
   cukup mengumpulkan kiriman dan menekan Mulai, siapa yang menjalankan
   tiap kelas ditentukan belakangan lewat klaim bebas.
3. Menekan "Mulai Super Sesi" memanggil `mulai_super_sesi()`: untuk TIAP
   kiriman langsung membuat satu `sesi_kelas` TANPA pemilik (`guru_id =
   null`, SS7) — tidak ada lagi validasi "pengawas belum ditugaskan" karena
   memang tidak ada penugasan lagi. Kolom `sesi_kelas.super_sesi_id`/
   `super_sesi_judul` disalin ke baris saat itu juga (SS3) supaya guru yang
   nanti mengklaimnya tahu asalnya tanpa pernah butuh akses ke tabel
   `super_sesi`/`super_sesi_soal` — yang secara struktural memang tidak
   mereka punya (mereka bukan kepala sekolah pemiliknya maupun guru mapel
   pengirimnya).
4. **Klaim bebas (ditambah 2026-09-25, menggantikan penugasan pengawas):**
   guru mana pun di sekolah yang sama (termasuk kepala sekolah sendiri, yang
   sejak `kepsek_guru_gabung` juga lolos `adalah_guru()`) melihat kelas yang
   baru terdistribusi lewat blok BARU "Kelas Super Sesi siap diambil" di
   puncak `MenuPage.tsx`, dari RPC `ambil_kelas_tersedia_super_sesi()` yang
   dipoling tiap 10 detik (`SesiContext`, state `kelasTersedia`) — METADATA
   SAJA (mapel/kelas/judul, SS8), TANPA `konten_list`/kunci jawaban, supaya
   guru yang belum mengklaim tidak bisa membaca kunci jawaban duluan.
   Menekan satu baris memanggil `klaim_kelas_super_sesi()`
   (`klaimKelasSuper` di `SesiContext`): atomik lewat `update ... where
   guru_id is null` (SS9), jadi guru kedua yang menekan kelas yang sama
   nyaris bersamaan mendapat pesan jelas ("Kelas ini sudah diambil guru
   lain") alih-alih tabrakan diam-diam. Sukses klaim mengembalikan sesi
   LENGKAP (sama seperti `buka_sesi_formulir()` ke pembuatnya sendiri) dan
   langsung menavigasi ke `SesiAktifView` yang sudah ada (`SesiPage.tsx`,
   badge kecil "Super Sesi: …" muncul di kartu info kalau `superSesiId`
   terisi) — tombol "Mulai sesi" yang SUDAH ADA di sanalah yang benar-benar
   menjalankan ulangan, PERSIS seperti sebelumnya (satu ketukan cuma
   membuka layar kendali, supaya guru sempat membagikan kode/QR ke kelasnya
   dulu). Begitu diklaim, baris `sesi_kelas`-nya tidak bisa dibedakan dari
   sesi yang dibuka sendiri lewat Kirim: `sesi_kelas_guru_all` yang sudah
   ada langsung memberi kendali penuh (Mulai sesi, kunci layar, veto nilai)
   TANPA policy baru apa pun, dan begitu diklaim baris itu juga langsung
   muncul di blok lama "Super Sesi siap dimulai" (disaring dari `semuaSesi`,
   `superSesiId != null && mulaiPada == null`) untuk guru yang baru
   mengklaimnya.

**Pengawasan kunci layar terpusat di kepala sekolah** (ditambah 2026-09-24,
permintaan eksplisit pemilik produk): untuk sesi hasil Super Sesi, wewenang
mengunci/membuka kunci layar murid PINDAH SELURUHNYA ke kepala sekolah —
pengawas TETAP pemegang sesi untuk segala hal lain (mulai/akhiri, lihat
jawaban, veto nilai; SS2 tidak berubah), tapi `KartuKunciLayar` di
`SesiPage.tsx` jadi kartu INFORMASI ("kepala sekolah yang mengatur, bukan
kamu") dan tombol "Buka" di `BarisPeserta` disembunyikan sama sekali untuk
sesi jenis ini — supaya UI tidak menjanjikan aksi yang toh akan ditolak
server. Alasannya: keputusan buka kunci harus konsisten antar kelas selama
ulangan serentak, bukan tergantung kebijakan masing-masing pengawas.
- Server: `buka_kunci_murid()`/`buka_kunci_semua()`/`atur_kunci_layar()`
  (dipanggil guru) SEKARANG MENOLAK kalau `sesi_kelas.super_sesi_id` terisi —
  termasuk mematikan sakelar kunci layar, karena kunci EFEKTIF cuma butuh
  `sesi_kelas.kunci_layar = true` (K1), jadi mematikannya sama saja dengan
  membebaskan semua murid lewat jalur belakang kalau tidak ikut ditolak.
  Logika "bebaskan kunci" difaktor ke `bebaskan_kunci_murid()`/
  `bebaskan_kunci_semua()` (internal, tidak digrant ke siapa pun) supaya
  jalur guru (ditolak untuk Super Sesi) dan jalur kepala sekolah (baru) tidak
  menduplikasi UPDATE/INSERT yang sama.
- Server, jalur BARU: `buka_kunci_murid_kepsek()`/`buka_kunci_semua_kepsek()`/
  `atur_kunci_layar_kepsek()` — kepala sekolah, dicek lewat `adalah_kepsek()`
  DAN kepemilikan `super_sesi` yang menaungi sesi itu (lewat `super_sesi_soal.sesi_id`).
- `pantau_super_sesi()` ikut membawa `kunci_layar` sesi & daftar `murid` per
  kiriman (`terkunci_pada`, `terakhir_denyut`, hitungan `keluar_layar`/
  `hilang_fokus` dari `sesi_peristiwa` — laporan KESAKSIAN yang sama dengan
  yang dilihat pengawas, A4 tetap berlaku) supaya kepala sekolah "menerima
  laporan murid keluar dari sesi" tanpa RLS baru ke `sesi_murid`/`sesi_peristiwa`.
- Klien: `DetailSuperSesi.tsx` (kepsek) — tiap kiriman yang sudah berjalan
  bisa dibuka (`PengawasanKelas`) untuk lihat daftar murid, nyalakan/matikan
  kunci layar, dan buka kunci per murid atau semua sekaligus. `SuperSesiContext`
  menambah `bukaKunciMuridSuper`/`bukaKunciSemuaSuper`/`aturKunciLayarSuper`,
  masing-masing me-refresh `submisi` langsung sesudah sukses (tidak menunggu
  jeda poling 10 detik).

**Sekolah sebagai batas isolasi**: satu project Supabase sekarang bisa
menampung LEBIH dari satu sekolah. `profiles.sekolah_id` (WAJIB untuk
guru/kepala_sekolah lewat CHECK `profiles_sekolah_wajib_staf`, `null` untuk
murid) menentukan siapa lihat siapa — guru cuma melihat Super Sesi yang MASIH
`mengumpulkan` di sekolahnya sendiri (policy `super_sesi_guru_lihat_terbuka`),
dan cuma bisa melihat/mengklaim kelas Super Sesi yang belum dimiliki dari
sekolahnya sendiri (`ambil_kelas_tersedia_super_sesi()`/
`klaim_kelas_super_sesi()` menolak lintas sekolah). Baris `sekolah` dibuat
oleh PEMILIK produk lewat skrip, bersama akun kepala sekolahnya
(`scripts/buat-kepala-sekolah.mjs`). Guru lain di sekolah itu mendaftar sendiri
lewat layar Daftar memakai kode sekolahnya (field "Kode Sekolah" di `RegisterPage`,
dicek dulu lewat RPC anon `cek_kode_sekolah()` SEBELUM `signUp()` — supaya kode
salah ditolak dengan pesan jelas di layar Daftar, bukan lewat kegagalan trigger
`handle_new_user()` yang belum tentu tembus apa adanya lewat GoTrue).

**Kunci jawaban tetap salinan** (gaya A6, lihat SS1): `super_sesi_soal.konten_list`
adalah snapshot formulir SAAT dikirim, bukan referensi — mengedit/menghapus
formulir sesudah dikirim tidak mengubah kiriman yang sudah masuk, dan
`mulai_super_sesi()` cuma membaca dari `super_sesi_soal`, tidak pernah membaca
ulang `formulir`.

### Menyiapkan sekolah & kepala sekolah (2026-10-01)
Peran admin DIBUANG. Sebelumnya (2026-09-24 sampai 09-30) ada admin tunggal yang
dicek dari email yang di-hardcode di `adalah_admin_utama()`, menyetujui guru yang
mengajukan diri jadi kepala sekolah lewat layar admin, dan membuat baris
`sekolah` lewat layar yang sama. Dibuang karena aplikasi dijual sepaket dengan
akun kepala sekolah yang SUDAH disiapkan pemilik: tidak ada "admin" di dalam app,
jadi tidak ada layar, RPC persetujuan, tabel pengajuan, atau email di badan fungsi.

Satu perintah per paket yang dijual:
```bash
npm run kepsek -- --sekolah "SMK Negeri 1 Contoh" --kode SMK1-CONTOH \
                  --email kepsek@smkn1.sch.id --nama "Budi Santoso"
```
`scripts/buat-kepala-sekolah.mjs` mengerjakan, berurutan: (1) mencari baris
`sekolah` berkode itu, membuatnya kalau belum ada; (2) MENOLAK kalau sekolah itu
sudah punya kepala sekolah (satu per sekolah, kini hanya ditegakkan skrip ini,
bukan RPC); (3) membuat akun lewat Admin API (`auth.admin.createUser`, email
langsung terkonfirmasi, `user_metadata` memuat `nama` dan `kode_sekolah` untuk
`handle_new_user()`); (4) menaikkan `profiles.role` jadi `kepala_sekolah`, dan
kalau langkah ini gagal akun yang baru dibuat dihapus lagi supaya tidak setengah
jadi. Password acak 14 karakter dicetak SEKALI.

- **Kunci:** SERVICE ROLE key (mem-bypass RLS) di `.env.rahasia` (gitignored lewat
  `.env.*`; contoh: `scripts/env.rahasia.contoh`), satu berkas per project Supabase
  pembeli. JANGAN di `.env` biasa atau berawalan `VITE_` (ikut tertanam ke bundel
  yang dilihat siapa saja), jangan dikirim ke pembeli, jangan di-commit.
- **Peran tetap hanya lahir dari server** (M1/SK1): `handle_new_user()` selalu
  menulis `guru`; skrip yang menaikkannya dengan service role. Klien tidak punya
  jalan apa pun mengubah `role` (grant kolom `profiles` cuma `nama`).
- **Ganti kepala sekolah:** turunkan yang lama dulu lewat SQL editor
  (`update public.profiles set role = 'guru' where id = '<uuid>';`), lalu jalankan
  skrip untuk yang baru (kodenya dipakai lagi, `--sekolah` tidak perlu).
- **Ganti password:** lewat "Lupa password" di layar Masuk (link ke email), jadi
  email yang dimasukkan harus yang benar-benar dipakai kepala sekolah.
- **Migrasi** `20261001000000_hapus_admin.sql` men-drop tabel
  `pengajuan_kepala_sekolah` (beserta policy & indeksnya) dan tujuh fungsi:
  `adalah_admin_utama`, `ajukan_kepala_sekolah`, `ambil_pengajuan_kepsek`,
  `putuskan_pengajuan_kepsek`, `sekolah_punya_kepsek`, `ambil_semua_sekolah`,
  `buat_sekolah`. Migrasi lama sengaja tidak diubah (riwayat utuh), jadi project
  baru menjalankan semuanya dari awal lalu membongkarnya di migrasi ini.
- **Tidak ada lagi UI mengelola sekolah:** ganti kode, ubah nama, hapus sekolah, atau
  pindahkan guru antar sekolah semuanya SQL editor manual oleh pemilik.

Sakelar darurat kunci layar (membebaskan SEMUA murid di semua sesi tanpa rilis):
```sql
update public.pengaturan_sesi set kunci_layar_aktif = false where id = 1;
```

## Struktur

```
src/
  context/   Auth · Nav (penjaga tombol kembali)
             Sesi (fokus sesi + kelasTersedia/klaimKelasSuper -- klaim bebas kelas Super Sesi)
             Formulir (simpan otomatis)
             SuperSesi (fokus Super Sesi milik kepala sekolah, poling pantau_super_sesi)
  lib/       useDesktop (breakpoint lg) · waktuSesi (useSisaDetik, menitDetik)
             sesiMurid (RPC murid + antrean offline) · sesiGuru (jawaban & veto)
             kunciLayar (sensor + fullscreen + wake lock) · sesiCapture (?sesi=)
             soal (masalahSoal = cermin validasi server, uuid) · tempelSoal (impor teks)
             imporPdf (panggil Edge Function impor-pdf)
             generateSoal (panggil Edge Function generate-soal, AI mengarang dari topik)
             sekolah (cek_kode_sekolah sebelum daftar, lihat Super Sesi)
  components/
    ui/      Button · Card · Badge · Dialog (lembar bawah di HP) · Input · Sakelar · Eyebrow · Ikon (SVG garis) · TeksOtomatis
    Gelembung (huruf opsi dalam lingkaran: kosong/dipilih/benar/salah/kunci, dipakai murid, editor guru, tinjauan nilai)
    Logo (lambang + nama) · LayarMurid (kartu kepala/soal, dipakai murid & pratinjau guru)
    BottomNav (HP: Riwayat · Menu · Saya, Sesi menumpang sorotan Menu) · SidebarGuru (desktop: Sesi & Super Sesi item sendiri)
    TabelDesktop (KepalaTabel/BarisTabel, grid CSS)
    BagikanSesi (kode + QR + link) · LembarKonfirmasi · ScannerQr · TombolZoom
  pages/
    auth/    AuthPages (login, daftar + Kode Sekolah, lupa & reset password) — guru & kepala sekolah
    guru/    GuruHome (shell bertab Riwayat · Menu · Saya + dua cabang layar penuh, dipakai guru DAN kepala sekolah)
             MenuPage (peluncur: kelas Super Sesi siap diambil · super sesi siap dimulai · sedang berjalan · ajakan formulir/sesi · bawa dari luar)
             SuperSesiPage (kepala sekolah saja: daftar Super Sesi -> DetailSuperSesi, dibuka dari kartu di Menu)
             RiwayatPage (arsip, pil Formulir/Sesi)
             ProfilePage (akun, sub Akun Saya)
             SesiPage (takeover: daftar sesi & kendali satu sesi) · LihatJawaban (ringkasan, murid, veto)
             EditorFormulir (layar penuh; desktop: rel + kartu + panel kirim) · TabPertanyaan · KartuPertanyaan · PanelEditor (RelPertanyaan, PanelKirim)
             TabSetelan · DialogKirim (Buka sesi ATAU kirim ke Super Sesi) · DialogImpor (3 cara: AI/teks/PDF) · Pratinjau
    kepsek/  DialogBuatSuperSesi · DetailSuperSesi (kiriman & status klaim, tombol Mulai) -- dipakai lewat SuperSesiPage di atas
    murid/   MuridHome (tanpa tab) · MuridSesiPage · KerjakanSesi
supabase/migrations/
  20260917000000_skema_awal.sql       # skema lengkap, lihat kepalanya
  20260917100000_murid_tanpa_akun.sql # M1, M2
  20260917200000_formulir.sql         # F1, F2, F3
  20260924000000_sekolah.sql          # tabel sekolah, profiles.sekolah_id, peran kepala_sekolah
  20260924100000_super_sesi.sql       # SS1-SS4, tabel super_sesi & super_sesi_soal, RPC
  20260924200000_pengajuan_kepsek.sql # (DIBONGKAR 20261001000000) tabel pengajuan_kepala_sekolah, adalah_admin_utama(), RPC
  20260924300000_pengawasan_super_sesi.sql # SS5-SS6, wewenang kunci layar pindah ke kepala sekolah
  20260924400000_admin_sekolah.sql    # (DIBONGKAR 20261001000000) ambil_semua_sekolah()/buat_sekolah()
  20260924500000_kepsek_guru_gabung.sql    # kepala sekolah pakai GuruHome yang sama dgn guru, longgarkan adalah_guru()
  20260925000000_klaim_kelas_super_sesi.sql # SS7-SS9, klaim bebas kelas Super Sesi menggantikan penugasan pengawas
  20261001000000_hapus_admin.sql      # membongkar pengajuan kepala sekolah & fungsi admin, lihat "Menyiapkan sekolah & kepala sekolah"
scripts/
  buat-kepala-sekolah.mjs             # pemilik produk: sekolah + akun kepala sekolah (service role), `npm run kepsek`
  env.rahasia.contoh                  # contoh .env.rahasia (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
supabase/functions/
  impor-pdf/index.ts                  # PDF -> soal lewat OpenRouter, lihat Impor PDF di atas
  generate-soal/index.ts              # topik -> soal lewat OpenRouter, lihat Generate dari Topik di atas
```

Tidak ada router. `AppScreen` (`types.ts`): `login | register | forgotPassword |
resetPassword | guru | murid`. Tanpa sesi login, layar awalnya `murid`
(pintu depan = kode sesi, dengan tautan "Kamu guru? Masuk"); murid anonim juga
`murid`, jadi membuat/membuang identitas tidak me-mount ulang MuridHome. Peran
`kepala_sekolah` memakai `GuruHome` yang SAMA dengan guru (`NavContext`
mengarahkan keduanya ke `{ name: 'guru' }`) — lihat "kepala sekolah berbagi
GuruHome" di bawah untuk kenapa ini berubah dari shell terpisah semula. Tab
bawah guru (Riwayat · Menu · Saya), id formulir yang sedang disunting layar
penuh (`editor`), dan `navHidden` (Sesi atau Akun Saya
sedang menumpang layar penuh) hidup di state lokal GuruHome — tidak ada
tautan dalam ke tab atau halaman mana pun. Fokus SATU sesi (dibuka dari
Menu/Riwayat) hidup di `SesiContext` sendiri (`fokus`/`fokuskan`), dibaca
`SesiPage` — bukan state lokal GuruHome, karena `DialogKirim` juga perlu
mengarahkan ke sesi yang baru lahir tanpa lebih dulu tahu tab mana yang
sedang aktif.

**Kepala sekolah berbagi GuruHome** (ditambah 2026-09-24, migrasi
`20260924500000_kepsek_guru_gabung.sql`): sebelumnya kepala sekolah dapat
`AppScreen` terpisah (`KepsekHome`) yang HANYA mengelola Super Sesi — begitu
`profiles.role` naik jadi `kepala_sekolah`, akun itu kehilangan `adalah_guru()`
ke formulir/bank_soal/sesi_kelas MILIKNYA SENDIRI yang dibuat waktu masih
`guru` (celah akses nyata, bukan cuma soal tampilan). Sekarang kepala sekolah
memakai `GuruHome` yang sama persis dengan guru (formulir & sesi sendiri
tetap jalan) — Menu-nya cuma dapat satu kartu tambahan "Super Sesi" di bawah
"Sesi" (`MenuPage.tsx`, dibuka lewat `SuperSesiPage.tsx`). `adalah_guru()`
dilonggarkan jadi `role in ('guru', 'kepala_sekolah')`; `adalah_kepsek()`
(siapa boleh KELOLA Super Sesi) TIDAK berubah, tetap murni `role =
'kepala_sekolah'` — dua fungsi ini sekarang boleh sama-sama true untuk satu
akun, dan itu memang maksudnya (termasuk yang membuat kepala sekolah ikut
lolos mengklaim kelas Super Sesi, lihat poin 4 di bawah).

**Simpan otomatis (FormulirContext):** layar menulis ke state lokal dulu; database
menyusul lewat SATU antrean berurutan (insert soal baru harus mendahului update
ketikan pertamanya). Ketikan di-debounce 600 ms per soal dan di-flush sebelum
pindah formulir, saat tab disembunyikan, dan sebelum Kirim (`simpanSekarang`). Id
soal dibuat di klien (`buatUuid`) supaya soal baru langsung bisa diketik.

**Tombol kembali:** GuruHome dan EditorFormulir punya dua `<Penjaga>` masing-
masing — anak pertama (diperiksa paling akhir) pulang ke tab/tab-dalam bawaan;
anak terakhir menutup dialog yang sedang terbuka. Penangan diperiksa dari yang
terakhir ter-mount. `EditorFormulir` sendiri adalah cabang render TERPISAH di
GuruHome (bukan lapisan `fixed`), jadi menutupnya lewat tombol kembali berarti
kembali ke bilah tab biasa. `SesiPage` dan `ProfilePage` (sub-halaman Akun Saya)
punya penangan `useKembali` sendiri-sendiri, sama pola dengan `LayarAktif` di
Luang: cuma tab yang SEDANG terlihat yang menanggapi tombol kembali, jadi satu
tekanan tidak pernah salah menutup lapisan di tab lain yang sedang tersembunyi.
`SuperSesiPage` (takeover dari kartu "Super Sesi" di Menu, sama pola dengan
`SesiPage`) punya `useKembali` sendiri yang menutup lapisan dari yang paling
atas (dialog buat → fokus Super Sesi), dan `DetailSuperSesi` menambah
lapisannya sendiri di atas itu untuk konfirmasi Mulai.

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

Baris di bawah (`SK*`/`SS*`) ditambahkan 2026-09-24 untuk Super Sesi — TIDAK
ada padanannya di Luang sama sekali, jadi penomorannya tidak perlu dicocokkan
ke sana seperti baris A/K/M/F di atas.

| SK1 | Peran `kepala_sekolah` HANYA lewat skrip pemilik (`scripts/buat-kepala-sekolah.mjs`, service role) atau SQL manual, tidak pernah dari metadata klien — `handle_new_user()` selalu menulis `'guru'` untuk akun non-anonim (M1 tetap berlaku) |
| SK2 | Guru/kepala sekolah non-anonim WAJIB `sekolah_id` terisi (`profiles_sekolah_wajib_staf`); `kode_sekolah` di metadata signup divalidasi di `handle_new_user()`, bukan dipercaya begitu saja |
| SK3 | (dihapus 2026-10-01 bersama peran admin; nomornya tidak dipakai ulang) |
| SS1 | Kiriman (`super_sesi_soal`) adalah SALINAN formulir saat dikirim (gaya A6) — mengedit/menghapus formulir sesudahnya tidak mengubahnya |
| SS2 | `mulai_super_sesi()` menulis `sesi_kelas.guru_id = pengawas_id`, BUKAN guru mapel pengirim — baris hasilnya sesi BIASA milik pengawas, langsung kena semua policy `sesi_kelas` yang sudah ada tanpa policy baru |
| SS3 | `sesi_kelas.super_sesi_id`/`super_sesi_judul` disalin saat distribusi supaya pengawas tahu asalnya TANPA akses ke tabel `super_sesi`/`super_sesi_soal` (yang secara struktural memang tidak mereka punya) |
| SS4 | Semua tulis ke `super_sesi_soal` lewat RPC security definer (gaya K7) — tidak ada policy INSERT/UPDATE langsung dari klien |
| SS5 | Untuk sesi hasil Super Sesi, `buka_kunci_murid()`/`buka_kunci_semua()`/`atur_kunci_layar()` (jalur guru) MENOLAK — wewenang kunci layar pindah seluruhnya ke `*_kepsek()`, supaya keputusan buka kunci konsisten antar kelas |
| SS6 | `pantau_super_sesi()` membawa laporan murid (kunci, keluar layar, hilang fokus) ke kepala sekolah lewat security definer — bukan RLS baru ke `sesi_murid`/`sesi_peristiwa`, sama alasan dengan SS3 |
| SS7 | `sesi_kelas.guru_id` BOLEH `null` HANYA untuk baris hasil Super Sesi yang belum diklaim (CHECK `sesi_kelas_guru_id_super_sesi`) — sesi biasa (`super_sesi_id` null) tetap WAJIB `guru_id` terisi, longgaran ini tidak menyentuh `buka_sesi_formulir()` sama sekali |
| SS8 | `ambil_kelas_tersedia_super_sesi()` (daftar kelas yang bisa diklaim, dilihat SEMUA guru sekolah) HANYA membawa metadata (mapel/kelas/judul) — TIDAK PERNAH `konten_list`, supaya kunci jawaban tidak terbaca sebelum ada yang benar-benar mengklaim |
| SS9 | `klaim_kelas_super_sesi()` atomik lewat `update ... where guru_id is null` — guru kedua yang mengklaim kelas yang sama nyaris bersamaan mendapat pesan jelas ("sudah diambil guru lain"), bukan tabrakan diam-diam |

Kunci efektif = sakelar darurat DAN `sesi_kelas.kunci_layar` DAN `terkunci_pada`
terisi. Kunci pertama baru bisa lahir 30 dtk (`kunci_layar_jeda_detik()`) setelah
kunci dinyalakan, supaya murid tidak terkunci oleh aturan yang belum ia lihat.

Pengujian: skema awal diuji di PGlite dengan skema `auth` tiruan (63 skenario:
RLS, A1, K7, jeda, veto, pemakaian ulang kode); M1/M2/F1–F3 plus alur murid anonim
dan backfill data lama diuji dengan cara yang sama (53 skenario); `uraikanTempelan`
(lib/tempelSoal.ts) diuji dengan teks contoh (12 skenario: pemisah baris kosong,
CRLF, baris sampah, blok kurang dari 2 opsi, batas 10 opsi, gaya bernomor dengan
baris kosong sebelum opsi, `1)`/`a)`, judul sebelum nomor pertama). Skema awal sudah
terpasang di project Supabase `lpddqyfarfdakmudfhbf`; `murid_tanpa_akun` dan
`formulir` BELUM.

**A3 tanpa akun murid lebih lemah dan itu disengaja.** Murid yang sudah mengirim
bisa bergabung lagi sebagai identitas baru (identitasnya dibuang sesudah dinilai;
mode privat juga cukup). Guru melihatnya sebagai dua baris dengan nama sama dan
bisa mem-veto. Pilihan sebaliknya (identitas dipertahankan) membuat murid kedua di
HP yang sama mewarisi jawaban & nilai murid pertama.

**Menghapus formulir tidak menghapus sesinya** (`sesi_kelas.formulir_id` on delete
set null). Sesi yatim itu tetap muncul sebagai baris biasa di layar Sesi maupun
pil Sesi di tab Riwayat (ditandai "formulir dihapus" di `SesiPage.tsx`/
`RiwayatPage.tsx`, lihat Struktur di atas) — tidak ada arsip terpisah lagi sejak
desain ulang 2026-09-22: layar Sesi tidak pernah berpusat pada satu formulir,
jadi sesi yatim tidak butuh tempat berbeda dari sesi lain.

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
- **Tampilan tidak lagi meniru Luang** sejak 2026-10-01 (lihat "Bahasa desain:
  Lembar Jawab"). Yang masih sama dengan Luang tinggal pola navigasinya.
- **Bilah tab Riwayat · Menu · Saya** SAMA namanya dengan Luang (redesain
  2026-09-22 menyalin shell itu utuh, sampai ke "Sesi menumpang sorotan Menu,
  bukan slot sendiri"), tapi ISI Menu jauh lebih sempit: tidak ada hub RPM,
  tidak ada grid LKPD/PPT/Game/Ujian/Raport — cuma blok "Sedang berjalan",
  ajakan "Formulir baru", baris "Atau bawa dari luar" (AI/tempel/PDF), dan
  kartu Sesi. Tidak ada blok "Lanjutkan" (daftar formulir terbaru) — dicoba
  lalu dibuang 2026-09-22 karena tumpang tindih dengan tab Riwayat; daftar
  formulir lengkap cuma di sana. Tidak ada lagi menambah/mengeluarkan
  grup soal di sesi yang sedang berjalan — sesi memuat seluruh formulir saat
  Kirim, dan sesi TIDAK PERNAH lahir dari layar Sesi (beda dari Luang yang
  punya FAB "+"/"Sesi baru" di sana) — satu-satunya jalan lahir adalah Kirim
  di editor formulir (F2).
- **Impor dari Google Form** lewat tempel teks, tanpa OAuth/API apa pun, DAN **Impor PDF**
  lewat AI di server (lihat penjelasan di atas). Luang tidak punya jalur impor ini
  sama sekali.
- **Generate dari Topik TANPA kredit/billing** — satu-satunya generator AI Luang
  yang ikut disalin (lihat pengecualian di bagian pembuka), tapi TANPA
  `useKreditGenerate`/Duitku Luang dan TANPA jalur "dari RPM/Modul"-nya (app ini
  tidak punya RPM/Modul sama sekali) — cuma topik bebas + jumlah + kesulitan.
- **Super Sesi, peran `kepala_sekolah`, dan tabel `sekolah`** (ditambah
  2026-09-24) — TIDAK ADA di Luang sama sekali, bukan porting dari mana pun.
  Lihat penjelasan lengkap di atas.
- **Murid tanpa akun** (Luang: murid mendaftar dengan email). Pendaftaran tidak
  lagi punya pilihan peran.
- Hapus pertanyaan tanpa konfirmasi, dengan "Urungkan" 6 detik — pola dari Google
  Form, dipertahankan lewat desain ulang 2026-09-22 karena masih pola yang paling
  aman untuk aksi yang sering ditekan tanpa sengaja, terlepas dari visualnya.
- "Akhiri sesi" minta konfirmasi; veto hanya menerima bilangan bulat 0–100.

## Yang belum ditangani
- Murid yang menutup aplikasi sebelum Kirim tidak punya baris nilai
  (`akhiri_sesi` tidak menyelesaikan murid yang tertinggal) — sama dengan Luang.
- Soal satu formulir dimuat tanpa paginasi; `max_rows` 1000 memotong diam-diam.
- Gambar di soal (termasuk dari impor Google Form/PDF) belum didukung — Impor PDF
  cuma mengambil teksnya, gambar di dalam PDF diabaikan AI.
- Impor PDF DAN Generate dari Topik sama-sama tidak punya batas biaya/kuota per
  guru — satu guru yang mengunggah PDF besar atau generate berkali-kali memakai
  kredit OpenRouter yang SAMA untuk semua guru (satu secret `OPENROUTER_API_KEY`,
  tanpa `useKreditGenerate` ala Luang). Generate lebih murah per panggilan (teks
  pendek vs PDF utuh) tapi tanpa gesekan biaya sama sekali di sisi guru, jadi
  risikonya lebih ke "dipakai berulang-ulang tanpa sadar" daripada satu unggahan besar.
- Tidak ada seret-lepas untuk mengurutkan soal; baru tombol naik/turun.
- Batas simpan log `sesi_peristiwa` (data perilaku anak, UU PDP).
- Akun anonim murid menumpuk di `auth.users` (satu per perangkat per sesi yang
  dikirim). JANGAN dibersihkan dengan menghapus usernya: `sesi_murid` &
  `jawaban_sesi` ber-`on delete cascade`, jadi jawaban di layar guru ikut hilang
  (`nilai_murid` selamat karena `set null`).
- CAPTCHA untuk login anonim (disarankan Supabase untuk mencegah pembuatan akun
  massal) — belum dipasang.
- PWA (manifest + service worker), hapus akun.
- `kode_sekolah` umur panjang, tanpa rotasi/kedaluwarsa (beda dari kode sesi 3
  jam) — bocor berarti orang luar bisa mendaftar jadi guru sekolah itu terus-
  menerus sampai diputar manual lewat SQL (`update sekolah set kode_sekolah=...`).
- Tidak ada UI untuk mengelola sekolah (ganti kode, ubah nama, hapus, pindahkan guru, ganti kepala sekolah): semuanya SQL editor manual oleh pemilik. Yang ada cuma skrip pembuat sekolah + kepala sekolah.
- Kelas Super Sesi yang tidak pernah diklaim guru mana pun tertinggal
  selamanya berstatus `aktif` tanpa pemilik: `akhiri_sesi()` mensyaratkan
  `guru_id = auth.uid()`, jadi TIDAK ADA yang bisa mengakhirinya selama belum
  diklaim. Kepala sekolah bisa melihatnya lewat `pantau_super_sesi()`
  (`pengawasNama` tetap kosong), tapi tidak ada tombol "batalkan kelas ini" di
  UI mana pun — jalan keluarnya masih SQL manual
  (`update sesi_kelas set status = 'selesai' where id = '...'`).
- `mulai_super_sesi()` sengaja TIDAK idempoten (beda dari A8) — panggilan
  kedua gagal jelas ("sudah dimulai") alih-alih diam-diam membuat sesi dobel;
  tombol "Mulai Super Sesi" di klien harus tetap disabled selama panggilan
  berjalan supaya ketukan ganda tidak memicu galat yang membingungkan.
