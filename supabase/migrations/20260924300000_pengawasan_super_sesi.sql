-- ═══ Pengawasan terpusat untuk sesi hasil Super Sesi ════════════════════════
-- Permintaan pemilik produk: saat sesi lahir dari Super Sesi, kepala sekolah
-- juga bisa melihat laporan murid yang keluar/terkunci DAN menjadi SATU-
-- SATUNYA yang boleh membuka kuncinya kembali -- supaya keputusan buka kunci
-- konsisten antar kelas selama ulangan serentak, bukan tergantung masing-
-- masing pengawas. Pengawas (guru_id) TETAP pemilik sesi untuk segala hal
-- lain (mulai/akhiri sesi, lihat jawaban, veto nilai) -- SS2 tidak berubah.
--
-- Logika "bebaskan kunci" difaktor ke dua fungsi internal (bebaskan_kunci_*)
-- supaya jalur guru (dibatasi, ditolak untuk sesi Super Sesi) dan jalur
-- kepala sekolah (baru) dan atur_kunci_layar (guru, dipakai utuh untuk sesi
-- BUKAN Super Sesi) berbagi satu implementasi, bukan tiga salinan.

create or replace function public.bebaskan_kunci_murid(p_sesi_id text, p_murid_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sesi_murid
     set terkunci_pada = null
   where sesi_id = p_sesi_id and murid_id = p_murid_id
     and terkunci_pada is not null;
  if found then
    insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
    values (p_sesi_id, p_murid_id, 'dibuka_guru');
    return true;
  end if;
  return false;
end $$;

create or replace function public.bebaskan_kunci_semua(p_sesi_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_jumlah int;
begin
  with dibuka as (
    update public.sesi_murid
       set terkunci_pada = null
     where sesi_id = p_sesi_id and terkunci_pada is not null
    returning murid_id
  ), dicatat as (
    insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
    select p_sesi_id, murid_id, 'dibuka_guru' from dibuka
    returning 1
  )
  select count(*)::int into v_jumlah from dicatat;
  return v_jumlah;
end $$;

-- Internal saja: dipanggil fungsi security definer lain, tidak pernah langsung
-- oleh klien (tidak ada pemeriksaan wewenang di sini sama sekali).
revoke all on function public.bebaskan_kunci_murid(text, uuid) from public, anon, authenticated;
revoke all on function public.bebaskan_kunci_semua(text) from public, anon, authenticated;

-- ── Jalur guru: ditolak untuk sesi Super Sesi ────────────────────────────────

create or replace function public.buka_kunci_murid(p_sesi_id text, p_murid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_super_sesi_id uuid;
begin
  select super_sesi_id into v_super_sesi_id from public.sesi_kelas
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
  if v_super_sesi_id is not null then
    raise exception 'Sesi ini bagian dari Super Sesi -- buka kunci murid lewat kepala sekolah' using errcode = '42501';
  end if;

  perform public.bebaskan_kunci_murid(p_sesi_id, p_murid_id);
end $$;

create or replace function public.buka_kunci_semua(p_sesi_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_super_sesi_id uuid;
begin
  select super_sesi_id into v_super_sesi_id from public.sesi_kelas
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
  if v_super_sesi_id is not null then
    raise exception 'Sesi ini bagian dari Super Sesi -- buka kunci murid lewat kepala sekolah' using errcode = '42501';
  end if;

  return public.bebaskan_kunci_semua(p_sesi_id);
end $$;

-- Mematikan sakelar kunci layar JUGA membebaskan (gaya lama) -- tapi kalau
-- sesinya Super Sesi, mengubah sakelar ini sama saja dengan membebaskan semua
-- murid (kunci EFEKTIF butuh sesi_kelas.kunci_layar bernilai true), jadi harus
-- ikut ditolak di sini, bukan cuma di buka_kunci_semua.
create or replace function public.atur_kunci_layar(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_super_sesi_id uuid;
begin
  select super_sesi_id into v_super_sesi_id from public.sesi_kelas
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
  if v_super_sesi_id is not null then
    raise exception 'Sesi ini bagian dari Super Sesi -- kunci layar diatur kepala sekolah' using errcode = '42501';
  end if;

  update public.sesi_kelas set kunci_layar = p_aktif where id = p_sesi_id;
  if not p_aktif then
    perform public.bebaskan_kunci_semua(p_sesi_id);
  end if;
end $$;

-- ── Jalur kepala sekolah: HANYA untuk sesi dari Super Sesi miliknya ──────────

create or replace function public.buka_kunci_murid_kepsek(p_sesi_id text, p_murid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa membuka kunci di sini' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.sesi_kelas sk
    join public.super_sesi ss on ss.id = sk.super_sesi_id
   where sk.id = p_sesi_id and ss.kepsek_id = auth.uid()
  ) then
    raise exception 'Bukan sesi dari Super Sesi milikmu' using errcode = '42501';
  end if;

  perform public.bebaskan_kunci_murid(p_sesi_id, p_murid_id);
end $$;

create or replace function public.buka_kunci_semua_kepsek(p_sesi_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa membuka kunci di sini' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.sesi_kelas sk
    join public.super_sesi ss on ss.id = sk.super_sesi_id
   where sk.id = p_sesi_id and ss.kepsek_id = auth.uid()
  ) then
    raise exception 'Bukan sesi dari Super Sesi milikmu' using errcode = '42501';
  end if;

  return public.bebaskan_kunci_semua(p_sesi_id);
end $$;

create or replace function public.atur_kunci_layar_kepsek(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa mengatur kunci layar di sini' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.sesi_kelas sk
    join public.super_sesi ss on ss.id = sk.super_sesi_id
   where sk.id = p_sesi_id and ss.kepsek_id = auth.uid()
  ) then
    raise exception 'Bukan sesi dari Super Sesi milikmu' using errcode = '42501';
  end if;

  update public.sesi_kelas set kunci_layar = p_aktif where id = p_sesi_id;
  if not p_aktif then
    perform public.bebaskan_kunci_semua(p_sesi_id);
  end if;
end $$;

revoke all on function public.buka_kunci_murid_kepsek(text, uuid) from public, anon;
grant execute on function public.buka_kunci_murid_kepsek(text, uuid) to authenticated;
revoke all on function public.buka_kunci_semua_kepsek(text) from public, anon;
grant execute on function public.buka_kunci_semua_kepsek(text) to authenticated;
revoke all on function public.atur_kunci_layar_kepsek(text, boolean) from public, anon;
grant execute on function public.atur_kunci_layar_kepsek(text, boolean) to authenticated;

-- ── Laporan: pantau_super_sesi() ikut membawa kunci_layar & daftar murid ────
-- (create or replace, sama tanda tangan dengan versi di 20260924100000).

create or replace function public.pantau_super_sesi(p_super_sesi_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super public.super_sesi;
  v_hasil jsonb;
begin
  select * into v_super from public.super_sesi where id = p_super_sesi_id;
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_super.kepsek_id = auth.uid() then
    select jsonb_build_object(
      'judul', v_super.judul, 'status', v_super.status, 'mulai_pada', v_super.mulai_pada,
      'kiriman', coalesce(jsonb_agg(jsonb_build_object(
        'id', ss.id, 'mapel', ss.mapel, 'kelas', ss.kelas, 'judul', ss.judul,
        'guru_mapel_nama', gp.nama, 'pengawas_id', ss.pengawas_id, 'pengawas_nama', pp.nama,
        'sesi_id', ss.sesi_id, 'kode_join', sk.kode_join, 'sesi_status', sk.status,
        'mulai_pada_sesi', sk.mulai_pada, 'kunci_layar', sk.kunci_layar,
        'jumlah_murid', (select count(*) from public.sesi_murid m where m.sesi_id = ss.sesi_id),
        -- Per murid: cukup untuk laporan "siapa keluar/terkunci" DAN untuk
        -- tombol buka kunci per murid di layar kepala sekolah. Payload wajar
        -- untuk ukuran satu kelas, dipoling tiap 10 detik sama seperti
        -- LihatJawaban.tsx -- lihat SesiContext untuk pola aslinya.
        'murid', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'murid_id', m.murid_id, 'nama', m.nama,
            'terkunci_pada', m.terkunci_pada, 'terakhir_denyut', m.terakhir_denyut,
            'keluar_layar', (select count(*) from public.sesi_peristiwa pe
                              where pe.sesi_id = m.sesi_id and pe.murid_id = m.murid_id and pe.jenis = 'tinggalkan_layar'),
            'hilang_fokus', (select count(*) from public.sesi_peristiwa pe
                              where pe.sesi_id = m.sesi_id and pe.murid_id = m.murid_id and pe.jenis = 'hilang_fokus')
          ) order by m.joined_at), '[]'::jsonb)
          from public.sesi_murid m where m.sesi_id = ss.sesi_id
        )
      ) order by ss.created_at), '[]'::jsonb)
    ) into v_hasil
    from public.super_sesi_soal ss
    left join public.profiles gp on gp.id = ss.guru_mapel_id
    left join public.profiles pp on pp.id = ss.pengawas_id
    left join public.sesi_kelas sk on sk.id = ss.sesi_id
    where ss.super_sesi_id = p_super_sesi_id;
    return v_hasil;
  end if;

  select jsonb_build_object(
    'judul', v_super.judul, 'status_super_sesi', v_super.status,
    'kiriman', jsonb_build_object(
      'id', ss.id, 'mapel', ss.mapel, 'kelas', ss.kelas,
      'pengawas_nama', pp.nama, 'terdistribusi', ss.sesi_id is not null
    )
  ) into v_hasil
  from public.super_sesi_soal ss
  left join public.profiles pp on pp.id = ss.pengawas_id
  where ss.super_sesi_id = p_super_sesi_id and ss.guru_mapel_id = auth.uid();

  if v_hasil is null then
    raise exception 'Kamu tidak punya kiriman di Super Sesi ini' using errcode = '42501';
  end if;
  return v_hasil;
end $$;

revoke all on function public.pantau_super_sesi(uuid) from public, anon;
grant execute on function public.pantau_super_sesi(uuid) to authenticated;
