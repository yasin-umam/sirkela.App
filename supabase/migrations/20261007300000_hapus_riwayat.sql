-- ═══ Hapus riwayat: sesi dan Super Sesi yang SUDAH SELESAI ════════════════════════
-- Formulir sudah bisa dihapus kapan pun (menu editor; sesi yang lahir darinya tidak
-- ikut terhapus, A6). Yang baru: sesi dan Super Sesi, dengan satu aturan keras --
-- HANYA yang sudah selesai. Yang masih berjalan atau menunggu harus diakhiri dulu.
--
-- Menghapus sesi MENGHAPUS PERMANEN: murid yang bergabung, jawaban, log pengawasan,
-- dan nilai (semuanya `on delete cascade` dari sesi_kelas). Tidak ada tong sampah.
--
-- Kelas hasil Super Sesi (super_sesi_id terisi) TIDAK boleh dihapus sendirian: FK
-- super_sesi_soal.sesi_id cuma `set null`, jadi kiriman di layar kepala sekolah
-- tiba-tiba kembali tampil "Menunggu dimulai". Kelas itu hilang bersama Super
-- Sesinya, dihapus kepala sekolah pemiliknya.
--
-- Penegakan ada di database, bukan di UI saja: guru bisa menghapus barisnya sendiri
-- lewat REST (sesi_kelas_guru_all, `for all`), jadi dua trigger menjaga DELETE
-- langsung dan RPC di bawah hanya pintu yang ramah pesan. `auth.uid() is null`
-- (SQL editor / service role / cascade hapus akun) selalu lolos.

-- ── Penjaga hapus sesi ──────────────────────────────────────────────────────
create or replace function public.jaga_hapus_sesi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return old;
  end if;
  if old.status <> 'selesai' then
    raise exception 'Sesi yang belum selesai tidak bisa dihapus -- akhiri dulu' using errcode = 'P0001';
  end if;
  -- Kelas Super Sesi: hanya kepala sekolah pemilik, dan itu lewat penghapusan
  -- Super Sesinya (trigger di bawah menjalankan DELETE ini sebagai kepala sekolah).
  if old.super_sesi_id is not null
     and not exists (select 1 from public.super_sesi s
                      where s.id = old.super_sesi_id and s.kepsek_id = auth.uid())
  then
    raise exception 'Kelas Super Sesi dihapus bersama Super Sesinya, bukan sendirian' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger sesi_kelas_jaga_hapus
  before delete on public.sesi_kelas
  for each row execute function public.jaga_hapus_sesi();


-- ── Hapus Super Sesi: hanya yang selesai, beserta semua kelasnya ────────────
-- Kelas dihapus DULU di sini karena FK-nya `set null` dan CHECK
-- sesi_kelas_guru_id_super_sesi menolak kelas tanpa pemilik yang kehilangan
-- super_sesi_id-nya (kelas yang tak pernah diklaim).
create or replace function public.hapus_kelas_super_sesi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.status <> 'selesai' then
    raise exception 'Super Sesi yang belum selesai tidak bisa dihapus -- akhiri dulu' using errcode = 'P0001';
  end if;
  delete from public.sesi_kelas where super_sesi_id = old.id;
  return old;
end $$;

create trigger super_sesi_hapus_kelas
  before delete on public.super_sesi
  for each row execute function public.hapus_kelas_super_sesi();


-- ── Pintu yang ramah pesan ──────────────────────────────────────────────────
create or replace function public.hapus_sesi(p_sesi_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_super  uuid;
begin
  select status, super_sesi_id into v_status, v_super
    from public.sesi_kelas
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
  if v_status <> 'selesai' then
    raise exception 'Akhiri sesi dulu sebelum menghapusnya' using errcode = 'P0001';
  end if;
  if v_super is not null then
    raise exception 'Sesi ini bagian dari Super Sesi: hapus lewat Super Sesinya oleh kepala sekolah' using errcode = 'P0001';
  end if;

  delete from public.sesi_kelas where id = p_sesi_id;
end $$;

revoke all on function public.hapus_sesi(text) from public, anon;
grant execute on function public.hapus_sesi(text) to authenticated;


create or replace function public.hapus_super_sesi(p_super_sesi_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa menghapus Super Sesi' using errcode = '42501';
  end if;

  select status into v_status from public.super_sesi
   where id = p_super_sesi_id and kepsek_id = auth.uid();
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_status <> 'selesai' then
    raise exception 'Akhiri Super Sesi dulu sebelum menghapusnya' using errcode = 'P0001';
  end if;

  delete from public.super_sesi where id = p_super_sesi_id;
end $$;

revoke all on function public.hapus_super_sesi(uuid) from public, anon;
grant execute on function public.hapus_super_sesi(uuid) to authenticated;
