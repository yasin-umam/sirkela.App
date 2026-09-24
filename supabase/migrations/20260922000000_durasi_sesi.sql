-- ═══ Durasi diatur dari sesi, bukan dari formulir ══════════════════════════
-- TabSetelan (durasi + kunci layar di editor formulir) dibuang 2026-09-22:
-- kunci layar sudah bisa diubah dari layar Sesi lewat atur_kunci_layar() yang
-- SUDAH ADA; durasi belum, jadi RPC ini melengkapi pasangannya. Sengaja HANYA
-- boleh selama sesi belum dimulai (mulai_pada masih null) -- begitu "Mulai
-- sesi" ditekan, Hitungan di klien sudah menghitung tenggat dari durasi saat
-- itu, dan murid sudah melihat angkanya; mengubahnya di tengah jalan berarti
-- menipu mereka.
create or replace function public.atur_durasi_sesi(p_sesi_id text, p_menit int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_menit < 1 or p_menit > 600 then
    raise exception 'Durasi harus 1-600 menit' using errcode = '22023';
  end if;

  update public.sesi_kelas
     set durasi_menit = p_menit
   where id = p_sesi_id
     and guru_id = auth.uid()
     and status = 'aktif'
     and mulai_pada is null;

  if not found then
    if exists (select 1 from public.sesi_kelas where id = p_sesi_id and guru_id = auth.uid()) then
      raise exception 'Sesi sudah dimulai, durasi tidak bisa diubah lagi' using errcode = 'P0001';
    end if;
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
end $$;

revoke all on function public.atur_durasi_sesi(text, int) from public, anon;
grant execute on function public.atur_durasi_sesi(text, int) to authenticated;
