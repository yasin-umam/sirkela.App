-- ═══ Klaim bebas kelas Super Sesi ════════════════════════════════════════════
-- Ganti model lama ("kepala sekolah menugaskan pengawas SATU-SATU sebelum bisa
-- menekan Mulai", tugaskan_pengawas_super_sesi()) dengan model klaim bebas:
-- permintaan eksplisit pemilik produk -- kepala sekolah tidak perlu lagi
-- menjodohkan guru ke kelas. Begitu "Mulai Super Sesi" ditekan, SEMUA kiriman
-- langsung didistribusikan jadi kelas TANPA pemilik; guru mana pun di sekolah
-- yang sama bebas mengklaimnya, dan siapa yang mengklik duluan itulah
-- pengawasnya -- persis seperti guru masuk ke ruangan kelas mana pun secara
-- fisik, lalu menandai di aplikasi bahwa dialah yang menjalankannya.
--
-- Sesudah diklaim, sesi_kelas.guru_id terisi dan baris itu tidak bisa
-- dibedakan lagi dari sesi hasil distribusi versi lama (SS2 tetap berlaku) --
-- semua mekanisme yang sudah ada (mulai sesi, veto, dst) jalan tanpa
-- perubahan. Pengumpulan kiriman dari guru mapel (kirim_ke_super_sesi, SS1)
-- SAMA SEKALI TIDAK BERUBAH -- cuma tahap distribusi/penugasan yang diganti.
--
-- SS7  sesi_kelas.guru_id BOLEH null HANYA untuk baris hasil Super Sesi yang
--      belum diklaim (CHECK sesi_kelas_guru_id_super_sesi) -- sesi biasa
--      (super_sesi_id null) tetap WAJIB guru_id terisi seperti sebelumnya,
--      jadi longgaran ini tidak menyentuh alur Kirim/buka_sesi_formulir sama
--      sekali.
-- SS8  Daftar "kelas tersedia" (ambil_kelas_tersedia_super_sesi) HANYA
--      membawa metadata (mapel/kelas/judul) -- TIDAK PERNAH konten_list.
--      Tanpa batasan ini, semua guru di sekolah bisa membaca kunci jawaban
--      lewat daftar "kelas yang bisa diambil" SEBELUM siapa pun mengklaimnya
--      -- kebalikan dari niat aslinya (kunci jawaban cuma boleh terlihat oleh
--      yang benar-benar akan mengawas).
-- SS9  Klaim (klaim_kelas_super_sesi) atomik lewat `update ... where
--      guru_id is null` -- guru kedua yang menekan kelas yang sama nyaris
--      bersamaan mendapat pesan jelas ("sudah diambil guru lain"), bukan
--      tabrakan diam-diam atau dua guru sama-sama merasa jadi pengawas.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.tugaskan_pengawas_super_sesi(uuid, uuid);
drop function if exists public.ambil_guru_sekolah();

-- SS7
alter table public.sesi_kelas alter column guru_id drop not null;
alter table public.sesi_kelas add constraint sesi_kelas_guru_id_super_sesi
  check (guru_id is not null or super_sesi_id is not null);

-- mulai_super_sesi(): sama seperti sebelumnya (kode join per kiriman, salin
-- snapshot, catat sesi_id balik ke super_sesi_soal), TAPI guru_id sengaja
-- dibiarkan NULL dan validasi "pengawas belum ditugaskan" dibuang -- siapa pun
-- guru di sekolah ini boleh mengklaimnya belakangan lewat klaim_kelas_super_sesi().
create or replace function public.mulai_super_sesi(p_super_sesi_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super   public.super_sesi;
  v_baris   public.super_sesi_soal;
  v_sesi_id text;
  v_kode    text;
  v_dibuat  int := 0;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa memulai Super Sesi' using errcode = '42501';
  end if;

  select * into v_super from public.super_sesi where id = p_super_sesi_id and kepsek_id = auth.uid();
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_super.status <> 'mengumpulkan' then
    raise exception 'Super Sesi ini sudah dimulai' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.super_sesi_soal where super_sesi_id = p_super_sesi_id) then
    raise exception 'Belum ada formulir yang dikirim ke Super Sesi ini' using errcode = '22023';
  end if;

  for v_baris in select * from public.super_sesi_soal where super_sesi_id = p_super_sesi_id order by created_at loop
    v_sesi_id := gen_random_uuid()::text;
    for i in 1..10 loop
      v_kode := public.buat_kode_sesi_acak();
      begin
        insert into public.sesi_kelas (
          id, guru_id, formulir_id, judul, deskripsi, durasi_menit, kode_join,
          konten_list, kunci_layar, super_sesi_id, super_sesi_judul
        ) values (
          v_sesi_id, null, v_baris.formulir_id, v_baris.judul, v_baris.deskripsi,
          v_baris.durasi_menit, v_kode, v_baris.konten_list, v_baris.kunci_layar,
          p_super_sesi_id, v_super.judul
        );
        exit;
      exception when unique_violation then
        if i = 10 then raise; end if;
      end;
    end loop;

    update public.super_sesi_soal set sesi_id = v_sesi_id where id = v_baris.id;
    v_dibuat := v_dibuat + 1;
  end loop;

  update public.super_sesi set status = 'berjalan', mulai_pada = now() where id = p_super_sesi_id;
  return jsonb_build_object('jumlah_sesi', v_dibuat, 'mulai_pada', now());
end $$;

revoke all on function public.mulai_super_sesi(uuid) from public, anon;
grant execute on function public.mulai_super_sesi(uuid) to authenticated;

-- SS8: metadata saja, TANPA konten_list. Dilihat SEMUA guru (adalah_guru(),
-- yang sejak 20260924500000_kepsek_guru_gabung.sql juga true untuk
-- kepala_sekolah) di sekolah yang sama -- bukan cuma satu yang ditunjuk,
-- karena memang tidak ada lagi yang ditunjuk.
create or replace function public.ambil_kelas_tersedia_super_sesi()
returns table(
  sesi_id text, mapel text, kelas text, judul text,
  super_sesi_judul text, durasi_menit int, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.adalah_guru() then
    raise exception 'Hanya guru yang bisa melihat kelas Super Sesi' using errcode = '42501';
  end if;
  return query
    select sk.id, ss.mapel, ss.kelas, sk.judul, sk.super_sesi_judul, sk.durasi_menit, sk.created_at
      from public.sesi_kelas sk
      join public.super_sesi_soal ss on ss.sesi_id = sk.id
      join public.super_sesi s on s.id = ss.super_sesi_id
     where sk.guru_id is null
       and sk.status = 'aktif'
       and s.sekolah_id = (select public.sekolah_saya())
     order by sk.created_at;
end $$;

revoke all on function public.ambil_kelas_tersedia_super_sesi() from public, anon;
grant execute on function public.ambil_kelas_tersedia_super_sesi() to authenticated;

-- SS9: klaim atomik. Mengembalikan sesi LENGKAP (termasuk konten_list) --
-- aman, karena pemanggilnya BARU SAJA jadi pemiliknya sah, sama seperti
-- buka_sesi_formulir() mengembalikan sesi lengkap ke pembuatnya sendiri.
-- pengawas_id di super_sesi_soal ikut ditulis di sini (bukan lagi di RPC
-- tugaskan_pengawas_super_sesi yang sudah dihapus) supaya pantau_super_sesi()
-- tetap bisa menunjukkan siapa pengawasnya ke kepala sekolah TANPA perubahan
-- apa pun di fungsi itu sendiri.
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
   where id = p_sesi_id and guru_id is null
  returning * into v_sesi;

  if not found then
    raise exception 'Kelas ini sudah diambil guru lain' using errcode = 'P0001';
  end if;

  update public.super_sesi_soal set pengawas_id = auth.uid() where sesi_id = p_sesi_id;

  return to_jsonb(v_sesi);
end $$;

revoke all on function public.klaim_kelas_super_sesi(text) from public, anon;
grant execute on function public.klaim_kelas_super_sesi(text) to authenticated;
