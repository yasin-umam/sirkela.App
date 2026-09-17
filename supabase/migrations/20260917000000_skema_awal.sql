-- ═══════════════════════════════════════════════════════════════════════════
-- Skema awal: Bank Soal + Sesi Kelas + Kunci Layar Sesi.
--
-- Disalin dari Luang (project dvcewdoxspunduwxaxrh) per 2026-09-17, diambil dari
-- definisi TERAKHIR tiap objek, bukan diputar ulang migration demi migration:
--
--   gabung_sesi, status_sesi, simpan_jawaban,
--   sesi_murid_terkunci, buka_kunci_*, atur_kunci_layar  <- 20260927000000_kunci_layar_sesi
--   catat_peristiwa, kunci_layar_jeda_detik,
--   catat_kunci_layar_sejak                               <- 20260928000000_kunci_layar_jeda
--   ambil_konten_sesi                                     <- 20260917000000_fix_ambil_konten_sesi_game
--   selesaikan_murid, set_nama_peserta                    <- 20260921000000_isi_nama_peserta_sesi
--   sesi_tenggat, sesi_peserta_terdaftar, denyut_sesi,
--   mulai_sesi, akhiri_sesi                               <- 20260805000000_sesi_fondasi
--
-- Yang SENGAJA berbeda dari Luang (skema baru, tidak ada data lama yang dijaga):
--   - nilai_murid.ujian_id + asal -> sesi_id ber-FK ke sesi_kelas. Kolom lama itu
--     sisa fitur Ujian yang sudah dibuang; di sini baris nilai HANYA lahir dari
--     sesi, jadi `asal` tidak membedakan apa pun.
--   - selesai_pada_ms (bigint epoch) -> selesai_pada (timestamptz), di sesi_kelas
--     maupun nilai_murid. Kolom mati (blocker_aktif, mulai_pada_ms) tidak ikut.
--   - Cabang LKPD & Game dibuang dari ambil_konten_sesi(); konten_list hanya
--     berisi tipe 'soal'.
--   - Jenis peristiwa milik aplikasi native Luang Sesi (split_screen, sematan_*)
--     dibuang: aplikasi itu memuat luang.online, tidak pernah aplikasi ini.
--   - profiles: klien hanya boleh MEMBACA profilnya dan mengubah `nama`. Luang
--     memakai `for all`, yang membuat akun murid bisa mengganti role-nya sendiri.
--   - bank_soal: CHECK kunci jawaban harus menunjuk pilihan yang ada. Soal kini
--     bisa diedit (dan nanti diimpor dari Google Form) -- kunci yang meleset dari
--     daftar pilihan akan dinilai salah untuk semua murid tanpa satu pun error.
--   - Tidak ada is_admin: sakelar darurat diubah lewat SQL editor dashboard.
--
-- Invarian yang ditegakkan di sini (penomoran sama dengan Luang):
--   A1  Kunci jawaban tidak pernah sampai ke perangkat murid.
--   A2  Kode sesi divalidasi hanya di server.
--   A3  Satu akun = satu kali join per sesi.
--   A4  Sinyal deteksi tidak pernah mengubah NILAI otomatis.
--   A5  Autosave idempoten.
--   A6  Konten sesi adalah snapshot, bukan referensi ke bank_soal.
--   A7  Waktu otoritatif dari server.
--   A8  Akhir sesi idempoten.
--   K1  Status kunci layar di server.
--   K2  Hanya guru pemilik sesi yang membuka kunci, lewat RPC.
--   K3  Kunci tidak menyentuh nilai.
--   K4  Kunci opt-in per sesi, bawaan mati.
--   K5  Keputusan mengunci hanya di catat_peristiwa().
--   K7  sesi_murid TIDAK BOLEH punya policy UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1. Profil ══════════════════════════════════════════════════════════════

create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  nama       text        not null,
  role       text        not null check (role in ('guru', 'murid')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- RLS memilih BARIS, bukan kolom. Tanpa grant per kolom ini, policy update di
-- atas ikut mengizinkan murid menulis `role = 'guru'` ke profilnya sendiri.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nama) on public.profiles to authenticated;

-- Profil lahir dari trigger, bukan dari klien. Role yang tidak dikenal jatuh ke
-- 'murid' (hak paling sempit), nama kosong tidak menggagalkan pendaftaran.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nama, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'nama'), ''), 'Pengguna'),
    case when new.raw_user_meta_data->>'role' = 'guru' then 'guru' else 'murid' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═══ 2. Bank Soal ═══════════════════════════════════════════════════════════

create table public.bank_soal (
  id            uuid        primary key default gen_random_uuid(),
  -- Default auth.uid(): insert dari klien tidak perlu mengirim pemilik.
  guru_id       uuid        not null default auth.uid()
                            references public.profiles(id) on delete cascade,
  pertanyaan    text        not null,
  pilihan       text[]      not null,
  jawaban_benar int         not null,
  mapel         text        not null default '',
  kelas         text        not null default '',
  jurusan       text        not null default '',
  -- Satu kali "Simpan" = satu kelompok di daftar Bank Soal & pemilih konten sesi.
  simpan_id     text,
  -- Urutan di dalam kelompok. WAJIB eksplisit sejak soal bisa diedit: satu
  -- insert memberi created_at yang sama ke semua barisnya, dan UPDATE menulis
  -- ulang baris ke posisi baru di heap -- tanpa kolom ini soal yang baru diedit
  -- pindah ke akhir kelompoknya setelah dimuat ulang.
  urutan        int         not null default 0,
  created_at    timestamptz not null default now(),
  constraint bank_soal_pilihan_cukup check (coalesce(array_length(pilihan, 1), 0) >= 2),
  constraint bank_soal_kunci_valid check (
    jawaban_benar >= 0 and jawaban_benar < coalesce(array_length(pilihan, 1), 0)
  )
);

create index bank_soal_guru_idx on public.bank_soal (guru_id, created_at desc);

alter table public.bank_soal enable row level security;

-- Tidak ada yang MERUJUK baris bank_soal: sesi menyalin soal ke konten_list (A6),
-- dan jawaban_sesi.soal_id teks tanpa FK. Mengedit atau menghapus soal di sini
-- tidak pernah mengubah sesi yang sudah memuatnya.
create policy "bank_soal_owner" on public.bank_soal
  for all using (auth.uid() = guru_id) with check (auth.uid() = guru_id);


-- ═══ 3. Sesi ════════════════════════════════════════════════════════════════

-- Singleton sakelar darurat. Risiko paling mungkin dari kunci layar bukan murid
-- curang, melainkan SATU KELAS terkunci serentak karena bug sensor. Mematikan
-- baris ini membebaskan semua murid di semua sesi tanpa rilis klien:
--   update public.pengaturan_sesi set kunci_layar_aktif = false where id = 1;
create table public.pengaturan_sesi (
  id                int         primary key default 1 check (id = 1),
  kunci_layar_aktif boolean     not null default true,
  diperbarui_pada   timestamptz not null default now()
);
alter table public.pengaturan_sesi enable row level security;
create policy "pengaturan_sesi_select" on public.pengaturan_sesi
  for select using (auth.role() = 'authenticated');
insert into public.pengaturan_sesi (id) values (1);

create table public.sesi_kelas (
  -- text, bukan uuid: klien mengisinya sendiri (crypto.randomUUID, dengan cadangan
  -- untuk dev server http tanpa secure context).
  id                text        primary key,
  guru_id           uuid        not null references auth.users(id) on delete cascade,
  judul             text        not null,
  -- Teks bebas. null = dikosongkan guru; layar merender "tanpa chip", bukan "-".
  mapel             text,
  kelas             text,
  durasi_menit      int         not null default 45 check (durasi_menit > 0),
  kode_join         text        not null,
  -- Jendela join. Lewat dari ini kode ditolak walau sesi masih aktif.
  kode_kedaluwarsa  timestamptz not null default now() + interval '3 hours',
  -- Snapshot soal LENGKAP dengan jawabanBenar (A6). Murid tidak pernah membaca
  -- kolom ini; kontennya keluar lewat ambil_konten_sesi() yang membuang kuncinya.
  konten_list       jsonb       not null default '[]'::jsonb,
  status            text        not null default 'aktif' check (status in ('aktif', 'selesai')),
  -- A7: diisi now() oleh mulai_sesi(), bukan jam HP guru.
  mulai_pada        timestamptz,
  selesai_pada      timestamptz,
  kunci_layar       boolean     not null default false,
  -- Diisi trigger di bawah. Dasar jeda sebelum kunci pertama bisa lahir.
  kunci_layar_sejak timestamptz,
  created_at        timestamptz not null default now()
);

create index sesi_kelas_guru_idx on public.sesi_kelas (guru_id, created_at desc);

-- Unik hanya di antara sesi AKTIF, dan ekspresinya WAJIB persis `upper(kode_join)`
-- seperti predikat di gabung_sesi() -- perencana query mencocokkan index ekspresi
-- secara harfiah. Tanpa keunikan ini, tabrakan kode membuat murid DIAM-DIAM masuk
-- ke sesi guru lain (gabung_sesi memakai limit 1).
create unique index sesi_kelas_kode_join_aktif_unik
  on public.sesi_kelas (upper(kode_join))
  where status = 'aktif';

create table public.sesi_murid (
  id              uuid        primary key default gen_random_uuid(),
  sesi_id         text        not null references public.sesi_kelas(id) on delete cascade,
  murid_id        uuid        not null references auth.users(id) on delete cascade,
  -- Diisi gabung_sesi() dari profil, lalu ditimpa nama yang diketik murid sendiri
  -- di layar "Siap memulai" (set_nama_peserta).
  nama            text        not null,
  joined_at       timestamptz not null default now(),
  -- Kolom yang DITIMPA, bukan baris baru di sesi_peristiwa: denyut tiap 20 detik
  -- x 30 murid akan menenggelamkan log pengawasan.
  terakhir_denyut timestamptz,
  -- Non-null = terkunci (K1). Timestamp supaya guru melihat "terkunci sejak".
  terkunci_pada   timestamptz,
  -- A3: menolak join kedua, apa pun jalurnya.
  constraint sesi_murid_unik unique (sesi_id, murid_id)
);

-- A5: PK gabungan membuat tiap autosave jadi upsert idempoten.
create table public.jawaban_sesi (
  sesi_id         text        not null references public.sesi_kelas(id) on delete cascade,
  murid_id        uuid        not null references auth.users(id)        on delete cascade,
  soal_id         text        not null,
  jawaban         int,
  diperbarui_pada timestamptz not null default now(),
  primary key (sesi_id, murid_id, soal_id)
);

-- A4: kesaksian untuk guru, bukan hakim. Append-only -- tidak ada policy
-- UPDATE/DELETE, dan tidak ada jalur yang membiarkan isinya menyentuh nilai.
create table public.sesi_peristiwa (
  id       uuid        primary key default gen_random_uuid(),
  sesi_id  text        not null references public.sesi_kelas(id) on delete cascade,
  murid_id uuid        not null references auth.users(id)        on delete cascade,
  jenis    text        not null check (jenis in (
    'tinggalkan_layar', 'kembali_layar',
    'hilang_fokus', 'kembali_fokus',
    'keluar_layar_penuh',          -- TIDAK mengunci (Back tak sengaja di fullscreen)
    'dikunci', 'dibuka_guru'       -- KHUSUS server, ditolak dari klien
  )),
  pada     timestamptz not null default now()
);

create index sesi_peristiwa_idx on public.sesi_peristiwa (sesi_id, murid_id, pada);

create table public.nilai_murid (
  id          uuid        primary key default gen_random_uuid(),
  sesi_id     text        not null references public.sesi_kelas(id) on delete cascade,
  -- set null, bukan cascade: akun murid yang dihapus tidak ikut menghapus
  -- rekap nilai guru (nama_murid sudah didenormalisasi).
  murid_id    uuid        references auth.users(id) on delete set null,
  -- Pemilik SESI, bukan murid -- supaya policy guru bisa membacanya.
  guru_id     uuid        not null references auth.users(id) on delete cascade,
  nama_murid  text        not null,
  nilai       int         not null check (nilai between 0 and 100),
  -- Nilai hasil veto tidak boleh diam-diam terlihat sama dengan hitungan otomatis.
  diubah_guru boolean     not null default false,
  selesai_pada timestamptz not null default now(),
  -- Idempotensi selesaikan_murid() bersandar di sini, bukan pengecekan di fungsi:
  -- dua tap "Kirim" tidak bisa melahirkan dua baris nilai.
  constraint nilai_murid_unik unique (sesi_id, murid_id)
);

-- Kunci jeda: guru juga menyalakan kunci lewat INSERT langsung saat membuat sesi,
-- jadi stempelnya diisi trigger, bukan di atur_kunci_layar(). Menyalakan ulang
-- yang sudah menyala TIDAK mengulang jeda.
create or replace function public.catat_kunci_layar_sejak()
returns trigger
language plpgsql
as $$
begin
  if new.kunci_layar then
    if tg_op = 'INSERT' or not coalesce(old.kunci_layar, false) then
      new.kunci_layar_sejak := now();
    end if;
  else
    new.kunci_layar_sejak := null;
  end if;
  return new;
end $$;

create trigger sesi_kelas_kunci_layar_sejak
  before insert or update of kunci_layar on public.sesi_kelas
  for each row execute function public.catat_kunci_layar_sejak();


-- ═══ 4. RLS sesi ════════════════════════════════════════════════════════════

alter table public.sesi_kelas     enable row level security;
alter table public.sesi_murid     enable row level security;
alter table public.jawaban_sesi   enable row level security;
alter table public.sesi_peristiwa enable row level security;
alter table public.nilai_murid    enable row level security;

-- sesi_kelas: HANYA guru pemilik. Tidak ada policy apa pun untuk murid -- itu
-- yang menegakkan A1 (RLS per-baris tidak bisa menyembunyikan konten_list saja).
create policy "sesi_kelas_guru_all" on public.sesi_kelas
  for all using (auth.uid() = guru_id) with check (auth.uid() = guru_id);

-- sesi_murid: guru membaca peserta sesinya, murid membaca barisnya sendiri
-- (Realtime pembukaan kunci). Tidak ada INSERT (join lewat gabung_sesi) dan
-- TIDAK ADA UPDATE (K7).
create policy "sesi_murid_guru_select" on public.sesi_murid
  for select using (
    exists (select 1 from public.sesi_kelas s
             where s.id = sesi_murid.sesi_id and s.guru_id = auth.uid())
  );
create policy "sesi_murid_self_select" on public.sesi_murid
  for select using (murid_id = auth.uid());

create policy "jawaban_sesi_guru_select" on public.jawaban_sesi
  for select using (
    exists (select 1 from public.sesi_kelas s
             where s.id = jawaban_sesi.sesi_id and s.guru_id = auth.uid())
  );

create policy "sesi_peristiwa_guru_select" on public.sesi_peristiwa
  for select using (
    exists (select 1 from public.sesi_kelas s
             where s.id = sesi_peristiwa.sesi_id and s.guru_id = auth.uid())
  );

-- nilai_murid: baris lahir dari selesaikan_murid() (security definer). Guru cuma
-- membaca dan mem-veto; tidak ada jalur insert/delete dari klien.
create policy "nilai_murid_guru_select" on public.nilai_murid
  for select using (auth.uid() = guru_id);
create policy "nilai_murid_guru_update" on public.nilai_murid
  for update using (auth.uid() = guru_id) with check (auth.uid() = guru_id);

-- Arah murid -> guru lewat Realtime (guru punya policy SELECT di keduanya).
-- Arah guru -> murid TIDAK lewat sini: murid tidak punya SELECT di sesi_kelas.
alter publication supabase_realtime add table public.sesi_murid, public.sesi_peristiwa;


-- ═══ 5. Fungsi bantu ════════════════════════════════════════════════════════

-- Tenggat DITURUNKAN, tidak disimpan. Menambah durasi_menit di tengah sesi =
-- perpanjangan waktu, tanpa fitur terpisah.
create or replace function public.sesi_tenggat(p_mulai timestamptz, p_durasi int)
returns timestamptz
language sql
immutable
as $$
  select p_mulai + make_interval(mins => p_durasi)
$$;

-- Cukup untuk satu jajak status murid (15 dtk) plus membaca pemberitahuannya.
create or replace function public.kunci_layar_jeda_detik()
returns int
language sql
immutable
as $$ select 30 $$;

create or replace function public.sesi_peserta_terdaftar(p_sesi_id text, p_murid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sesi_murid
     where sesi_id = p_sesi_id and murid_id = p_murid
  )
$$;

-- Satu definisi "terkunci": sakelar darurat DAN sakelar sesi DAN barisnya
-- terkunci. Mematikan salah satu sakelar membebaskan murid seketika.
create or replace function public.sesi_murid_terkunci(p_sesi_id text, p_murid_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.sesi_murid m
      join public.sesi_kelas s on s.id = m.sesi_id
      join public.pengaturan_sesi p on p.id = 1
     where m.sesi_id = p_sesi_id
       and m.murid_id = p_murid_id
       and m.terkunci_pada is not null
       and s.kunci_layar
       and p.kunci_layar_aktif
  )
$$;


-- ═══ 6. RPC murid ═══════════════════════════════════════════════════════════
-- Semua security definer, jadi SETIAP fungsi memeriksa otorisasinya sendiri.

-- Satu-satunya pintu masuk murid. Mengembalikan sesi TANPA konten_list dan TANPA
-- kode_join. `sekarang_server` supaya klien mengukur selisih jamnya sekali (A7).
create or replace function public.gabung_sesi(p_kode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesi   public.sesi_kelas;
  v_nama   text;
  v_global boolean;
begin
  if auth.uid() is null then
    raise exception 'Harus login dulu' using errcode = '28000';
  end if;

  -- `status = 'aktif'` di pencarian, BUKAN diperiksa sesudahnya seperti di Luang:
  -- kode hanya unik di antara sesi aktif, jadi sesi lama yang sudah selesai boleh
  -- memakai kode yang sama. Tanpa saringan ini `limit 1` bisa memungut sesi lama
  -- itu dan menolak murid dengan "Sesi sudah berakhir" padahal sesinya berjalan.
  select * into v_sesi
    from public.sesi_kelas
   where upper(kode_join) = upper(btrim(p_kode))
     and status = 'aktif'
   limit 1;

  if not found then
    -- Sesi selesai dan kode yang tidak pernah ada sengaja dibedakan: murid yang
    -- telat perlu tahu sesinya sudah ditutup, bukan mengira salah ketik.
    if exists (select 1 from public.sesi_kelas where upper(kode_join) = upper(btrim(p_kode))) then
      raise exception 'Sesi sudah berakhir' using errcode = 'P0002';
    end if;
    raise exception 'Kode sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if now() > v_sesi.kode_kedaluwarsa then
    raise exception 'Kode sesi sudah kedaluwarsa' using errcode = 'P0002';
  end if;

  select nama into v_nama from public.profiles where id = auth.uid();

  insert into public.sesi_murid (sesi_id, murid_id, nama)
  values (v_sesi.id, auth.uid(), coalesce(nullif(btrim(v_nama), ''), 'Murid'))
  on conflict (sesi_id, murid_id) do nothing;

  select coalesce((select kunci_layar_aktif from public.pengaturan_sesi where id = 1), true)
    into v_global;

  return jsonb_build_object(
    'id',              v_sesi.id,
    'judul',           v_sesi.judul,
    'durasi_menit',    v_sesi.durasi_menit,
    'status',          v_sesi.status,
    'mulai_pada',      v_sesi.mulai_pada,
    'tenggat',         case when v_sesi.mulai_pada is null then null
                            else public.sesi_tenggat(v_sesi.mulai_pada, v_sesi.durasi_menit) end,
    'jumlah_konten',   jsonb_array_length(v_sesi.konten_list),
    -- Dibawa sejak join supaya layar "Siap memulai" menjelaskan aturan kunci
    -- SEBELUM murid menekan Mulai.
    'kunci_layar',     v_sesi.kunci_layar and v_global,
    'sekarang_server', now()
  );
end $$;

-- Murid mengonfirmasi/mengganti namanya sendiri (HP/akun yang dipakai bergantian).
create or replace function public.set_nama_peserta(p_sesi_id text, p_nama text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sesi_peserta_terdaftar(p_sesi_id, auth.uid()) then
    raise exception 'Bukan peserta sesi ini' using errcode = '42501';
  end if;
  if btrim(coalesce(p_nama, '')) = '' then
    raise exception 'Nama tidak boleh kosong' using errcode = '22023';
  end if;

  update public.sesi_murid
     set nama = btrim(p_nama)
   where sesi_id = p_sesi_id and murid_id = auth.uid();
end $$;

-- RPC ringan yang dijajak murid, bukan Realtime: murid tidak punya SELECT di
-- sesi_kelas (A1). `versi_konten` = sidik jari, murid menarik isi lengkap hanya
-- kalau berbeda. `kunci_layar` = nilai EFEKTIF (sakelar sesi DAN darurat).
create or replace function public.status_sesi(p_sesi_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesi      public.sesi_kelas;
  v_global    boolean;
  v_terkunci  boolean;
  v_kunci_pad timestamptz;
begin
  if not public.sesi_peserta_terdaftar(p_sesi_id, auth.uid()) then
    raise exception 'Bukan peserta sesi ini' using errcode = '42501';
  end if;

  select * into v_sesi from public.sesi_kelas where id = p_sesi_id;
  if not found then
    raise exception 'Sesi tidak ditemukan' using errcode = 'P0002';
  end if;

  select coalesce((select kunci_layar_aktif from public.pengaturan_sesi where id = 1), true)
    into v_global;
  v_terkunci := public.sesi_murid_terkunci(p_sesi_id, auth.uid());
  if v_terkunci then
    select terkunci_pada into v_kunci_pad from public.sesi_murid
     where sesi_id = p_sesi_id and murid_id = auth.uid();
  end if;

  return jsonb_build_object(
    'status',          v_sesi.status,
    'mulai_pada',      v_sesi.mulai_pada,
    'tenggat',         case when v_sesi.mulai_pada is null then null
                            else public.sesi_tenggat(v_sesi.mulai_pada, v_sesi.durasi_menit) end,
    'versi_konten',    md5(coalesce(v_sesi.konten_list, '[]'::jsonb)::text),
    'kunci_layar',     v_sesi.kunci_layar and v_global,
    'terkunci',        v_terkunci,
    'terkunci_pada',   v_kunci_pad,
    'sekarang_server', now()
  );
end $$;

-- A1 dijalankan di sini: `s - 'jawabanBenar'` membuang kunci SEBELUM meninggalkan
-- server. `jsonb_typeof` tetap dijaga walau konten_list cuma berisi soal: baris
-- yang ditulis klien tidak dipercaya bentuknya, dan jsonb_array_elements atas
-- objek meledakkan SELURUH daftar, bukan satu item.
create or replace function public.ambil_konten_sesi(p_sesi_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesi   public.sesi_kelas;
  v_konten jsonb;
begin
  if not public.sesi_peserta_terdaftar(p_sesi_id, auth.uid()) then
    raise exception 'Bukan peserta sesi ini' using errcode = '42501';
  end if;

  select * into v_sesi from public.sesi_kelas where id = p_sesi_id;
  if not found or v_sesi.status <> 'aktif' then
    raise exception 'Sesi tidak aktif' using errcode = 'P0002';
  end if;

  -- Tipe apa pun selain soal tidak punya bentuk yang diketahui aman dikirim ke
  -- murid, jadi disaring keluar, bukan diteruskan apa adanya seperti di Luang.
  select coalesce(jsonb_agg(
           jsonb_set(k, '{data}', (
             select coalesce(jsonb_agg(s - 'jawabanBenar'), '[]'::jsonb)
               from jsonb_array_elements(k->'data') s
           ))
           order by idx
         ) filter (where k->>'tipe' = 'soal' and jsonb_typeof(k->'data') = 'array'), '[]'::jsonb)
    into v_konten
    from jsonb_array_elements(v_sesi.konten_list) with ordinality as t(k, idx);

  return jsonb_build_object(
    'konten',            v_konten,
    'jawaban_tersimpan', (
      select coalesce(jsonb_object_agg(soal_id, jawaban), '{}'::jsonb)
        from public.jawaban_sesi
       where sesi_id = p_sesi_id and murid_id = auth.uid() and jawaban is not null
    ),
    -- Dari konten_list MENTAH, sama persis dengan status_sesi -- kalau salah
    -- satunya memakai versi terpangkas, keduanya tidak pernah cocok dan murid
    -- menarik ulang isi sesi tiap 15 detik selamanya.
    'versi_konten',      md5(coalesce(v_sesi.konten_list, '[]'::jsonb)::text),
    'sekarang_server',   now()
  );
end $$;

create or replace function public.simpan_jawaban(p_sesi_id text, p_soal_id text, p_jawaban int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_sesi public.sesi_kelas;
begin
  if not public.sesi_peserta_terdaftar(p_sesi_id, auth.uid()) then
    raise exception 'Bukan peserta sesi ini' using errcode = '42501';
  end if;

  select * into v_sesi from public.sesi_kelas where id = p_sesi_id;
  if not found or v_sesi.status <> 'aktif' then
    raise exception 'Sesi sudah berakhir' using errcode = 'P0002';
  end if;
  if v_sesi.mulai_pada is not null
     and now() > public.sesi_tenggat(v_sesi.mulai_pada, v_sesi.durasi_menit) then
    raise exception 'Waktu sudah habis' using errcode = 'P0002';
  end if;
  -- Tetap perlu walau layar murid menutup soalnya: layar bisa dilewati klien yang
  -- dimodifikasi (K1). Jawaban yang tertolak tetap di antrean klien dan terkirim
  -- ulang setelah dibuka.
  if public.sesi_murid_terkunci(p_sesi_id, auth.uid()) then
    raise exception 'Layar terkunci — minta gurumu membukanya' using errcode = 'P0001';
  end if;

  insert into public.jawaban_sesi (sesi_id, murid_id, soal_id, jawaban)
  values (p_sesi_id, auth.uid(), p_soal_id, p_jawaban)
  on conflict (sesi_id, murid_id, soal_id)
  do update set jawaban = excluded.jawaban, diperbarui_pada = now();
end $$;

-- K5: satu-satunya tempat keputusan mengunci.
create or replace function public.catat_peristiwa(p_sesi_id text, p_jenis text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sesi_peserta_terdaftar(p_sesi_id, auth.uid()) then
    raise exception 'Bukan peserta sesi ini' using errcode = '42501';
  end if;
  -- Tanpa ini murid bisa memalsukan jejak "dibuka guru" di log kesaksian.
  if p_jenis in ('dikunci', 'dibuka_guru') then
    raise exception 'Jenis peristiwa khusus server' using errcode = '42501';
  end if;

  -- Batas laju membatasi PENCATATAN saja; cabang kunci di bawah tetap jalan,
  -- supaya membanjiri log tidak jadi cara menghindari kunci.
  if (select count(*) from public.sesi_peristiwa
       where sesi_id = p_sesi_id and murid_id = auth.uid()
         and pada > now() - interval '1 minute') < 30 then
    insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
    values (p_sesi_id, auth.uid(), p_jenis);
  end if;

  -- Cermin klien: JENIS_PENGUNCI di src/lib/kunciLayar.ts. Ubah keduanya bersamaan.
  if p_jenis in ('tinggalkan_layar', 'hilang_fokus')
     and exists (select 1 from public.pengaturan_sesi where id = 1 and kunci_layar_aktif)
     and exists (select 1 from public.sesi_kelas s
                  where s.id = p_sesi_id and s.kunci_layar
                    and s.status = 'aktif' and s.mulai_pada is not null
                    -- Jeda: murid yang HP-nya belum tahu kunci baru menyala tidak
                    -- boleh terkunci oleh aturan yang belum pernah ia lihat.
                    and now() >= coalesce(s.kunci_layar_sejak, '-infinity'::timestamptz)
                                 + make_interval(secs => public.kunci_layar_jeda_detik()))
     -- Sudah mengirim jawaban = tidak ada lagi yang perlu dijaga.
     and not exists (select 1 from public.nilai_murid n
                      where n.sesi_id = p_sesi_id and n.murid_id = auth.uid())
  then
    -- Idempoten: sepuluh peristiwa beruntun = satu kunci, satu baris 'dikunci'.
    update public.sesi_murid
       set terkunci_pada = now()
     where sesi_id = p_sesi_id and murid_id = auth.uid()
       and terkunci_pada is null;
    if found then
      insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
      values (p_sesi_id, auth.uid(), 'dikunci');
    end if;
  end if;
end $$;

-- Heartbeat kehadiran. Kesaksian saja (A4).
create or replace function public.denyut_sesi(p_sesi_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sesi_murid
     set terakhir_denyut = now()
   where sesi_id = p_sesi_id and murid_id = auth.uid();
end $$;

-- Penilaian di server -- konsekuensi langsung A1: perangkat murid tidak pernah
-- memegang kunci. Tetap jalan untuk murid yang terkunci (K3).
create or replace function public.selesaikan_murid(p_sesi_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesi  public.sesi_kelas;
  v_nama  text;
  v_benar int := 0;
  v_total int := 0;
  v_nilai int;
begin
  if not public.sesi_peserta_terdaftar(p_sesi_id, auth.uid()) then
    raise exception 'Bukan peserta sesi ini' using errcode = '42501';
  end if;

  select * into v_sesi from public.sesi_kelas where id = p_sesi_id;
  if not found then
    raise exception 'Sesi tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Kunci dibaca dari konten_list (A6), bukan bank_soal: soal yang diedit guru
  -- setelah sesi berjalan tidak boleh mengubah penilaian sesi itu.
  -- Soal duplikat (grup yang sama ditempel dua kali) menggandakan pembilang DAN
  -- penyebut, jadi persentasenya tetap benar.
  select count(*)::int,
         count(*) filter (where (s->>'jawabanBenar')::int = j.jawaban)::int
    into v_total, v_benar
    from jsonb_array_elements(v_sesi.konten_list) k
    cross join lateral jsonb_array_elements(
      case when k->>'tipe' = 'soal' and jsonb_typeof(k->'data') = 'array'
           then k->'data' else '[]'::jsonb end) s
    left join public.jawaban_sesi j
           on j.sesi_id  = p_sesi_id
          and j.murid_id = auth.uid()
          and j.soal_id  = s->>'id';

  v_nilai := case when v_total = 0 then 0
                  else round(v_benar::numeric * 100 / v_total)::int end;

  -- Nama yang diketik murid di sesi ini, bukan nama akun.
  select nama into v_nama from public.sesi_murid
   where sesi_id = p_sesi_id and murid_id = auth.uid();

  insert into public.nilai_murid (sesi_id, murid_id, guru_id, nama_murid, nilai)
  values (p_sesi_id, auth.uid(), v_sesi.guru_id,
          coalesce(nullif(btrim(v_nama), ''), 'Murid'), v_nilai)
  on conflict (sesi_id, murid_id) do nothing;

  -- Kiriman kedua mengembalikan nilai yang PERTAMA tercatat (atau hasil veto).
  select nilai into v_nilai
    from public.nilai_murid
   where sesi_id = p_sesi_id and murid_id = auth.uid();

  return jsonb_build_object('nilai', v_nilai, 'benar', v_benar, 'total', v_total);
end $$;


-- ═══ 7. RPC guru ════════════════════════════════════════════════════════════

create or replace function public.mulai_sesi(p_sesi_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_sesi public.sesi_kelas;
begin
  update public.sesi_kelas
     set mulai_pada = now()
   where id = p_sesi_id
     and guru_id = auth.uid()
     and status = 'aktif'
     and mulai_pada is null        -- A8: tekan dua kali tidak me-reset timer
  returning * into v_sesi;

  if not found then
    select * into v_sesi from public.sesi_kelas
     where id = p_sesi_id and guru_id = auth.uid();
    if not found then
      raise exception 'Sesi tidak ditemukan' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'mulai_pada',      v_sesi.mulai_pada,
    'tenggat',         case when v_sesi.mulai_pada is null then null
                            else public.sesi_tenggat(v_sesi.mulai_pada, v_sesi.durasi_menit) end,
    'sekarang_server', now()
  );
end $$;

-- A8: guard `status = 'aktif'` membuat fungsi ini idempoten.
create or replace function public.akhiri_sesi(p_sesi_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_selesai timestamptz;
begin
  update public.sesi_kelas
     set status = 'selesai',
         selesai_pada = now()
   where id = p_sesi_id
     and guru_id = auth.uid()
     and status = 'aktif'
  returning selesai_pada into v_selesai;

  return jsonb_build_object('selesai_pada', v_selesai);
end $$;

create or replace function public.buka_kunci_murid(p_sesi_id text, p_murid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.sesi_kelas
                  where id = p_sesi_id and guru_id = auth.uid()) then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;

  update public.sesi_murid
     set terkunci_pada = null
   where sesi_id = p_sesi_id and murid_id = p_murid_id
     and terkunci_pada is not null;
  if found then
    insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
    values (p_sesi_id, p_murid_id, 'dibuka_guru');
  end if;
end $$;

-- Jalan keluar kalau satu kelas terkunci serentak.
create or replace function public.buka_kunci_semua(p_sesi_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_jumlah int;
begin
  if not exists (select 1 from public.sesi_kelas
                  where id = p_sesi_id and guru_id = auth.uid()) then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;

  with dibuka as (
    update public.sesi_murid
       set terkunci_pada = null
     where sesi_id = p_sesi_id and terkunci_pada is not null
    returning murid_id
  ), dicatat as (
    insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
    select p_sesi_id, murid_id, 'dibuka_guru' from dibuka
    returning 1
  )
  select count(*)::int into v_jumlah from dicatat;

  return v_jumlah;
end $$;

-- Mematikan = membebaskan semua yang sedang terkunci, bukan cuma mencegah kunci
-- baru: guru yang mematikannya di tengah jalan hampir pasti sedang menghadapi
-- kelas yang terkunci karena alasan yang tidak ia duga.
create or replace function public.atur_kunci_layar(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sesi_kelas
     set kunci_layar = p_aktif
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;

  if not p_aktif then
    perform public.buka_kunci_semua(p_sesi_id);
  end if;
end $$;


-- ═══ 8. Hak eksekusi ════════════════════════════════════════════════════════
-- `revoke ... from public` saja TIDAK CUKUP di Supabase: default privileges
-- memberi EXECUTE ke anon secara LANGSUNG. anon dicabut namanya eksplisit.
do $$
declare f text;
begin
  foreach f in array array[
    'gabung_sesi(text)', 'set_nama_peserta(text,text)', 'status_sesi(text)',
    'ambil_konten_sesi(text)', 'simpan_jawaban(text,text,int)',
    'catat_peristiwa(text,text)', 'denyut_sesi(text)', 'selesaikan_murid(text)',
    'mulai_sesi(text)', 'akhiri_sesi(text)',
    'buka_kunci_murid(text,uuid)', 'buka_kunci_semua(text)', 'atur_kunci_layar(text,boolean)',
    'sesi_peserta_terdaftar(text,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Internal: dipanggil fungsi security definer lain saja.
revoke all on function public.sesi_murid_terkunci(text, uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
