-- ═══════════════════════════════════════════════════════════════════════════
-- Formulir: halaman guru ala Google Form.
--
-- Sebelumnya soal hidup sebagai "kelompok simpan" di bank_soal (simpan_id +
-- mapel/kelas/jurusan di tiap baris) dan sesi dirakit tangan dari kelompok-
-- kelompok itu. Sekarang satu FORMULIR = judul + deskripsi + daftar soal
-- berurutan + setelan sesi, dan tombol "Kirim" membuka sesi darinya.
--
--   F1  Soal di editor boleh berupa DRAF (kunci belum dipilih, satu opsi,
--       pertanyaan kosong) -- editor menyimpan otomatis tiap ketikan seperti
--       Google Form, jadi CHECK "harus lengkap" di skema awal menolak hampir
--       semua simpanan antara. Kelengkapan dipindah ke pintu keluar satu-
--       satunya: buka_sesi_formulir().
--   F2  Snapshot sesi (A6) dirakit SERVER dari bank_soal, bukan dikirim klien.
--       Klien yang dimodifikasi tidak bisa membuka sesi berisi kunci yang
--       menunjuk opsi yang tidak ada.
--   F3  Soal hanya boleh masuk ke formulir milik guru yang sama. FK saja tidak
--       memeriksa RLS: tanpa policy restrictive di bawah, guru A bisa menyisipkan
--       soal ke formulir guru B asal tahu id-nya.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1. Formulir ════════════════════════════════════════════════════════════

create table public.formulir (
  id              uuid        primary key default gen_random_uuid(),
  guru_id         uuid        not null default auth.uid()
                              references public.profiles(id) on delete cascade,
  judul           text        not null default 'Formulir tanpa judul',
  deskripsi       text        not null default '',
  -- Setelan sesi yang dibuka dari formulir ini (tab Setelan).
  durasi_menit    int         not null default 45 check (durasi_menit between 1 and 600),
  kunci_layar     boolean     not null default false,
  -- formId Google Form asal impor terakhir. Penanda saja, tidak disinkronkan.
  gform_id        text,
  created_at      timestamptz not null default now(),
  -- Urutan daftar formulir di menu. Disentuh trigger, termasuk saat SOALNYA berubah.
  diperbarui_pada timestamptz not null default now()
);

create index formulir_guru_idx on public.formulir (guru_id, diperbarui_pada desc);

alter table public.formulir enable row level security;

create policy "formulir_pemilik" on public.formulir
  for all using (auth.uid() = guru_id) with check (auth.uid() = guru_id);
-- Sama dengan M2: akun anonim murid tidak boleh membuat apa pun di sisi guru.
create policy "formulir_hanya_guru" on public.formulir
  as restrictive
  for all to authenticated
  using ((select public.adalah_guru()))
  with check ((select public.adalah_guru()));

create or replace function public.sentuh_diperbarui_pada()
returns trigger
language plpgsql
as $$
begin
  new.diperbarui_pada := now();
  return new;
end $$;

create trigger formulir_sentuh
  before update on public.formulir
  for each row execute function public.sentuh_diperbarui_pada();


-- ═══ 2. bank_soal jadi isi formulir ═════════════════════════════════════════

alter table public.bank_soal
  add column formulir_id uuid references public.formulir(id) on delete cascade;

-- Satu kelompok simpan lama = satu formulir. Baris tanpa simpan_id dikelompokkan
-- per detik created_at, aturan yang sama dengan kelompokkanBankSoal() di klien
-- lama. Judul dirakit dari mapel & kelas -- satu-satunya nama yang dimiliki
-- kelompok itu.
create temporary table peta_formulir as
  select gen_random_uuid() as id, guru_id, kunci, dibuat, judul
    from (
      select guru_id,
             coalesce(simpan_id, date_trunc('second', created_at)::text) as kunci,
             min(created_at) as dibuat,
             (array_agg(nullif(concat_ws(' · ', nullif(btrim(mapel), ''), nullif(btrim(kelas), '')), '')
                        order by urutan, created_at))[1] as judul
        from public.bank_soal
       group by 1, 2
    ) k;

insert into public.formulir (id, guru_id, judul, created_at, diperbarui_pada)
select id, guru_id, coalesce(judul, 'Formulir tanpa judul'), dibuat, dibuat
  from peta_formulir;

update public.bank_soal b
   set formulir_id = p.id
  from peta_formulir p
 where p.guru_id = b.guru_id
   and p.kunci = coalesce(b.simpan_id, date_trunc('second', b.created_at)::text);

drop table peta_formulir;

alter table public.bank_soal alter column formulir_id set not null;

-- Klasifikasi pindah ke judul formulir; simpan_id digantikan formulir_id.
alter table public.bank_soal
  drop column simpan_id,
  drop column mapel,
  drop column kelas,
  drop column jurusan;

-- F1: draf boleh tersimpan. Yang TETAP dijaga di sini: kunci (kalau ada) harus
-- menunjuk opsi yang ada, dan soal tidak pernah tanpa opsi sama sekali.
alter table public.bank_soal
  drop constraint bank_soal_pilihan_cukup,
  drop constraint bank_soal_kunci_valid;
alter table public.bank_soal
  alter column jawaban_benar drop not null,
  alter column pertanyaan set default '',
  alter column pilihan set default array['Opsi 1'];
alter table public.bank_soal
  add constraint bank_soal_pilihan_ada check (coalesce(array_length(pilihan, 1), 0) >= 1),
  add constraint bank_soal_kunci_valid check (
    jawaban_benar is null
    or (jawaban_benar >= 0 and jawaban_benar < coalesce(array_length(pilihan, 1), 0))
  );

drop index public.bank_soal_guru_idx;
create index bank_soal_formulir_idx on public.bank_soal (formulir_id, urutan);

-- F3
create policy "bank_soal_formulir_sendiri" on public.bank_soal
  as restrictive
  for all to authenticated
  using (exists (select 1 from public.formulir f
                  where f.id = bank_soal.formulir_id and f.guru_id = (select auth.uid())))
  with check (exists (select 1 from public.formulir f
                       where f.id = bank_soal.formulir_id and f.guru_id = (select auth.uid())));

-- Mengetik di satu soal = formulirnya naik ke atas daftar menu.
create or replace function public.sentuh_formulir_dari_soal()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.formulir set diperbarui_pada = now() where id = old.formulir_id;
  else
    update public.formulir set diperbarui_pada = now() where id = new.formulir_id;
  end if;
  return null;
end $$;

create trigger bank_soal_sentuh_formulir
  after insert or update or delete on public.bank_soal
  for each row execute function public.sentuh_formulir_dari_soal();


-- ═══ 3. Sesi berasal dari formulir ══════════════════════════════════════════

-- set null, bukan cascade: menghapus formulir tidak boleh menghapus nilai murid
-- dari sesi yang sudah berjalan. Sesinya tetap utuh karena memegang salinan (A6).
alter table public.sesi_kelas
  add column formulir_id uuid references public.formulir(id) on delete set null,
  add column deskripsi text not null default '',
  drop column mapel,
  drop column kelas;

create index sesi_kelas_formulir_idx on public.sesi_kelas (formulir_id, created_at desc);

-- F2: satu-satunya jalan membuka sesi dari formulir. Mengembalikan baris sesi
-- utuh -- pemanggilnya guru pemilik, yang memang boleh melihat semua kolomnya.
create or replace function public.buka_sesi_formulir(p_formulir_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form    public.formulir;
  v_masalah text;
  v_soal    jsonb;
  v_id      text := gen_random_uuid()::text;
  v_judul   text;
  v_kode    text;
  v_sesi    public.sesi_kelas;
  -- Tanpa I, O, 0, 1 -- huruf yang paling sering salah dieja di depan kelas.
  v_huruf   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not public.adalah_guru() then
    raise exception 'Hanya guru yang bisa membuka sesi' using errcode = '42501';
  end if;

  select * into v_form from public.formulir
   where id = p_formulir_id and guru_id = auth.uid();
  if not found then
    raise exception 'Formulir tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Soal PERTAMA yang belum siap disebut nomornya, supaya guru tahu harus
  -- menggulir ke mana. Nomor dihitung sebelum disaring.
  select format('Soal nomor %s: %s', n, alasan) into v_masalah
    from (
      select row_number() over (order by urutan, created_at) as n,
             case
               when btrim(pertanyaan) = '' then 'pertanyaan masih kosong'
               when coalesce(array_length(pilihan, 1), 0) < 2 then 'butuh minimal 2 opsi'
               when exists (select 1 from unnest(pilihan) p where btrim(p) = '') then 'ada opsi yang masih kosong'
               when jawaban_benar is null then 'kunci jawaban belum dipilih'
             end as alasan
        from public.bank_soal
       where formulir_id = p_formulir_id
    ) t
   where alasan is not null
   order by n
   limit 1;
  if v_masalah is not null then
    raise exception '%', v_masalah using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
           'id',           id::text,
           'pertanyaan',   btrim(pertanyaan),
           'pilihan',      to_jsonb(pilihan),
           'jawabanBenar', jawaban_benar
         ) order by urutan, created_at)
    into v_soal
    from public.bank_soal
   where formulir_id = p_formulir_id;
  if v_soal is null then
    raise exception 'Formulir belum berisi soal' using errcode = '22023';
  end if;

  v_judul := coalesce(nullif(btrim(v_form.judul), ''), 'Formulir tanpa judul');

  -- Kode hanya unik di antara sesi aktif (sesi_kelas_kode_join_aktif_unik).
  -- Tabrakan diulang di sini, bukan dilempar ke guru sebagai "coba lagi".
  for i in 1..10 loop
    v_kode := (select string_agg(substr(v_huruf, 1 + floor(random() * length(v_huruf))::int, 1), '')
                 from generate_series(1, 3))
           || '-'
           || (select string_agg(substr(v_huruf, 1 + floor(random() * length(v_huruf))::int, 1), '')
                 from generate_series(1, 3));
    begin
      insert into public.sesi_kelas (
        id, guru_id, formulir_id, judul, deskripsi, durasi_menit, kode_join, konten_list, kunci_layar
      ) values (
        v_id, auth.uid(), v_form.id, v_judul, btrim(v_form.deskripsi), v_form.durasi_menit, v_kode,
        -- Bentuk konten_list TIDAK berubah (satu item tipe 'soal'): ambil_konten_sesi
        -- dan selesaikan_murid membacanya persis seperti sebelumnya.
        jsonb_build_array(jsonb_build_object(
          'id', 'konten-' || v_id, 'tipe', 'soal', 'judul', v_judul, 'data', v_soal
        )),
        v_form.kunci_layar
      )
      returning * into v_sesi;
      exit;
    exception when unique_violation then
      if i = 10 then raise; end if;
    end;
  end loop;

  return to_jsonb(v_sesi);
end $$;

-- Sama dengan skema awal, ditambah `deskripsi` & `jumlah_soal` untuk kartu
-- kepala formulir di layar murid. Selebihnya TIDAK berubah (A2, A3).
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


-- ═══ 4. Hak eksekusi ════════════════════════════════════════════════════════

revoke all on function public.buka_sesi_formulir(uuid) from public, anon;
grant execute on function public.buka_sesi_formulir(uuid) to authenticated;
-- create or replace mempertahankan grant lama gabung_sesi; diulang supaya
-- migration ini tidak bergantung pada itu.
revoke all on function public.gabung_sesi(text) from public, anon;
grant execute on function public.gabung_sesi(text) to authenticated;

revoke all on function public.sentuh_diperbarui_pada() from public, anon, authenticated;
revoke all on function public.sentuh_formulir_dari_soal() from public, anon, authenticated;
