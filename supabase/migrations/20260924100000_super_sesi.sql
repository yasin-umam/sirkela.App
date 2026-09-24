-- ═══ Super Sesi: ulangan lintas guru, dikelola kepala sekolah ═══════════════
-- Saat ulangan semester, guru yang mengawas di kelas biasanya BUKAN guru mapel
-- yang menulis soalnya. Super Sesi memisahkan "siapa menulis soal" dari "siapa
-- menjalankan sesi di kelas": guru mapel mengirim formulir ke Super Sesi milik
-- kepala sekolah, kepala sekolah menugaskan pengawas per kiriman, lalu satu
-- panggilan mulai_super_sesi() mendistribusikannya jadi sesi_kelas BIASA milik
-- masing-masing pengawas -- sesudah itu semua mekanisme sesi yang sudah ada
-- (mulai sesi, kunci layar, veto nilai) jalan tanpa perubahan sama sekali,
-- karena baris hasilnya tidak bisa dibedakan dari sesi yang dibuka sendiri oleh
-- pengawas lewat buka_sesi_formulir(). Lihat CLAUDE.md untuk alur lengkapnya.
--
-- ═══ Aturan baru ═════════════════════════════════════════════════════════════
--   SS1  Kiriman (super_sesi_soal) adalah SALINAN formulir saat dikirim (gaya
--        A6) -- mengedit/menghapus formulir sesudah dikirim tidak mengubahnya.
--   SS2  mulai_super_sesi() menulis sesi_kelas.guru_id = pengawas_id, BUKAN
--        guru_mapel_id. Baris hasilnya sesi BIASA milik pengawas: policy
--        sesi_kelas_guru_all yang sudah ada langsung memberi akses penuh
--        (kendali, kunci layar, veto) tanpa policy baru apa pun.
--   SS3  sesi_kelas.super_sesi_id + super_sesi_judul disalin ke baris saat
--        distribusi supaya pengawas bisa menampilkan asalnya tanpa pernah
--        butuh akses ke tabel super_sesi/super_sesi_soal (yang secara
--        struktural memang tidak mereka punya).
--   SS4  Semua tulis ke super_sesi_soal lewat RPC security definer (gaya K7) --
--        tidak ada policy INSERT/UPDATE langsung dari klien.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1. Fungsi bersama, difaktor keluar dari buka_sesi_formulir() ═══════════
-- Dipakai ulang oleh kirim_ke_super_sesi() (validasi & snapshot) dan
-- mulai_super_sesi() (kode join) supaya logikanya TIDAK diduplikasi.

create or replace function public.masalah_soal_formulir(p_formulir_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select format('Soal nomor %s: %s', n, alasan)
    from (
      select row_number() over (order by urutan, created_at) as n,
             case
               when btrim(pertanyaan) = '' then 'pertanyaan masih kosong'
               when coalesce(array_length(pilihan, 1), 0) < 2 then 'butuh minimal 2 opsi'
               when exists (select 1 from unnest(pilihan) p where btrim(p) = '') then 'ada opsi yang masih kosong'
               when jawaban_benar is null then 'kunci jawaban belum dipilih'
             end as alasan
        from public.bank_soal
       where formulir_id = p_formulir_id
    ) t
   where alasan is not null
   order by n
   limit 1
$$;

create or replace function public.rakit_snapshot_soal(p_formulir_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_agg(jsonb_build_object(
           'id',           id::text,
           'pertanyaan',   btrim(pertanyaan),
           'pilihan',      to_jsonb(pilihan),
           'jawabanBenar', jawaban_benar
         ) order by urutan, created_at)
    from public.bank_soal
   where formulir_id = p_formulir_id
$$;

create or replace function public.buat_kode_sesi_acak()
returns text
language plpgsql
volatile
as $$
declare
  -- Tanpa I, O, 0, 1 -- huruf yang paling sering salah dieja di depan kelas.
  v_huruf constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  return (select string_agg(substr(v_huruf, 1 + floor(random() * length(v_huruf))::int, 1), '')
            from generate_series(1, 3))
      || '-'
      || (select string_agg(substr(v_huruf, 1 + floor(random() * length(v_huruf))::int, 1), '')
            from generate_series(1, 3));
end $$;

revoke all on function public.masalah_soal_formulir(uuid) from public, anon, authenticated;
revoke all on function public.rakit_snapshot_soal(uuid) from public, anon, authenticated;
revoke all on function public.buat_kode_sesi_acak() from public, anon, authenticated;

-- buka_sesi_formulir() diganti PERSIS sama, cuma tiga baris yang sekarang
-- memanggil fungsi di atas -- loop retry, insert, dan exception handling tidak
-- berubah sama sekali dari 20260917200000_formulir.sql.
create or replace function public.buka_sesi_formulir(p_formulir_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form    public.formulir;
  v_masalah text;
  v_soal    jsonb;
  v_id      text := gen_random_uuid()::text;
  v_judul   text;
  v_kode    text;
  v_sesi    public.sesi_kelas;
begin
  if not public.adalah_guru() then
    raise exception 'Hanya guru yang bisa membuka sesi' using errcode = '42501';
  end if;

  select * into v_form from public.formulir
   where id = p_formulir_id and guru_id = auth.uid();
  if not found then
    raise exception 'Formulir tidak ditemukan' using errcode = 'P0002';
  end if;

  v_masalah := public.masalah_soal_formulir(p_formulir_id);
  if v_masalah is not null then
    raise exception '%', v_masalah using errcode = '22023';
  end if;

  v_soal := public.rakit_snapshot_soal(p_formulir_id);
  if v_soal is null then
    raise exception 'Formulir belum berisi soal' using errcode = '22023';
  end if;

  v_judul := coalesce(nullif(btrim(v_form.judul), ''), 'Formulir tanpa judul');

  -- Kode hanya unik di antara sesi aktif (sesi_kelas_kode_join_aktif_unik).
  -- Tabrakan diulang di sini, bukan dilempar ke guru sebagai "coba lagi".
  for i in 1..10 loop
    v_kode := public.buat_kode_sesi_acak();
    begin
      insert into public.sesi_kelas (
        id, guru_id, formulir_id, judul, deskripsi, durasi_menit, kode_join, konten_list, kunci_layar
      ) values (
        v_id, auth.uid(), v_form.id, v_judul, btrim(v_form.deskripsi), v_form.durasi_menit, v_kode,
        jsonb_build_array(jsonb_build_object(
          'id', 'konten-' || v_id, 'tipe', 'soal', 'judul', v_judul, 'data', v_soal
        )),
        v_form.kunci_layar
      )
      returning * into v_sesi;
      exit;
    exception when unique_violation then
      if i = 10 then raise; end if;
    end;
  end loop;

  return to_jsonb(v_sesi);
end $$;

revoke all on function public.buka_sesi_formulir(uuid) from public, anon;
grant execute on function public.buka_sesi_formulir(uuid) to authenticated;


-- ═══ 2. Tabel super_sesi & super_sesi_soal ═══════════════════════════════════

create table public.super_sesi (
  id          uuid        primary key default gen_random_uuid(),
  sekolah_id  uuid        not null default public.sekolah_saya() references public.sekolah(id) on delete cascade,
  kepsek_id   uuid        not null default auth.uid() references public.profiles(id) on delete cascade,
  judul       text        not null default 'Super Sesi tanpa judul',
  deskripsi   text        not null default '',
  status      text        not null default 'mengumpulkan' check (status in ('mengumpulkan', 'berjalan', 'selesai')),
  mulai_pada  timestamptz,
  created_at  timestamptz not null default now()
);

create index super_sesi_kepsek_idx on public.super_sesi (kepsek_id, created_at desc);
create index super_sesi_sekolah_status_idx on public.super_sesi (sekolah_id, status);

alter table public.super_sesi enable row level security;

-- SS1: snapshot dari formulir saat dikirim, sama gaya dengan sesi_kelas.konten_list.
create table public.super_sesi_soal (
  id            uuid        primary key default gen_random_uuid(),
  super_sesi_id uuid        not null references public.super_sesi(id) on delete cascade,
  formulir_id   uuid        references public.formulir(id) on delete set null,
  guru_mapel_id uuid        not null default auth.uid() references public.profiles(id) on delete cascade,
  judul         text        not null,
  deskripsi     text        not null default '',
  kelas         text        not null default '',
  mapel         text        not null default '',
  durasi_menit  int         not null check (durasi_menit between 1 and 600),
  kunci_layar   boolean     not null default false,
  konten_list   jsonb       not null default '[]'::jsonb,
  pengawas_id   uuid        references public.profiles(id) on delete set null,
  -- Terisi begitu mulai_super_sesi() mendistribusikannya (SS2).
  sesi_id       text        references public.sesi_kelas(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint super_sesi_soal_satu_per_formulir unique (super_sesi_id, formulir_id)
);

create index super_sesi_soal_super_sesi_idx on public.super_sesi_soal (super_sesi_id, created_at);
create index super_sesi_soal_guru_idx on public.super_sesi_soal (guru_mapel_id, created_at desc);

alter table public.super_sesi_soal enable row level security;

-- SS3: pengawas menemukan sesi hasil distribusi lewat query sesi_kelas MEREKA
-- SENDIRI yang sudah ada (guru_id = auth.uid()) -- tanpa kolom ini mereka harus
-- diberi akses baca ke super_sesi/super_sesi_soal, padahal mereka bukan
-- kepsek pemiliknya maupun guru_mapel_id pengirimnya.
alter table public.sesi_kelas
  add column super_sesi_id    uuid references public.super_sesi(id) on delete set null,
  add column super_sesi_judul text;

create index sesi_kelas_super_sesi_idx on public.sesi_kelas (super_sesi_id) where super_sesi_id is not null;


-- ═══ 3. RLS ═══════════════════════════════════════════════════════════════

create policy "super_sesi_kepsek_all" on public.super_sesi
  for all using (auth.uid() = kepsek_id) with check (auth.uid() = kepsek_id);

-- Guru mapel perlu melihat Super Sesi yang MASIH menerima kiriman di
-- sekolahnya sendiri, supaya DialogKirim bisa menawarkannya sebagai tujuan.
create policy "super_sesi_guru_lihat_terbuka" on public.super_sesi
  for select to authenticated
  using (status = 'mengumpulkan' and sekolah_id = (select public.sekolah_saya()));

-- Restrictive HANYA di insert/update/delete, BUKAN `for all` seperti pola M2 --
-- restrictive di-AND-kan per PERINTAH termasuk SELECT, jadi `for all` di sini
-- akan ikut memblokir policy SELECT guru mapel di atas.
create policy "super_sesi_tulis_hanya_kepsek" on public.super_sesi
  as restrictive
  for insert to authenticated
  with check ((select public.adalah_kepsek()));
create policy "super_sesi_ubah_hanya_kepsek" on public.super_sesi
  as restrictive
  for update to authenticated
  using ((select public.adalah_kepsek()))
  with check ((select public.adalah_kepsek()));
create policy "super_sesi_hapus_hanya_kepsek" on public.super_sesi
  as restrictive
  for delete to authenticated
  using ((select public.adalah_kepsek()));

-- SS4: super_sesi_soal tanpa policy INSERT/UPDATE sama sekali -- semua tulis
-- lewat RPC di bawah (gaya K7).
create policy "super_sesi_soal_guru_select" on public.super_sesi_soal
  for select using (auth.uid() = guru_mapel_id);
create policy "super_sesi_soal_kepsek_select" on public.super_sesi_soal
  for select using (exists (
    select 1 from public.super_sesi ss
     where ss.id = super_sesi_soal.super_sesi_id and ss.kepsek_id = auth.uid()
  ));

-- Guru mapel bisa menarik kiriman SENDIRI selama belum didistribusikan dan
-- Super Sesi-nya masih menerima kiriman.
create policy "super_sesi_soal_guru_hapus_sendiri" on public.super_sesi_soal
  for delete using (
    auth.uid() = guru_mapel_id and sesi_id is null
    and exists (
      select 1 from public.super_sesi ss
       where ss.id = super_sesi_soal.super_sesi_id and ss.status = 'mengumpulkan'
    )
  );
create policy "super_sesi_soal_hapus_hanya_guru" on public.super_sesi_soal
  as restrictive
  for delete to authenticated
  using ((select public.adalah_guru()));

revoke insert, update on public.super_sesi_soal from anon, authenticated;


-- ═══ 4. RPC ═══════════════════════════════════════════════════════════════

-- Kepala sekolah memilih pengawas dari daftar guru DI SEKOLAHNYA SENDIRI --
-- bukan policy SELECT langsung di profiles (yang lain tetap sesempit semula),
-- meniru pola adalah_guru() yang sudah terbukti aman membaca profiles dari
-- dalam RPC security definer.
create or replace function public.ambil_guru_sekolah()
returns table(id uuid, nama text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa melihat daftar guru' using errcode = '42501';
  end if;
  return query
    select p.id, p.nama from public.profiles p
     where p.role = 'guru' and p.sekolah_id = (select public.sekolah_saya())
     order by p.nama;
end $$;

revoke all on function public.ambil_guru_sekolah() from public, anon;
grant execute on function public.ambil_guru_sekolah() to authenticated;

-- Guru mapel mengirim satu formulir ke satu Super Sesi. Validasi kelengkapan &
-- perakitan snapshot IDENTIK dengan buka_sesi_formulir() lewat fungsi bersama.
create or replace function public.kirim_ke_super_sesi(p_formulir_id uuid, p_super_sesi_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form    public.formulir;
  v_super   public.super_sesi;
  v_masalah text;
  v_soal    jsonb;
  v_id      uuid := gen_random_uuid();
  v_judul   text;
begin
  if not public.adalah_guru() then
    raise exception 'Hanya guru yang bisa mengirim ke Super Sesi' using errcode = '42501';
  end if;

  select * into v_form from public.formulir where id = p_formulir_id and guru_id = auth.uid();
  if not found then
    raise exception 'Formulir tidak ditemukan' using errcode = 'P0002';
  end if;

  select * into v_super from public.super_sesi where id = p_super_sesi_id;
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;

  -- IS DISTINCT FROM, bukan <>: aman kalau sekolah_saya() null (seharusnya
  -- tidak mungkin karena CHECK profiles_sekolah_wajib_staf, tapi <> dengan
  -- null diam-diam jadi null/false di IF, bukan TRUE seperti yang diinginkan).
  if v_super.sekolah_id is distinct from (select public.sekolah_saya()) then
    raise exception 'Super Sesi ini bukan dari sekolahmu' using errcode = '42501';
  end if;
  if v_super.status <> 'mengumpulkan' then
    raise exception 'Super Sesi ini sudah tidak menerima kiriman' using errcode = 'P0001';
  end if;

  v_masalah := public.masalah_soal_formulir(p_formulir_id);
  if v_masalah is not null then
    raise exception '%', v_masalah using errcode = '22023';
  end if;

  v_soal := public.rakit_snapshot_soal(p_formulir_id);
  if v_soal is null then
    raise exception 'Formulir belum berisi soal' using errcode = '22023';
  end if;

  v_judul := coalesce(nullif(btrim(v_form.judul), ''), 'Formulir tanpa judul');

  begin
    insert into public.super_sesi_soal (
      id, super_sesi_id, formulir_id, guru_mapel_id, judul, deskripsi, kelas, mapel,
      durasi_menit, kunci_layar, konten_list
    ) values (
      v_id, p_super_sesi_id, p_formulir_id, auth.uid(), v_judul, btrim(v_form.deskripsi),
      v_form.kelas, v_form.mapel, v_form.durasi_menit, v_form.kunci_layar,
      jsonb_build_array(jsonb_build_object(
        'id', 'konten-' || v_id::text, 'tipe', 'soal', 'judul', v_judul, 'data', v_soal
      ))
    );
  exception when unique_violation then
    raise exception 'Formulir ini sudah dikirim ke Super Sesi yang sama' using errcode = '23505';
  end;

  return v_id;
end $$;

revoke all on function public.kirim_ke_super_sesi(uuid, uuid) from public, anon;
grant execute on function public.kirim_ke_super_sesi(uuid, uuid) to authenticated;

-- Kepala sekolah menugaskan pengawas untuk satu kiriman.
create or replace function public.tugaskan_pengawas_super_sesi(p_submission_id uuid, p_pengawas_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sekolah uuid;
  v_status  text;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa menugaskan pengawas' using errcode = '42501';
  end if;

  select s.sekolah_id, s.status into v_sekolah, v_status
    from public.super_sesi_soal ss
    join public.super_sesi s on s.id = ss.super_sesi_id
   where ss.id = p_submission_id and s.kepsek_id = auth.uid();
  if not found then
    raise exception 'Kiriman tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_status <> 'mengumpulkan' then
    raise exception 'Super Sesi ini sudah dimulai, pengawas tidak bisa diganti' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_pengawas_id and role = 'guru' and sekolah_id = v_sekolah
  ) then
    raise exception 'Guru pengawas harus dari sekolah yang sama' using errcode = '22023';
  end if;

  update public.super_sesi_soal set pengawas_id = p_pengawas_id where id = p_submission_id;
end $$;

revoke all on function public.tugaskan_pengawas_super_sesi(uuid, uuid) from public, anon;
grant execute on function public.tugaskan_pengawas_super_sesi(uuid, uuid) to authenticated;

-- Kepala sekolah mendistribusikan: satu sesi_kelas per kiriman, milik
-- pengawasnya masing-masing (SS2). Tidak idempoten dengan sengaja -- panggilan
-- kedua gagal jelas ("sudah dimulai") daripada diam-diam membuat sesi dobel.
create or replace function public.mulai_super_sesi(p_super_sesi_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super   public.super_sesi;
  v_masalah text;
  v_baris   public.super_sesi_soal;
  v_sesi_id text;
  v_kode    text;
  v_dibuat  int := 0;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa memulai Super Sesi' using errcode = '42501';
  end if;

  select * into v_super from public.super_sesi where id = p_super_sesi_id and kepsek_id = auth.uid();
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_super.status <> 'mengumpulkan' then
    raise exception 'Super Sesi ini sudah dimulai' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.super_sesi_soal where super_sesi_id = p_super_sesi_id) then
    raise exception 'Belum ada formulir yang dikirim ke Super Sesi ini' using errcode = '22023';
  end if;

  -- Tunjuk kiriman PERTAMA yang belum punya pengawas, gaya sama dengan F2.
  select format('%s (%s): pengawas belum ditugaskan', nullif(btrim(mapel), ''), nullif(btrim(kelas), ''))
    into v_masalah
    from public.super_sesi_soal
   where super_sesi_id = p_super_sesi_id and pengawas_id is null
   order by created_at
   limit 1;
  if v_masalah is not null then
    raise exception '%', v_masalah using errcode = '22023';
  end if;

  for v_baris in select * from public.super_sesi_soal where super_sesi_id = p_super_sesi_id order by created_at loop
    v_sesi_id := gen_random_uuid()::text;
    for i in 1..10 loop
      v_kode := public.buat_kode_sesi_acak();
      begin
        insert into public.sesi_kelas (
          id, guru_id, formulir_id, judul, deskripsi, durasi_menit, kode_join,
          konten_list, kunci_layar, super_sesi_id, super_sesi_judul
        ) values (
          v_sesi_id, v_baris.pengawas_id, v_baris.formulir_id, v_baris.judul, v_baris.deskripsi,
          v_baris.durasi_menit, v_kode, v_baris.konten_list, v_baris.kunci_layar,
          p_super_sesi_id, v_super.judul
        );
        exit;
      exception when unique_violation then
        if i = 10 then raise; end if;
      end;
    end loop;

    update public.super_sesi_soal set sesi_id = v_sesi_id where id = v_baris.id;
    v_dibuat := v_dibuat + 1;
  end loop;

  update public.super_sesi set status = 'berjalan', mulai_pada = now() where id = p_super_sesi_id;
  return jsonb_build_object('jumlah_sesi', v_dibuat, 'mulai_pada', now());
end $$;

revoke all on function public.mulai_super_sesi(uuid) from public, anon;
grant execute on function public.mulai_super_sesi(uuid) to authenticated;

-- Pemantauan: kepsek lihat semua kiriman di bawah super_sesi miliknya; guru
-- mapel (yang bukan kepsek pemiliknya) cuma lihat kiriman miliknya sendiri.
-- security definer dengan sengaja: kepsek TIDAK punya akses RLS ke sesi_kelas
-- milik pengawas, jadi baca lintas tabel ini tidak bisa lewat query klien biasa.
create or replace function public.pantau_super_sesi(p_super_sesi_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super public.super_sesi;
  v_hasil jsonb;
begin
  select * into v_super from public.super_sesi where id = p_super_sesi_id;
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_super.kepsek_id = auth.uid() then
    select jsonb_build_object(
      'judul', v_super.judul, 'status', v_super.status, 'mulai_pada', v_super.mulai_pada,
      'kiriman', coalesce(jsonb_agg(jsonb_build_object(
        'id', ss.id, 'mapel', ss.mapel, 'kelas', ss.kelas, 'judul', ss.judul,
        'guru_mapel_nama', gp.nama, 'pengawas_id', ss.pengawas_id, 'pengawas_nama', pp.nama,
        'sesi_id', ss.sesi_id, 'kode_join', sk.kode_join, 'sesi_status', sk.status,
        'mulai_pada_sesi', sk.mulai_pada,
        'jumlah_murid', (select count(*) from public.sesi_murid m where m.sesi_id = ss.sesi_id)
      ) order by ss.created_at), '[]'::jsonb)
    ) into v_hasil
    from public.super_sesi_soal ss
    left join public.profiles gp on gp.id = ss.guru_mapel_id
    left join public.profiles pp on pp.id = ss.pengawas_id
    left join public.sesi_kelas sk on sk.id = ss.sesi_id
    where ss.super_sesi_id = p_super_sesi_id;
    return v_hasil;
  end if;

  select jsonb_build_object(
    'judul', v_super.judul, 'status_super_sesi', v_super.status,
    'kiriman', jsonb_build_object(
      'id', ss.id, 'mapel', ss.mapel, 'kelas', ss.kelas,
      'pengawas_nama', pp.nama, 'terdistribusi', ss.sesi_id is not null
    )
  ) into v_hasil
  from public.super_sesi_soal ss
  left join public.profiles pp on pp.id = ss.pengawas_id
  where ss.super_sesi_id = p_super_sesi_id and ss.guru_mapel_id = auth.uid();

  if v_hasil is null then
    raise exception 'Kamu tidak punya kiriman di Super Sesi ini' using errcode = '42501';
  end if;
  return v_hasil;
end $$;

revoke all on function public.pantau_super_sesi(uuid) from public, anon;
grant execute on function public.pantau_super_sesi(uuid) to authenticated;

-- Membuat super_sesi baru TIDAK butuh RPC -- insert langsung dari klien, sama
-- seperti formulir. sekolah_id/kepsek_id terisi dari default kolom (di atas);
-- policy restrictive insert (adalah_kepsek()) menahan siapa pun selain kepsek.
