-- ═══ Sekolah: fondasi multi-sekolah untuk Super Sesi ════════════════════════
-- Satu project Supabase sekarang bisa menampung LEBIH dari satu sekolah --
-- guru & kepala sekolah terikat satu sekolah lewat profiles.sekolah_id, murid
-- tidak (mereka cuma pakai kode sesi, tidak pernah menyentuh data bersekat
-- sekolah). Ditambahkan sebagai fondasi fitur Super Sesi (lihat CLAUDE.md).
--
-- Baris sekolah dibuat MANUAL oleh admin lewat SQL editor sebelum sekolah itu
-- punya guru -- sama pola dengan sakelar darurat kunci layar (pengaturan_sesi):
-- tanpa UI admin, SQL manual untuk setup berpengaruh besar.
--   insert into public.sekolah (nama, kode_sekolah) values ('SMA Contoh', 'SMA1-CONTOH');
-- lalu kepala sekolah pertamanya daftar lewat RegisterPage dengan kode itu
-- (jadi 'guru' dulu, M1 tetap berlaku), lalu admin menaikkan perannya:
--   update public.profiles set role = 'kepala_sekolah' where id = '<uuid>';

create table public.sekolah (
  id           uuid        primary key default gen_random_uuid(),
  nama         text        not null,
  kode_sekolah text        not null,
  created_at   timestamptz not null default now()
);

create unique index sekolah_kode_unik on public.sekolah (upper(kode_sekolah));

alter table public.sekolah enable row level security;

alter table public.profiles
  add column sekolah_id uuid references public.sekolah(id) on delete restrict;

-- restrict, bukan cascade/set null: menghapus sekolah tidak boleh diam-diam
-- melepaskan staf dari sekolahnya. Reassign dulu secara eksplisit.

-- Backfill: guru yang akunnya lahir SEBELUM migrasi ini (konsep sekolah belum
-- ada sama sekali) tidak mungkin sudah punya sekolah_id -- tanpa baris ini,
-- constraint di bawah langsung ditolak oleh data lama begitu ditambahkan.
-- Ditaruh satu sekolah bawaan dulu; admin pindahkan manual lewat SQL editor
-- (update profiles.sekolah_id) kalau nanti perlu dipisah per sekolah asli.
insert into public.sekolah (nama, kode_sekolah)
  select 'Sekolah Default', 'DEFAULT'
  where exists (select 1 from public.profiles where role <> 'murid' and sekolah_id is null);

update public.profiles set sekolah_id = (select id from public.sekolah where kode_sekolah = 'DEFAULT')
  where role <> 'murid' and sekolah_id is null;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('guru', 'murid', 'kepala_sekolah'));

alter table public.profiles add constraint profiles_sekolah_wajib_staf
  check (role = 'murid' or sekolah_id is not null);

create or replace function public.sekolah_saya()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sekolah_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.sekolah_saya() from public, anon;
grant execute on function public.sekolah_saya() to authenticated;

create or replace function public.adalah_kepsek()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'kepala_sekolah'
  )
$$;

revoke all on function public.adalah_kepsek() from public, anon;
grant execute on function public.adalah_kepsek() to authenticated;

create policy "sekolah_anggota_select" on public.sekolah
  for select using (id = (select public.sekolah_saya()));

revoke insert, update, delete on public.sekolah from anon, authenticated;

-- Dipanggil TANPA sesi (sebelum daftar), supaya layar Daftar bisa menunjukkan
-- nama sekolah / menolak kode salah sebelum submit -- bukan menunggu
-- handle_new_user() gagal di tengah signUp(). Sengaja terbuka ke anon: cuma
-- membocorkan NAMA sekolah dari kode yang sudah ditebak, bukan data apa pun.
create or replace function public.cek_kode_sekolah(p_kode text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nama from public.sekolah where upper(kode_sekolah) = upper(btrim(p_kode))
$$;

revoke all on function public.cek_kode_sekolah(text) from public;
grant execute on function public.cek_kode_sekolah(text) to anon, authenticated;

-- handle_new_user(): non-anonim sekarang WAJIB bawa kode_sekolah yang valid di
-- metadata (mengirim, bukan menerima peran -- role di sini SELALU 'guru', M1
-- tetap berlaku: promosi ke kepala_sekolah cuma lewat SQL editor admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sekolah_id uuid;
  v_kode       text := nullif(btrim(new.raw_user_meta_data->>'kode_sekolah'), '');
begin
  if new.is_anonymous then
    insert into public.profiles (id, nama, role, sekolah_id)
    values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'nama'), ''), ''), 'murid', null);
    return new;
  end if;

  if v_kode is null then
    raise exception 'Kode sekolah wajib diisi saat mendaftar' using errcode = '22023';
  end if;

  select id into v_sekolah_id from public.sekolah where upper(kode_sekolah) = upper(v_kode);
  if not found then
    raise exception 'Kode sekolah tidak ditemukan' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, nama, role, sekolah_id)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'nama'), ''), 'Pengguna'),
    'guru',
    v_sekolah_id
  );
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
