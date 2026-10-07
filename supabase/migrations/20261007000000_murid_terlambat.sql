-- ═══ Murid terlambat (pintu ditutup setelah sesi dimulai) ═══════════════════════
-- Kunci layar (K1-K7) menempel pada baris sesi_murid, dan baris itu menempel pada
-- identitas anonim di perangkat murid. Murid yang terkunci tapi membuang
-- identitasnya (hapus data situs, mode privat, browser/HP lain) bergabung lagi
-- sebagai orang baru: baris baru, tanpa kunci, soal terbuka lagi. Begitu juga
-- murid yang sudah mengirim -- identitasnya dibuang sesudah dinilai (A3), jadi ia
-- bisa mengulang ujian sebagai orang baru.
--
-- Penutupnya: setelah sesi DIMULAI, gabung_sesi() hanya menerima identitas yang
-- sudah punya baris di sesi_murid (kembali ke baris sendiri, termasuk kuncinya).
-- Identitas baru ditolak, kecuali guru menyalakan `terima_terlambat` -- jalan
-- keluar untuk murid yang memang telat atau HP-nya mati.
--
-- Yang TIDAK tertutup: murid yang bergabung dua kali dari dua browser SEBELUM
-- sesi dimulai. Itu tampak di daftar guru sebagai dua baris bernama sama.

alter table public.sesi_kelas
  add column terima_terlambat boolean not null default false;

-- Sesi yang sudah berjalan saat migrasi ini masuk tidak boleh tiba-tiba menolak
-- murid di tengah ulangan: hanya sesi yang BELUM dimulai ikut aturan baru.
update public.sesi_kelas
   set terima_terlambat = true
 where status = 'aktif' and mulai_pada is not null;


-- ── gabung_sesi(): tolak identitas baru sesudah sesi dimulai ────────────────
-- Sama persis dengan versi 20260917200000_formulir.sql selain blok T1 di bawah.
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
    raise exception 'Sesi sudah dimulai dan tidak menerima murid baru. Minta gurumu mengizinkan murid terlambat.'
      using errcode = 'P0002';
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


-- ── atur_terima_terlambat(): sakelar guru pemegang sesi ─────────────────────
-- Berlaku juga untuk sesi hasil Super Sesi: pengawas yang menjalankan kelas di
-- depan murid, jadi ia yang tahu siapa yang memang terlambat. Beda dari kunci
-- layar (SS5), ini tidak menyentuh keputusan antar-kelas milik kepala sekolah.
create or replace function public.atur_terima_terlambat(p_sesi_id text, p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sesi_kelas
     set terima_terlambat = p_aktif
   where id = p_sesi_id and guru_id = auth.uid();
  if not found then
    raise exception 'Bukan sesi milikmu' using errcode = '42501';
  end if;
end $$;

revoke all on function public.atur_terima_terlambat(text, boolean) from public, anon;
grant execute on function public.atur_terima_terlambat(text, boolean) to authenticated;
