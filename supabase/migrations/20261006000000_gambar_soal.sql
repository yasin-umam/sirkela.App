-- ═══ Gambar di soal ═════════════════════════════════════════════════════════
-- Satu soal boleh membawa SATU gambar (diagram, peta, grafik, foto) yang tampil
-- di bawah teks pertanyaan, di layar murid maupun tinjauan guru. Gambar di opsi
-- belum ada.
--
-- Berkasnya hidup di Supabase Storage (bucket `gambar-soal`), BUKAN di kolom:
-- konten_list dibaca ulang lewat status_sesi() (md5) dan ambil_konten_sesi(), dan
-- gambar base64 di dalamnya membengkakkan setiap polling sesi.
--
-- ═══ Aturan baru ═════════════════════════════════════════════════════════════
--   G1  Berkas gambar TAK BERUBAH dan TAK PERNAH dihapus: tiap unggahan memakai
--       path acak baru, bucket tidak punya policy UPDATE maupun DELETE. Itu yang
--       menjaga A6 tetap benar -- sesi & kiriman Super Sesi memegang SALINAN soal
--       (path ikut tersalin), jadi berkas yang dihapus atau ditimpa akan merusak
--       sesi yang sudah berjalan. Harganya: berkas yatim menumpuk (lihat CLAUDE.md).
--   G2  Hanya staf (adalah_guru()) yang bisa mengunggah, dan hanya ke folder
--       bernama id-nya sendiri. Murid anonim tidak punya jalan menulis ke bucket.
--   G3  `bank_soal.gambar` dibatasi CHECK ke bentuk `<uuid>/<uuid>.jpg`. Path itu
--       disalin ke murid dan disambung ke URL storage di klien, jadi kolom bebas
--       akan membiarkan guru menyelipkan `../` atau path bucket lain.
--   Bucket PUBLIK (G1 + G2 mengatur siapa yang menulis; membaca tidak dijaga):
--   path-nya tak bisa ditebak dan hanya sampai ke murid lewat ambil_konten_sesi(),
--   tapi siapa pun yang memegang URL-nya bisa membukanya. Kunci jawaban TIDAK
--   pernah ada di gambar (A1 tidak terdampak).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1. Kolom ═══════════════════════════════════════════════════════════════

alter table public.bank_soal
  add column gambar text;

alter table public.bank_soal
  add constraint bank_soal_gambar_valid check (
    gambar is null
    or gambar ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );


-- ═══ 2. Snapshot ════════════════════════════════════════════════════════════
-- Sama dengan versi 20260924100000_super_sesi.sql, ditambah `gambar` HANYA kalau
-- ada: snapshot soal tanpa gambar tetap persis berbentuk seperti sebelumnya.
-- Dipakai buka_sesi_formulir() DAN kirim_ke_super_sesi(), jadi dua jalur itu
-- membawa gambar tanpa disentuh. ambil_konten_sesi() cuma membuang
-- `jawabanBenar`, jadi `gambar` sampai ke murid apa adanya.

create or replace function public.rakit_snapshot_soal(p_formulir_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_agg(
           jsonb_build_object(
             'id',           id::text,
             'pertanyaan',   btrim(pertanyaan),
             'pilihan',      to_jsonb(pilihan),
             'jawabanBenar', jawaban_benar
           ) || case when gambar is null then '{}'::jsonb
                     else jsonb_build_object('gambar', gambar) end
           order by urutan, created_at)
    from public.bank_soal
   where formulir_id = p_formulir_id
$$;

revoke all on function public.rakit_snapshot_soal(uuid) from public, anon, authenticated;


-- ═══ 3. Bucket ══════════════════════════════════════════════════════════════
-- Klien mengecilkan gambar jadi JPEG <= 1600 px sebelum mengunggah, kualitas
-- diturunkan bertahap sampai di bawah ~900 KB. Batas 2 MB di sini jaring
-- pengaman untuk klien yang dimodifikasi, bukan ukuran yang diharapkan.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gambar-soal', 'gambar-soal', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- G1: HANYA insert. Tanpa policy update/delete/select, upsert dan penghapusan
-- lewat REST ditolak; bucket publik melayani bacaan tanpa melewati RLS.
create policy "gambar_soal_staf_unggah" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gambar-soal'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.adalah_guru())
  );
