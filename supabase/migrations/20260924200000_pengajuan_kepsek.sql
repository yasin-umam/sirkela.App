-- ═══ Pengajuan Kepala Sekolah: swadaya, bukan cuma promosi manual admin ═════
-- Sebelum ini, satu-satunya jalan seorang guru jadi kepala_sekolah adalah admin
-- menaikkan role-nya lewat SQL editor SETELAH tahu (lewat jalur di luar app)
-- bahwa guru itu memang kepala sekolah. Migrasi ini membalik urutannya: guru
-- MENGAJUKAN diri lewat app (tab Saya), admin (SATU akun tertentu, dicek dari
-- EMAIL di auth.users -- lihat adalah_admin_utama() di bawah, bukan role baru
-- di profiles) menyetujui/menolak lewat layar admin minimal yang juga di app.
-- Promosi manual lewat SQL editor (CLAUDE.md, bagian Super Sesi) TETAP jalan
-- sebagai jalur cadangan -- migrasi ini menambah jalur, bukan menggantikannya.

create table public.pengajuan_kepala_sekolah (
  id              uuid        primary key default gen_random_uuid(),
  guru_id         uuid        not null references public.profiles(id) on delete cascade,
  sekolah_id      uuid        not null references public.sekolah(id) on delete cascade,
  status          text        not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  dibuat_pada     timestamptz not null default now(),
  diputuskan_pada timestamptz,
  diputuskan_oleh uuid        references auth.users(id) on delete set null
);

-- Satu pengajuan MENUNGGU per guru. Sesudah diputuskan (disetujui/ditolak),
-- guru boleh mengajukan lagi -- baris lama tetap sebagai riwayat, bukan ditimpa.
create unique index pengajuan_kepsek_menunggu_unik
  on public.pengajuan_kepala_sekolah (guru_id) where status = 'menunggu';

create index pengajuan_kepsek_status_idx on public.pengajuan_kepala_sekolah (status, dibuat_pada);

alter table public.pengajuan_kepala_sekolah enable row level security;

-- Admin TUNGGAL, dicek dari email akun yang sedang login lewat auth.users --
-- bukan kolom role baru di profiles (peran cuma guru/murid/kepala_sekolah, M1
-- tetap berlaku) dan bukan metadata klien (tidak dipercaya, sama alasan dengan
-- adalah_guru()/adalah_kepsek()). Ganti emailnya di sini kalau admin berpindah
-- tangan -- satu-satunya tempat yang perlu diubah.
create or replace function public.adalah_admin_utama()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where id = auth.uid() and email = 'yasinumam4@gmail.com'
  )
$$;

revoke all on function public.adalah_admin_utama() from public, anon;
grant execute on function public.adalah_admin_utama() to authenticated;

create policy "pengajuan_kepsek_guru_select" on public.pengajuan_kepala_sekolah
  for select using (guru_id = auth.uid());
create policy "pengajuan_kepsek_admin_select" on public.pengajuan_kepala_sekolah
  for select using ((select public.adalah_admin_utama()));

-- Tanpa policy INSERT/UPDATE/DELETE sama sekali -- semua tulis lewat RPC di
-- bawah (gaya K7/SS4), supaya validasi (guru asli, satu menunggu per akun,
-- keputusan cuma sekali) tidak bisa dilewati lewat REST mentah.
revoke insert, update, delete on public.pengajuan_kepala_sekolah from anon, authenticated;

create or replace function public.ajukan_kepala_sekolah()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil public.profiles;
  v_id     uuid;
begin
  select * into v_profil from public.profiles where id = auth.uid();
  if not found or v_profil.role <> 'guru' then
    raise exception 'Hanya guru yang bisa mengajukan diri jadi kepala sekolah' using errcode = '42501';
  end if;
  -- Seharusnya tidak mungkin kosong (profiles_sekolah_wajib_staf), tapi dicek
  -- eksplisit supaya pesannya jelas kalau suatu saat aturan itu berubah.
  if v_profil.sekolah_id is null then
    raise exception 'Akunmu belum terhubung ke sekolah' using errcode = '22023';
  end if;

  begin
    insert into public.pengajuan_kepala_sekolah (guru_id, sekolah_id)
    values (auth.uid(), v_profil.sekolah_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Kamu sudah punya pengajuan yang masih menunggu' using errcode = '23505';
  end;

  return v_id;
end $$;

revoke all on function public.ajukan_kepala_sekolah() from public, anon;
grant execute on function public.ajukan_kepala_sekolah() to authenticated;

-- Admin melihat SEMUA pengajuan (nama guru & sekolah ikut dirakit di sini,
-- karena policy profiles/sekolah admin TIDAK dilonggarkan lintas sekolah untuk
-- ini -- baca lintas tabel lewat security definer, sama pola dengan
-- pantau_super_sesi()). Menunggu dulu, baru riwayat.
create or replace function public.ambil_pengajuan_kepsek()
returns table(
  id uuid, guru_id uuid, guru_nama text, sekolah_id uuid, sekolah_nama text,
  status text, dibuat_pada timestamptz, diputuskan_pada timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.adalah_admin_utama() then
    raise exception 'Hanya admin yang bisa melihat daftar ini' using errcode = '42501';
  end if;
  return query
    select p.id, p.guru_id, gp.nama, p.sekolah_id, s.nama, p.status, p.dibuat_pada, p.diputuskan_pada
      from public.pengajuan_kepala_sekolah p
      join public.profiles gp on gp.id = p.guru_id
      join public.sekolah s on s.id = p.sekolah_id
     order by (p.status = 'menunggu') desc, p.dibuat_pada desc;
end $$;

revoke all on function public.ambil_pengajuan_kepsek() from public, anon;
grant execute on function public.ambil_pengajuan_kepsek() to authenticated;

-- Menyetujui menaikkan role guru itu jadi kepala_sekolah DI SINI (bukan jalur
-- lain) -- satu tempat yang mengeksekusi promosi lewat app, sejajar dengan
-- promosi manual SQL yang tetap ada sebagai cadangan.
create or replace function public.putuskan_pengajuan_kepsek(p_pengajuan_id uuid, p_setuju boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pengajuan public.pengajuan_kepala_sekolah;
begin
  if not public.adalah_admin_utama() then
    raise exception 'Hanya admin yang bisa memutuskan pengajuan ini' using errcode = '42501';
  end if;

  select * into v_pengajuan from public.pengajuan_kepala_sekolah where id = p_pengajuan_id;
  if not found then
    raise exception 'Pengajuan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_pengajuan.status <> 'menunggu' then
    raise exception 'Pengajuan ini sudah diputuskan' using errcode = 'P0001';
  end if;

  update public.pengajuan_kepala_sekolah
     set status = case when p_setuju then 'disetujui' else 'ditolak' end,
         diputuskan_pada = now(),
         diputuskan_oleh = auth.uid()
   where id = p_pengajuan_id;

  if p_setuju then
    update public.profiles set role = 'kepala_sekolah' where id = v_pengajuan.guru_id;
  end if;
end $$;

revoke all on function public.putuskan_pengajuan_kepsek(uuid, boolean) from public, anon;
grant execute on function public.putuskan_pengajuan_kepsek(uuid, boolean) to authenticated;
