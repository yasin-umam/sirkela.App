-- ═══ Menghubungkan guru lama ke sekolahnya ═══════════════════════════════════
-- Migrasi 20260924000000_sekolah.sql menaruh semua guru yang akunnya lahir
-- SEBELUM konsep sekolah ada ke satu "Sekolah Default" (kode 'DEFAULT'), dan
-- sejak itu tidak ada jalan bagi mereka untuk pindah ke sekolah yang benar selain
-- SQL manual oleh pemilik -- padahal guru baru langsung terhubung lewat kode
-- sekolah di layar Daftar. Akibatnya guru lama tidak terlihat oleh kepala
-- sekolahnya: Super Sesi hanya menampilkan kelas dan kiriman SEKOLAH SENDIRI.
--
-- Dua fungsi, keduanya security definer karena klien TIDAK boleh menulis
-- profiles.sekolah_id (grant kolom profiles cuma `nama`; kalau boleh, guru bisa
-- menyelinap ke sekolah mana pun tanpa kode):
--
--   perlu_kode_sekolah()  true = pemanggil guru yang masih di 'DEFAULT'. Klien
--                         memanggilnya sekali sesudah login untuk memutuskan
--                         apakah layar "Hubungkan ke Sekolah" perlu tampil.
--   gabung_sekolah(kode)  memindahkan pemanggil ke sekolah berkode itu, SEKALI
--                         JALAN: hanya dari 'DEFAULT', hanya untuk peran 'guru'.
--
-- Satu arah itu disengaja (permintaan pemilik produk): kode sekolah umur panjang
-- dan bisa bocor (lihat CLAUDE.md, "Yang belum ditangani"); kalau guru bebas
-- berpindah dengan kode apa pun, kode yang bocor jadi tiket pindah sekolah.
-- Pindah antar sekolah asli, atau memindahkan kepala sekolah, tetap SQL manual.

create or replace function public.perlu_kode_sekolah()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.sekolah s on s.id = p.sekolah_id
    where p.id = auth.uid()
      and p.role = 'guru'
      and upper(s.kode_sekolah) = 'DEFAULT'
  )
$$;

revoke all on function public.perlu_kode_sekolah() from public, anon;
grant execute on function public.perlu_kode_sekolah() to authenticated;

-- Mengembalikan NAMA sekolah tujuan (klien menampilkannya sebagai konfirmasi).
create or replace function public.gabung_sekolah(p_kode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kode text := upper(btrim(coalesce(p_kode, '')));
  v_id   uuid;
  v_nama text;
begin
  if not public.perlu_kode_sekolah() then
    raise exception 'Akunmu sudah terhubung ke sekolah' using errcode = '42501';
  end if;

  -- Kode 'DEFAULT' sendiri bukan tujuan: itu sekolah tempat akun ini sekarang.
  select id, nama into v_id, v_nama
  from public.sekolah
  where upper(kode_sekolah) = v_kode and v_kode <> 'DEFAULT';
  if not found then
    raise exception 'Kode sekolah tidak ditemukan' using errcode = 'P0002';
  end if;

  update public.profiles set sekolah_id = v_id where id = auth.uid();
  return v_nama;
end $$;

revoke all on function public.gabung_sekolah(text) from public, anon;
grant execute on function public.gabung_sekolah(text) to authenticated;
