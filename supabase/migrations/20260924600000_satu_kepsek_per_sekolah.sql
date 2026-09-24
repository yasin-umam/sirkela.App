-- ═══ Satu kepala sekolah per sekolah ══════════════════════════════════════════
-- Permintaan pemilik produk (2026-09-24): begitu satu sekolah sudah punya
-- kepala_sekolah, guru LAIN di sekolah yang sama tidak lagi melihat ajakan
-- "Ajukan jadi Kepala Sekolah" di tab Saya. Sama seperti aturan lain di app
-- ini, UI cuma menyembunyikan -- gerbang sebenarnya di RPC di bawah, supaya
-- panggilan REST mentah tidak bisa melewatinya begitu saja.

-- Dibaca klien buat memutuskan tampilkan/sembunyikan grup "Kepala Sekolah" di
-- ProfilePage. Stable + security definer, pola sama dengan adalah_guru().
create or replace function public.sekolah_punya_kepsek()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where sekolah_id = (select public.sekolah_saya()) and role = 'kepala_sekolah'
  )
$$;

revoke all on function public.sekolah_punya_kepsek() from public, anon;
grant execute on function public.sekolah_punya_kepsek() to authenticated;

-- Menolak pengajuan BARU kalau sekolahnya sudah punya kepala_sekolah -- guru
-- yang pengajuannya sudah lebih dulu MENUNGGU tetap boleh menunggu (admin yang
-- memutuskan, lihat guard di putuskan_pengajuan_kepsek di bawah), ini cuma
-- mencegah pengajuan baru bertambah sesudah sekolahnya sudah terisi.
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
  if v_profil.sekolah_id is null then
    raise exception 'Akunmu belum terhubung ke sekolah' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles
     where sekolah_id = v_profil.sekolah_id and role = 'kepala_sekolah'
  ) then
    raise exception 'Sekolahmu sudah punya kepala sekolah' using errcode = '42501';
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

-- Guard tambahan di sisi admin: dua guru sekolah yang sama bisa saja sudah
-- MENUNGGU sebelum salah satunya disetujui -- tanpa ini admin masih bisa
-- menyetujui keduanya kalau tidak sadar (tab Persetujuan tidak menghubungkan
-- antar-baris per sekolah).
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

  if p_setuju and exists (
    select 1 from public.profiles
     where sekolah_id = v_pengajuan.sekolah_id and role = 'kepala_sekolah'
  ) then
    raise exception 'Sekolah ini sudah punya kepala sekolah' using errcode = '42501';
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
