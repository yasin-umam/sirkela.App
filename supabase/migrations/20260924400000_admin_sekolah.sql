-- ═══ Admin: kelola sekolah lewat app, bukan cuma SQL editor ═════════════════
-- Sebelumnya baris `sekolah` HANYA bisa dibuat manual lewat SQL editor
-- (CLAUDE.md, bagian Super Sesi) -- satu-satunya tindakan admin yang sudah
-- ada di app adalah menyetujui pengajuan kepala sekolah. Migrasi ini menambah
-- layar Admin penuh (`AdminPage.tsx`) dengan RPC untuk melihat & membuat
-- sekolah, supaya admin tidak perlu buka SQL editor lagi untuk onboarding
-- sekolah baru. Promosi kepala_sekolah manual lewat SQL tetap ada sebagai
-- cadangan (tidak diubah migrasi ini).

create or replace function public.ambil_semua_sekolah()
returns table(id uuid, nama text, kode_sekolah text, created_at timestamptz, jumlah_guru bigint)
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
    select s.id, s.nama, s.kode_sekolah, s.created_at,
           count(p.id) filter (where p.role in ('guru', 'kepala_sekolah'))
      from public.sekolah s
      left join public.profiles p on p.sekolah_id = s.id
     group by s.id
     order by s.created_at desc;
end $$;

revoke all on function public.ambil_semua_sekolah() from public, anon;
grant execute on function public.ambil_semua_sekolah() to authenticated;

create or replace function public.buat_sekolah(p_nama text, p_kode text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text := nullif(btrim(p_nama), '');
  v_kode text := nullif(btrim(p_kode), '');
  v_id   uuid;
begin
  if not public.adalah_admin_utama() then
    raise exception 'Hanya admin yang bisa membuat sekolah' using errcode = '42501';
  end if;
  if v_nama is null then
    raise exception 'Nama sekolah wajib diisi' using errcode = '22023';
  end if;
  if v_kode is null then
    raise exception 'Kode sekolah wajib diisi' using errcode = '22023';
  end if;

  begin
    insert into public.sekolah (nama, kode_sekolah) values (v_nama, v_kode) returning id into v_id;
  exception when unique_violation then
    raise exception 'Kode sekolah itu sudah dipakai' using errcode = '23505';
  end;

  return v_id;
end $$;

revoke all on function public.buat_sekolah(text, text) from public, anon;
grant execute on function public.buat_sekolah(text, text) to authenticated;
