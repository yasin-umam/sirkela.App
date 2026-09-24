-- ═══ Kepala sekolah memakai layar & akses guru juga ══════════════════════════
-- Sebelumnya kepala sekolah dapat AppScreen terpisah (KepsekHome) yang HANYA
-- mengelola Super Sesi -- begitu profiles.role naik jadi 'kepala_sekolah'
-- (promosi manual SQL ATAU putuskan_pengajuan_kepsek()), akun itu langsung
-- kehilangan adalah_guru() ke formulir/bank_soal/sesi_kelas MILIKNYA SENDIRI
-- yang dibuat waktu masih 'guru' -- bukan cuma soal tampilan, ini celah akses
-- nyata yang sudah ada sebelum migrasi ini. Permintaan pemilik produk
-- (2026-09-24): kepala sekolah sekarang memakai GuruHome yang sama persis
-- dengan guru (formulir & sesi sendiri tetap jalan); Menu-nya cuma dapat satu
-- kartu tambahan "Super Sesi" di bawah "Sesi" (lihat MenuPage.tsx).
--
-- adalah_guru() dilonggarkan; adalah_kepsek() (siapa boleh KELOLA Super Sesi)
-- TIDAK berubah -- tetap murni role = 'kepala_sekolah', jadi guru biasa tidak
-- ikut bisa membuat Super Sesi cuma karena longgaran ini. Dua fungsi ini
-- sekarang boleh sama-sama true untuk satu akun, dan itu memang maksudnya.
create or replace function public.adalah_guru()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role in ('guru', 'kepala_sekolah')
  )
$$;
