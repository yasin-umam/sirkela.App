-- ═══════════════════════════════════════════════════════════════════════════
-- Murid tanpa akun.
--
-- Murid tidak lagi mendaftar atau login: saat pertama kali bergabung ke sesi,
-- klien memanggil supabase.auth.signInAnonymously(). Hasilnya tetap baris
-- auth.users sungguhan (is_anonymous = true) dengan JWT ber-role
-- `authenticated`, jadi SEMUA RLS & RPC di skema awal -- yang bersandar pada
-- auth.uid() -- berlaku tanpa diubah. Identitas itu hidup di localStorage
-- perangkat; murid yang me-refresh di tengah sesi kembali ke baris
-- sesi_murid & jawaban_sesi yang sama.
--
-- Syarat di dashboard (tidak bisa lewat migration):
--   Authentication -> Sign In / Providers -> "Allow anonymous sign-ins" = ON
--   Authentication -> Rate Limits -> anonymous sign-ins: bawaan 30/jam PER IP.
--     Satu kelas di belakang satu wifi sekolah = satu IP. Naikkan.
--
-- Akibat yang dikunci di sini:
--   M1  Peran ditentukan JENIS akun, bukan metadata dari klien: akun anonim
--       SELALU murid, akun email SELALU guru. Siapa pun bisa membuat akun
--       anonim tanpa batas identitas, jadi metadata `role` tidak boleh lagi
--       dipercaya -- `signInAnonymously({ options: { data: { role: 'guru' } } })`
--       tetap melahirkan murid.
--   M2  Hanya profil guru yang boleh menulis/membaca bank_soal & sesi_kelas.
--       Sebelumnya policy cuma memeriksa auth.uid() = guru_id, jadi akun murid
--       pun bisa membuat sesi lewat REST. Selama murid harus mendaftar itu
--       celah kecil; dengan akun anonim, siapa pun di internet bisa.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ M1. Profil dari jenis akun ═════════════════════════════════════════════

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
    -- Murid anonim mengetik namanya di tiap sesi (set_nama_peserta); nama
    -- kosong = belum pernah mengetik, dan layar "Siap memulai" mulai dari kolom
    -- kosong alih-alih "Pengguna" yang harus dihapus dulu.
    coalesce(nullif(btrim(new.raw_user_meta_data->>'nama'), ''),
             case when new.is_anonymous then '' else 'Pengguna' end),
    case when new.is_anonymous then 'murid' else 'guru' end
  );
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;


-- ═══ M2. Tulis bank_soal & sesi_kelas hanya untuk guru ══════════════════════

-- security definer + stable: dibaca sekali per query lewat `(select ...)` di
-- policy, bukan sekali per baris.
create or replace function public.adalah_guru()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'guru'
  )
$$;

revoke all on function public.adalah_guru() from public, anon;
grant execute on function public.adalah_guru() to authenticated;

-- RESTRICTIVE: di-AND dengan policy pemilik yang sudah ada, bukan di-OR.
-- `to authenticated` saja -- role anon (tanpa JWT) tidak punya policy permisif
-- apa pun di kedua tabel, jadi sudah tertolak tanpa perlu EXECUTE fungsi ini.
create policy "bank_soal_hanya_guru" on public.bank_soal
  as restrictive
  for all to authenticated
  using ((select public.adalah_guru()))
  with check ((select public.adalah_guru()));

create policy "sesi_kelas_hanya_guru" on public.sesi_kelas
  as restrictive
  for all to authenticated
  using ((select public.adalah_guru()))
  with check ((select public.adalah_guru()));
