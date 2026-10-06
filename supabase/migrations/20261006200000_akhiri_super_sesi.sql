-- ═══ Akhiri Super Sesi (kepala sekolah) ═══════════════════════════════════════
-- Sampai sekarang Super Sesi tidak punya jalan keluar: statusnya cuma bisa maju
-- dari 'mengumpulkan' ke 'berjalan' (mulai_super_sesi), tidak pernah ke 'selesai',
-- dan kelas hasil distribusi yang belum diklaim guru mana pun tidak bisa diakhiri
-- siapa pun (akhiri_sesi() mensyaratkan guru_id = auth.uid()). Fungsi ini
-- menutup keduanya sekaligus.
--
-- SS10 Mengakhiri Super Sesi = mengakhiri SEMUA kelas hasil distribusinya yang
--      masih aktif (diklaim ataupun belum) lalu menandai Super Sesi 'selesai',
--      dalam satu transaksi. Efek ke sesi sama persis dengan akhiri_sesi()
--      (status 'selesai', selesai_pada = now()): HP murid yang masih terbuka
--      mengirim otomatis, murid yang sudah menutup aplikasi tidak bernilai.
--      Hanya kepala sekolah pemilik; hanya Super Sesi yang SUDAH dimulai
--      (yang masih mengumpulkan belum punya kelas apa pun untuk diakhiri).
--      Idempoten seperti A8: Super Sesi yang sudah selesai dijawab sukses
--      dengan nol kelas, bukan galat.

create or replace function public.akhiri_super_sesi(p_super_sesi_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super public.super_sesi;
  v_kelas int;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa mengakhiri Super Sesi' using errcode = '42501';
  end if;

  select * into v_super
    from public.super_sesi
   where id = p_super_sesi_id and kepsek_id = auth.uid()
     for update;
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_super.status = 'mengumpulkan' then
    raise exception 'Super Sesi ini belum dimulai' using errcode = 'P0001';
  end if;

  update public.sesi_kelas
     set status = 'selesai',
         selesai_pada = now()
   where super_sesi_id = p_super_sesi_id
     and status = 'aktif';
  get diagnostics v_kelas = row_count;

  update public.super_sesi set status = 'selesai' where id = p_super_sesi_id;

  return jsonb_build_object('kelas_diakhiri', v_kelas);
end $$;

revoke all on function public.akhiri_super_sesi(uuid) from public, anon;
grant execute on function public.akhiri_super_sesi(uuid) to authenticated;


-- klaim_kelas_super_sesi(): sekarang menolak kelas yang sudah berakhir. Tanpa ini
-- guru yang daftarnya belum menyegar (poling 10 dtk) bisa mengklaim kelas yang
-- baru saja diakhiri kepala sekolah dan dibawa ke sesi yang sudah mati. Selebihnya
-- sama persis dengan versi 20260925000000 (SS9).
create or replace function public.klaim_kelas_super_sesi(p_sesi_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sekolah uuid;
  v_sesi    public.sesi_kelas;
begin
  if not public.adalah_guru() then
    raise exception 'Hanya guru yang bisa mengambil kelas ini' using errcode = '42501';
  end if;

  select s.sekolah_id into v_sekolah
    from public.sesi_kelas sk
    join public.super_sesi_soal ss on ss.sesi_id = sk.id
    join public.super_sesi s on s.id = ss.super_sesi_id
   where sk.id = p_sesi_id;
  if v_sekolah is null then
    raise exception 'Kelas Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_sekolah is distinct from (select public.sekolah_saya()) then
    raise exception 'Kelas ini bukan dari sekolahmu' using errcode = '42501';
  end if;

  update public.sesi_kelas
     set guru_id = auth.uid()
   where id = p_sesi_id and guru_id is null and status = 'aktif'
  returning * into v_sesi;

  if not found then
    if exists (select 1 from public.sesi_kelas where id = p_sesi_id and status <> 'aktif') then
      raise exception 'Kelas ini sudah berakhir' using errcode = 'P0001';
    end if;
    raise exception 'Kelas ini sudah diambil guru lain' using errcode = 'P0001';
  end if;

  update public.super_sesi_soal set pengawas_id = auth.uid() where sesi_id = p_sesi_id;

  return to_jsonb(v_sesi);
end $$;

revoke all on function public.klaim_kelas_super_sesi(text) from public, anon;
grant execute on function public.klaim_kelas_super_sesi(text) to authenticated;
