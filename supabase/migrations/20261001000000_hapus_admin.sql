-- ═══ Hapus peran admin ═══════════════════════════════════════════════════════
-- Keputusan pemilik produk (2026-10-01): aplikasi dijual sepaket dengan akun
-- kepala sekolah yang SUDAH disiapkan pemilik, jadi tidak ada lagi admin di
-- dalam aplikasi. Yang dihapus:
--   - alur pengajuan "guru jadi kepala sekolah" beserta persetujuannya
--     (20260924200000_pengajuan_kepsek, 20260924600000_satu_kepsek_per_sekolah)
--   - layar admin: daftar & pembuatan sekolah (20260924400000_admin_sekolah)
--   - adalah_admin_utama(), yang membaca SATU email yang di-hardcode di badan
--     fungsinya
--
-- Peran kepala_sekolah TETAP hanya lahir dari server (M1/SK1: handle_new_user()
-- selalu menulis 'guru' untuk akun non-anonim). Bedanya, promosinya sekarang
-- dilakukan skrip pemilik dengan service role key, scripts/buat-kepala-sekolah.mjs,
-- bukan RPC yang bisa dipanggil dari klien. Baris `sekolah` juga dibuat skrip itu.
--
-- Migrasi lama SENGAJA tidak diubah (riwayatnya tetap utuh); ini migrasi baru yang
-- membongkar hasilnya. Aman dijalankan di project yang sudah memakai fitur lama
-- maupun project baru yang menjalankan semua migrasi dari awal.

-- Tabelnya dihapus lebih dulu: policy `pengajuan_kepsek_admin_select` memanggil
-- adalah_admin_utama(), dan policy ikut jatuh bersama tabelnya.
drop table if exists public.pengajuan_kepala_sekolah;

drop function if exists public.ambil_pengajuan_kepsek();
drop function if exists public.putuskan_pengajuan_kepsek(uuid, boolean);
drop function if exists public.ajukan_kepala_sekolah();
drop function if exists public.sekolah_punya_kepsek();
drop function if exists public.ambil_semua_sekolah();
drop function if exists public.buat_sekolah(text, text);
drop function if exists public.adalah_admin_utama();
