-- ═══ Kelas & mapel wajib diisi sebelum formulir bisa disimpan ══════════════
-- App ini SENGAJA membuang mapel/kelas Luang waktu dipisah (lihat CLAUDE.md,
-- "sesi_kelas.mapel/kelas dibuang, diganti formulir_id + deskripsi") --
-- permintaan pemilik produk (2026-09-23) membalik itu, TAPI cuma di sini
-- (`formulir`, satu formulir dipakai lintas sesi), bukan `sesi_kelas`.
--
-- Kelengkapannya ditegakkan di KLIEN (masalahFormulir(), memblokir tombol
-- Simpan), bukan CHECK constraint -- sama seperti judul/deskripsi yang juga
-- tidak punya CHECK "tidak boleh kosong" di database. Kolomnya boleh berisi ''
-- (baris lama dari sebelum migrasi ini SELALU begitu): guru yang membuka
-- formulir lama itu lagi akan diminta melengkapinya sebelum Simpan berikutnya.
alter table public.formulir
  add column kelas text not null default '',
  add column mapel text not null default '';
