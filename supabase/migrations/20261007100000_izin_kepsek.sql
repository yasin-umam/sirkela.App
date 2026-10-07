-- ═══ Izin kepala sekolah (Super Sesi) ═══════════════════════════════════════════
-- 20261007000000_murid_terlambat.sql menaruh sakelar "Izinkan murid terlambat"
-- (sesi_kelas.terima_terlambat) di tangan guru pemegang sesi -- untuk sesi hasil
-- Super Sesi itu pengawas. Kepala sekolah bisa memilih memegangnya sendiri:
-- sakelar `super_sesi.izin_kepsek`. Menyala berarti, untuk SEMUA kelas Super Sesi
-- itu:
--   * izin masuk kembali (terima_terlambat) HANYA bisa diubah kepala sekolah,
--     pengawas tidak lagi (T4);
--   * kepala sekolah memantau murid yang keluar (data sudah ada di
--     pantau_super_sesi(); klien menampilkannya sebagai daftar tersendiri).
-- Kunci layar sudah di tangan kepala sekolah sejak SS5; ini menyusul pintunya.
--
-- Pengawas tidak punya akses ke tabel super_sesi (SS3), jadi flag-nya DISALIN ke
-- tiap sesi_kelas oleh trigger -- cuma untuk tampilan pengawas. Penegakan di
-- server tidak bergantung pada salinan itu saja: ada penjaga UPDATE di bawah,
-- karena guru bisa meng-UPDATE barisnya sendiri lewat REST (sesi_kelas_guru_all).

alter table public.super_sesi
  add column izin_kepsek boolean not null default false;

alter table public.sesi_kelas
  add column izin_kepsek boolean not null default false;


-- ── Salinan flag ke kelas ───────────────────────────────────────────────────
-- Kelas baru (mulai_super_sesi) mewarisi flag Super Sesi-nya; sesi biasa
-- (super_sesi_id null) SELALU false, apa pun yang dikirim klien.
create or replace function public.salin_izin_kepsek_ke_sesi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.super_sesi_id is not null then
    new.izin_kepsek := coalesce(
      (select s.izin_kepsek from public.super_sesi s where s.id = new.super_sesi_id), false);
  else
    new.izin_kepsek := false;
  end if;
  return new;
end $$;

create trigger sesi_kelas_salin_izin_kepsek
  before insert on public.sesi_kelas
  for each row execute function public.salin_izin_kepsek_ke_sesi();

-- Flag berubah di Super Sesi -> sebarkan ke kelasnya yang masih aktif. Menyala
-- juga MENUTUP pintu yang sempat dibuka pengawas: kepala sekolah mengambil alih
-- dari keadaan tertutup, bukan mewarisi keputusan yang tidak ia lihat.
create or replace function public.sebar_izin_kepsek()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sesi_kelas
     set izin_kepsek = new.izin_kepsek,
         terima_terlambat = case when new.izin_kepsek then false else terima_terlambat end
   where super_sesi_id = new.id and status = 'aktif';
  return new;
end $$;

create trigger super_sesi_sebar_izin_kepsek
  after update of izin_kepsek on public.super_sesi
  for each row
  when (old.izin_kepsek is distinct from new.izin_kepsek)
  execute function public.sebar_izin_kepsek();


-- ── Penjaga UPDATE ──────────────────────────────────────────────────────────
-- Selama izin kepala sekolah menyala, terima_terlambat dan izin_kepsek di kelas
-- itu tidak boleh diubah siapa pun selain kepala sekolah pemilik Super Sesi-nya --
-- termasuk pengawas yang meng-UPDATE barisnya sendiri lewat REST. `auth.uid()
-- is not null` membiarkan SQL editor / service role (pemilik produk) lewat.
create or replace function public.jaga_izin_kepsek()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.super_sesi_id is not null
     and old.izin_kepsek
     and (new.terima_terlambat is distinct from old.terima_terlambat
          or new.izin_kepsek is distinct from old.izin_kepsek)
     and auth.uid() is not null
     and not exists (select 1 from public.super_sesi s
                      where s.id = old.super_sesi_id and s.kepsek_id = auth.uid())
  then
    raise exception 'Kepala sekolah yang mengatur izin masuk kembali di kelas ini'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger sesi_kelas_jaga_izin_kepsek
  before update of terima_terlambat, izin_kepsek on public.sesi_kelas
  for each row execute function public.jaga_izin_kepsek();


-- ── Sakelar kepala sekolah ──────────────────────────────────────────────────
create or replace function public.atur_izin_kepsek(p_super_sesi_id uuid, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa mengatur izin ini' using errcode = '42501';
  end if;

  select status into v_status from public.super_sesi
   where id = p_super_sesi_id and kepsek_id = auth.uid();
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_status = 'selesai' then
    raise exception 'Super Sesi ini sudah diakhiri' using errcode = 'P0001';
  end if;

  update public.super_sesi set izin_kepsek = p_aktif where id = p_super_sesi_id;
end $$;

revoke all on function public.atur_izin_kepsek(uuid, boolean) from public, anon;
grant execute on function public.atur_izin_kepsek(uuid, boolean) to authenticated;


-- Pintu satu kelas, oleh kepala sekolah. Hanya selama izin menyala: kalau tidak,
-- pintu itu milik pengawas dan dua pihak mengubah sakelar yang sama.
create or replace function public.atur_terima_terlambat_kepsek(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_izin   boolean;
  v_status text;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa mengatur izin masuk kembali di sini' using errcode = '42501';
  end if;

  select sk.izin_kepsek, sk.status into v_izin, v_status
    from public.sesi_kelas sk
    join public.super_sesi ss on ss.id = sk.super_sesi_id
   where sk.id = p_sesi_id and ss.kepsek_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi dari Super Sesi milikmu' using errcode = '42501';
  end if;
  if not v_izin then
    raise exception 'Nyalakan izin kepala sekolah dulu' using errcode = 'P0001';
  end if;
  if v_status <> 'aktif' then
    raise exception 'Kelas ini sudah berakhir' using errcode = 'P0001';
  end if;

  update public.sesi_kelas set terima_terlambat = p_aktif where id = p_sesi_id;
end $$;

revoke all on function public.atur_terima_terlambat_kepsek(text, boolean) from public, anon;
grant execute on function public.atur_terima_terlambat_kepsek(text, boolean) to authenticated;


-- ── atur_terima_terlambat() guru: tolak selama izin kepala sekolah menyala ──
-- Sama dengan versi 20261007000000 selain pemeriksaan v_izin.
create or replace function public.atur_terima_terlambat(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_izin boolean;
begin
  select izin_kepsek into v_izin from public.sesi_kelas
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
  if v_izin then
    raise exception 'Kepala sekolah yang mengizinkan murid masuk kembali di kelas ini' using errcode = '42501';
  end if;

  update public.sesi_kelas set terima_terlambat = p_aktif where id = p_sesi_id;
end $$;


-- ── gabung_sesi(): pesan penolakan menyebut kepala sekolah kalau pintunya miliknya ──
-- Sama persis dengan versi 20261007000000 selain kalimat di blok T1.
create or replace function public.gabung_sesi(p_kode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesi   public.sesi_kelas;
  v_nama   text;
  v_global boolean;
begin
  if auth.uid() is null then
    raise exception 'Harus login dulu' using errcode = '28000';
  end if;

  select * into v_sesi
    from public.sesi_kelas
   where upper(kode_join) = upper(btrim(p_kode))
     and status = 'aktif'
   limit 1;

  if not found then
    if exists (select 1 from public.sesi_kelas where upper(kode_join) = upper(btrim(p_kode))) then
      raise exception 'Sesi sudah berakhir' using errcode = 'P0002';
    end if;
    raise exception 'Kode sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if now() > v_sesi.kode_kedaluwarsa then
    raise exception 'Kode sesi sudah kedaluwarsa' using errcode = 'P0002';
  end if;

  -- T1: sesudah dimulai, hanya yang sudah terdaftar yang boleh masuk lagi.
  if v_sesi.mulai_pada is not null
     and not v_sesi.terima_terlambat
     and not exists (select 1 from public.sesi_murid
                      where sesi_id = v_sesi.id and murid_id = auth.uid())
  then
    raise exception '%', case when v_sesi.izin_kepsek
      then 'Sesi sudah dimulai dan tidak menerima murid baru. Minta pengawasmu menghubungi kepala sekolah.'
      else 'Sesi sudah dimulai dan tidak menerima murid baru. Minta gurumu mengizinkan murid terlambat.'
    end using errcode = 'P0002';
  end if;

  select nama into v_nama from public.profiles where id = auth.uid();

  insert into public.sesi_murid (sesi_id, murid_id, nama)
  values (v_sesi.id, auth.uid(), coalesce(nullif(btrim(v_nama), ''), 'Murid'))
  on conflict (sesi_id, murid_id) do nothing;

  select coalesce((select kunci_layar_aktif from public.pengaturan_sesi where id = 1), true)
    into v_global;

  return jsonb_build_object(
    'id',              v_sesi.id,
    'judul',           v_sesi.judul,
    'deskripsi',       v_sesi.deskripsi,
    'durasi_menit',    v_sesi.durasi_menit,
    'status',          v_sesi.status,
    'mulai_pada',      v_sesi.mulai_pada,
    'tenggat',         case when v_sesi.mulai_pada is null then null
                            else public.sesi_tenggat(v_sesi.mulai_pada, v_sesi.durasi_menit) end,
    'jumlah_konten',   jsonb_array_length(v_sesi.konten_list),
    'jumlah_soal',     (select coalesce(sum(jsonb_array_length(k->'data')), 0)::int
                          from jsonb_array_elements(v_sesi.konten_list) k
                         where k->>'tipe' = 'soal' and jsonb_typeof(k->'data') = 'array'),
    'kunci_layar',     v_sesi.kunci_layar and v_global,
    'sekarang_server', now()
  );
end $$;

revoke all on function public.gabung_sesi(text) from public, anon;
grant execute on function public.gabung_sesi(text) to authenticated;


-- ── pantau_super_sesi(): tiap kiriman membawa status pintunya ───────────────
-- Sama persis dengan versi 20261006300000 selain 'terima_terlambat'. Flag izinnya
-- sendiri tidak perlu dibawa: kepala sekolah membacanya dari barisnya di super_sesi.
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
        'id', ss.id, 'mapel', ss.mapel, 'kelas', ss.kelas, 'jurusan', ss.jurusan, 'judul', ss.judul,
        'guru_mapel_nama', gp.nama, 'pengawas_id', ss.pengawas_id, 'pengawas_nama', pp.nama,
        'sesi_id', ss.sesi_id, 'kode_join', sk.kode_join, 'sesi_status', sk.status,
        'mulai_pada_sesi', sk.mulai_pada, 'kunci_layar', sk.kunci_layar,
        'terima_terlambat', coalesce(sk.terima_terlambat, false),
        'jumlah_murid', (select count(*) from public.sesi_murid m where m.sesi_id = ss.sesi_id),
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
      'id', ss.id, 'mapel', ss.mapel, 'kelas', ss.kelas, 'jurusan', ss.jurusan,
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
