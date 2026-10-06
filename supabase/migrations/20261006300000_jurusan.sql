-- ═══ Jurusan (SMA & SMK) ═══════════════════════════════════════════════════════
-- Formulir sudah punya `kelas` dan `mapel` (20260923000000_kelas_mapel.sql). SMA
-- (IPA/IPS/Bahasa) dan SMK (TKJ, RPL, Akuntansi, ...) juga punya JURUSAN, yang
-- ikut menentukan siapa yang mengerjakan soalnya. `jurusan` dulu ada di
-- `bank_soal` (skema awal) lalu dibuang saat `formulir` lahir; sekarang kembali,
-- tapi di tempat yang benar: di formulir, bukan di tiap soal.
--
-- OPSIONAL, beda dari kelas/mapel: SD dan SMP tidak punya jurusan, jadi kolomnya
-- boleh '' dan editor tidak menagihnya (masalahFormulir() tidak berubah).
--
-- Jurusan mengikuti jalur yang sama dengan kelas & mapel:
--   formulir.jurusan  ->  super_sesi_soal.jurusan (salinan saat kirim, SS1)
--                     ->  pantau_super_sesi() (kepala sekolah & guru pengirim)
--                     ->  ambil_kelas_tersedia_super_sesi() (guru yang mau mengambil)
-- sesi_kelas TIDAK diberi kolom jurusan: sesi sengaja tidak membawa kelas/mapel
-- (lihat CLAUDE.md), dan kelas Super Sesi yang belum diklaim membacanya lewat
-- super_sesi_soal seperti kelas/mapel.

alter table public.formulir
  add column jurusan text not null default '';

alter table public.super_sesi_soal
  add column jurusan text not null default '';


-- ── kirim_ke_super_sesi(): snapshot ikut membawa jurusan ────────────────────
-- Sama persis dengan versi 20260924100000 selain kolom jurusan.
create or replace function public.kirim_ke_super_sesi(p_formulir_id uuid, p_super_sesi_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form    public.formulir;
  v_super   public.super_sesi;
  v_masalah text;
  v_soal    jsonb;
  v_id      uuid := gen_random_uuid();
  v_judul   text;
begin
  if not public.adalah_guru() then
    raise exception 'Hanya guru yang bisa mengirim ke Super Sesi' using errcode = '42501';
  end if;

  select * into v_form from public.formulir where id = p_formulir_id and guru_id = auth.uid();
  if not found then
    raise exception 'Formulir tidak ditemukan' using errcode = 'P0002';
  end if;

  select * into v_super from public.super_sesi where id = p_super_sesi_id;
  if not found then
    raise exception 'Super Sesi tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_super.sekolah_id is distinct from (select public.sekolah_saya()) then
    raise exception 'Super Sesi ini bukan dari sekolahmu' using errcode = '42501';
  end if;
  if v_super.status <> 'mengumpulkan' then
    raise exception 'Super Sesi ini sudah tidak menerima kiriman' using errcode = 'P0001';
  end if;

  v_masalah := public.masalah_soal_formulir(p_formulir_id);
  if v_masalah is not null then
    raise exception '%', v_masalah using errcode = '22023';
  end if;

  v_soal := public.rakit_snapshot_soal(p_formulir_id);
  if v_soal is null then
    raise exception 'Formulir belum berisi soal' using errcode = '22023';
  end if;

  v_judul := coalesce(nullif(btrim(v_form.judul), ''), 'Formulir tanpa judul');

  begin
    insert into public.super_sesi_soal (
      id, super_sesi_id, formulir_id, guru_mapel_id, judul, deskripsi, kelas, jurusan, mapel,
      durasi_menit, kunci_layar, konten_list
    ) values (
      v_id, p_super_sesi_id, p_formulir_id, auth.uid(), v_judul, btrim(v_form.deskripsi),
      v_form.kelas, v_form.jurusan, v_form.mapel, v_form.durasi_menit, v_form.kunci_layar,
      jsonb_build_array(jsonb_build_object(
        'id', 'konten-' || v_id::text, 'tipe', 'soal', 'judul', v_judul, 'data', v_soal
      ))
    );
  exception when unique_violation then
    raise exception 'Formulir ini sudah dikirim ke Super Sesi yang sama' using errcode = '23505';
  end;

  return v_id;
end $$;

revoke all on function public.kirim_ke_super_sesi(uuid, uuid) from public, anon;
grant execute on function public.kirim_ke_super_sesi(uuid, uuid) to authenticated;


-- ── pantau_super_sesi(): kiriman membawa jurusan ────────────────────────────
-- Sama persis dengan versi 20260924300000 selain 'jurusan' di kedua cabang.
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


-- ── ambil_kelas_tersedia_super_sesi(): daftar kelas membawa jurusan ─────────
-- Kolom keluarannya bertambah, dan `create or replace` tidak boleh mengubah tipe
-- kembalian -- jadi dibuang dulu lalu dibuat ulang beserta grant-nya. Isinya
-- sama dengan versi 20260925000000 (SS8: metadata saja, TANPA konten_list).
drop function if exists public.ambil_kelas_tersedia_super_sesi();

create function public.ambil_kelas_tersedia_super_sesi()
returns table(
  sesi_id text, mapel text, kelas text, jurusan text, judul text,
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
    select sk.id, ss.mapel, ss.kelas, ss.jurusan, sk.judul, sk.super_sesi_judul, sk.durasi_menit, sk.created_at
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
