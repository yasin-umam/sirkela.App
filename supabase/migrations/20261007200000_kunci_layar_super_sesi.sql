-- ═══ Kunci layar Super Sesi: satu sakelar, di tangan kepala sekolah ══════════════
-- 20261007100000_izin_kepsek.sql menambah sakelar "izin kepala sekolah" di samping
-- kunci layar per kelas dan sakelar pintu per kelas: tiga sakelar yang artinya
-- tumpang tindih. Digantikan SATU sakelar: `super_sesi.kunci_layar`.
--
-- Menyala:
--   * kunci layar berlaku di SEMUA kelas Super Sesi itu (yang aktif sekarang dan
--     yang lahir sesudahnya);
--   * izin masuk kembali murid ada di kepala sekolah, bukan pengawas (T3): murid
--     yang terkunci hanya dibuka kepala sekolah (SS5, tidak berubah), dan murid
--     dengan identitas BARU yang bergabung sesudah sesi dimulai tidak ditolak
--     (T1) melainkan masuk dalam keadaan TERKUNCI, jadi muncul di daftar kepala
--     sekolah dan menunggu "Buka". Tidak ada lagi sakelar pintu per kelas.
-- Mati: pintu murid terlambat kembali ke pengawas (T1/T2, tidak berubah).
--
-- Yang dibongkar dari migrasi sebelumnya: kolom izin_kepsek (super_sesi &
-- sesi_kelas), atur_izin_kepsek(), atur_terima_terlambat_kepsek(), dan
-- atur_kunci_layar_kepsek() -- yang terakhir karena kunci layar sekarang diatur
-- untuk seluruh Super Sesi, bukan per kelas, dan jalur per kelas akan membuat dua
-- sakelar menyimpang.

alter table public.super_sesi
  add column kunci_layar boolean not null default false;


-- ── Bongkar trigger lama (fungsinya dibuang di bawah) ───────────────────────
drop trigger sesi_kelas_jaga_izin_kepsek on public.sesi_kelas;
drop trigger sesi_kelas_salin_izin_kepsek on public.sesi_kelas;
drop trigger super_sesi_sebar_izin_kepsek on public.super_sesi;


-- ── Kelas yang lahir mewarisi kunci layar Super Sesi-nya ────────────────────
-- Menimpa kunci_layar bawaan formulir (super_sesi_soal.kunci_layar): di Super
-- Sesi kepala sekolah yang memutuskan (SS5). Stempel jeda diisi di sini juga,
-- karena urutan antar-trigger tidak boleh menentukan hasilnya.
create or replace function public.warisi_kunci_layar_super()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.super_sesi_id is not null then
    new.kunci_layar := coalesce(
      (select s.kunci_layar from public.super_sesi s where s.id = new.super_sesi_id), false);
    new.kunci_layar_sejak := case when new.kunci_layar then now() else null end;
  end if;
  return new;
end $$;

create trigger sesi_kelas_warisi_kunci_super
  before insert on public.sesi_kelas
  for each row execute function public.warisi_kunci_layar_super();


-- ── Sakelar berubah -> sebarkan ke kelas yang masih aktif ───────────────────
-- Menyala juga menutup lagi pintu yang sempat dibuka pengawas (T2). Mati
-- membebaskan semua murid yang sedang terkunci, seperti atur_kunci_layar().
create or replace function public.sebar_kunci_layar_super()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_kelas text;
begin
  update public.sesi_kelas
     set kunci_layar = new.kunci_layar,
         terima_terlambat = case when new.kunci_layar then false else terima_terlambat end
   where super_sesi_id = new.id and status = 'aktif';

  if not new.kunci_layar then
    for v_kelas in
      select id from public.sesi_kelas where super_sesi_id = new.id and status = 'aktif'
    loop
      perform public.bebaskan_kunci_semua(v_kelas);
    end loop;
  end if;
  return new;
end $$;

create trigger super_sesi_sebar_kunci_layar
  after update of kunci_layar on public.super_sesi
  for each row
  when (old.kunci_layar is distinct from new.kunci_layar)
  execute function public.sebar_kunci_layar_super();


-- ── Penjaga UPDATE ──────────────────────────────────────────────────────────
-- Guru bisa meng-UPDATE barisnya sendiri lewat REST (sesi_kelas_guru_all), jadi
-- RPC yang menolak (SS5) tidak cukup: kunci_layar kelas Super Sesi hanya boleh
-- diubah kepala sekolah pemiliknya. `auth.uid() is not null` membiarkan SQL
-- editor / service role (pemilik produk) lewat.
create or replace function public.jaga_kunci_layar_super()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.super_sesi_id is not null
     and auth.uid() is not null
     and new.kunci_layar is distinct from old.kunci_layar
     and not exists (select 1 from public.super_sesi s
                      where s.id = old.super_sesi_id and s.kepsek_id = auth.uid())
  then
    raise exception 'Kunci layar kelas ini diatur kepala sekolah' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger sesi_kelas_jaga_kunci_super
  before update of kunci_layar on public.sesi_kelas
  for each row execute function public.jaga_kunci_layar_super();


-- ── Sakelar kepala sekolah ──────────────────────────────────────────────────
create or replace function public.atur_kunci_layar_super(p_super_sesi_id uuid, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.adalah_kepsek() then
    raise exception 'Hanya kepala sekolah yang bisa mengatur kunci layar di sini' using errcode = '42501';
  end if;

  select status into v_status from public.super_sesi
   where id = p_super_sesi_id and kepsek_id = auth.uid();
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_status = 'selesai' then
    raise exception 'Super Sesi ini sudah diakhiri' using errcode = 'P0001';
  end if;

  update public.super_sesi set kunci_layar = p_aktif where id = p_super_sesi_id;
end $$;

revoke all on function public.atur_kunci_layar_super(uuid, boolean) from public, anon;
grant execute on function public.atur_kunci_layar_super(uuid, boolean) to authenticated;


-- ── gabung_sesi(): murid baru di kelas yang dipegang kepala sekolah masuk terkunci ──
-- Sama dengan versi 20261007100000 selain blok T1. Di kelas Super Sesi yang
-- kunci layarnya menyala, identitas baru sesudah Mulai TIDAK ditolak: barisnya
-- lahir terkunci, supaya kepala sekolah yang memutuskan lewat tombol Buka.
-- (Kunci efektif tetap butuh sakelar darurat global menyala, K1.)
create or replace function public.gabung_sesi(p_kode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesi     public.sesi_kelas;
  v_nama     text;
  v_global   boolean;
  v_terkunci boolean := false;
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

  -- T1/T3: sesudah dimulai, identitas baru ditolak -- kecuali kunci layar Super
  -- Sesi menyala (masuk terkunci) atau pengawas membuka pintunya (T2).
  if v_sesi.mulai_pada is not null
     and not exists (select 1 from public.sesi_murid
                      where sesi_id = v_sesi.id and murid_id = auth.uid())
  then
    if v_sesi.super_sesi_id is not null and v_sesi.kunci_layar then
      v_terkunci := true;
    elsif not v_sesi.terima_terlambat then
      raise exception 'Sesi sudah dimulai dan tidak menerima murid baru. Minta gurumu mengizinkan murid terlambat.'
        using errcode = 'P0002';
    end if;
  end if;

  select nama into v_nama from public.profiles where id = auth.uid();

  insert into public.sesi_murid (sesi_id, murid_id, nama, terkunci_pada)
  values (v_sesi.id, auth.uid(), coalesce(nullif(btrim(v_nama), ''), 'Murid'),
          case when v_terkunci then now() end)
  on conflict (sesi_id, murid_id) do nothing;
  if v_terkunci and found then
    insert into public.sesi_peristiwa (sesi_id, murid_id, jenis)
    values (v_sesi.id, auth.uid(), 'dikunci');
  end if;

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


-- ── atur_terima_terlambat() pengawas: tolak selama kunci layar Super Sesi menyala ──
-- Pintu itu tak lagi bermakna di sana (murid baru masuk terkunci), dan izinnya
-- milik kepala sekolah.
create or replace function public.atur_terima_terlambat(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super uuid;
  v_kunci boolean;
begin
  select super_sesi_id, kunci_layar into v_super, v_kunci from public.sesi_kelas
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
  if v_super is not null and v_kunci then
    raise exception 'Kunci layar Super Sesi menyala: kepala sekolah yang mengizinkan murid masuk kembali' using errcode = '42501';
  end if;

  update public.sesi_kelas set terima_terlambat = p_aktif where id = p_sesi_id;
end $$;


-- ── Bawa keadaan lama ───────────────────────────────────────────────────────
-- Super Sesi yang izin kepala sekolahnya menyala, atau yang kelas aktifnya sudah
-- berkunci, jadi berkunci di seluruh kelasnya (trigger menyebarkannya).
update public.super_sesi s
   set kunci_layar = true
 where s.status <> 'selesai'
   and (s.izin_kepsek
        or exists (select 1 from public.sesi_kelas k
                    where k.super_sesi_id = s.id and k.status = 'aktif' and k.kunci_layar));


-- ── Buang yang digantikan ───────────────────────────────────────────────────
drop function public.jaga_izin_kepsek();
drop function public.salin_izin_kepsek_ke_sesi();
drop function public.sebar_izin_kepsek();
drop function public.atur_izin_kepsek(uuid, boolean);
drop function public.atur_terima_terlambat_kepsek(text, boolean);
drop function public.atur_kunci_layar_kepsek(text, boolean);

alter table public.sesi_kelas drop column izin_kepsek;
alter table public.super_sesi drop column izin_kepsek;
