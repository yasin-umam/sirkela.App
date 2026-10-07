import type {
  HasilSoal, KelasSuperSesiTersedia, MuridSuperSesi, PesertaSesi, SesiKelas, Soal,
  SubmisiSuperSesi, SuperSesi,
} from '../types'
import type { RingkasFormulir } from '../context/FormulirContext'
import type { JawabanSoalMurid } from './sesiGuru'

// ─── Data contoh untuk MENGUJI TAMPILAN tanpa Supabase ───────────────────────
// Aktif hanya kalau `VITE_UJI_TAMPILAN` diisi (`VITE_UJI_TAMPILAN=1 npm run dev`);
// `VITE_UJI_PERAN=kepala_sekolah` masuk sebagai kepala sekolah. Konteks-konteks
// (Auth, Formulir, Sesi, SuperSesi) dan bacaHasilSoalSesi punya cabang yang
// membaca berkas ini; build produksi membuang semuanya (cabangnya mati karena
// variabelnya tidak terisi). Waktu dihitung dari SEKARANG supaya sisa waktu sesi
// dan "senyap" selalu masuk akal.

export const PERAN_UJI: 'guru' | 'kepala_sekolah' =
  import.meta.env.VITE_UJI_PERAN === 'kepala_sekolah' ? 'kepala_sekolah' : 'guru'

const menitLalu = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const hariLalu = (h: number) => menitLalu(h * 24 * 60)

// ─── Formulir & soal ─────────────────────────────────────────────────────────

function formulir(
  id: string, judul: string, kelas: string, mapel: string, jumlahSoal: number, durasiMenit: number, diperbarui: string,
  jurusan = '',
): RingkasFormulir {
  return { id, judul, deskripsi: '', kelas, jurusan, mapel, durasiMenit, kunciLayar: false, jumlahSoal,
    dibuatPada: hariLalu(14), diperbaruiPada: diperbarui }
}

export function formulirUji(): RingkasFormulir[] {
  return [
    formulir('f1', 'Ulangan Harian: Jaringan Dasar', 'XI-1', 'Administrasi Sistem Jaringan', 6, 45, menitLalu(40), 'TKJ'),
    formulir('f2', 'Kuis Topologi Jaringan', 'X-2', 'Dasar Desain Jaringan', 3, 20, menitLalu(26 * 60), 'TKJ'),
    formulir('f3', 'PAS Ganjil: Teknologi Layanan Jaringan', 'XI TKJ 2', 'Teknologi Layanan Jaringan', 40, 90, hariLalu(4)),
    formulir('f4', 'Remedial Matematika Bab 2', 'X TKJ 2', 'Matematika', 15, 30, hariLalu(6)),
    formulir('f5', 'Latihan Subnetting', '', '', 0, 30, hariLalu(8)),
    formulir('f6', 'Ulangan Harian: Model OSI', 'X TKJ 1', 'Dasar Desain Jaringan', 20, 40, hariLalu(12)),
    formulir('f7', 'Kuis Alamat IP', 'X TKJ 1', 'Dasar Desain Jaringan', 12, 20, hariLalu(14)),
    formulir('f8', 'PTS Ganjil: Administrasi Infrastruktur Jaringan', 'XII TKJ 1', 'Administrasi Infrastruktur Jaringan', 35, 90, hariLalu(21)),
  ]
}

export function soalUji(formulirId: string): Soal[] {
  const s = (n: number, pertanyaan: string, pilihan: string[], jawabanBenar: number | null): Soal =>
    ({ id: `${formulirId}-s${n}`, formulirId, pertanyaan, pilihan, jawabanBenar, gambar: null, urutan: n - 1 })
  return [
    s(1, 'Topologi jaringan yang semua perangkatnya terhubung ke satu titik pusat disebut…', ['Bus', 'Star', 'Ring', 'Mesh'], 1),
    s(2, 'Kelebihan utama topologi mesh dibandingkan topologi bus adalah…', ['Biaya instalasi lebih murah', 'Kabel yang dipakai lebih sedikit', 'Tahan terhadap kegagalan satu jalur', 'Konfigurasi paling sederhana'], 2),
    s(3, 'Kabel apa yang biasa dipakai menghubungkan switch ke router pada jarak 50 meter?', ['UTP Cat5e', 'Koaksial', 'Serat optik single-mode', 'Kabel serial'], 0),
    s(4, 'Perangkat yang bekerja pada layer 3 model OSI adalah…', ['Hub', 'Switch', 'Router', 'Repeater'], null),
    s(5, 'Berapa jumlah host valid pada jaringan 192.168.1.0/24?', ['254', '255', '256', '128'], 0),
    s(6, '', ['Opsi 1', 'Opsi 2'], null),
  ]
}

/** Soal contoh: f1 sengaja punya dua soal belum lengkap (untuk melihat penandanya); formulir lain lengkap. */
export function soalUjiFormulir(formulirId: string): Soal[] {
  const semua = soalUji(formulirId)
  return formulirId === 'f1' ? semua : semua.slice(0, 3)
}

// ─── Sesi ────────────────────────────────────────────────────────────────────

const NAMA_MURID = [
  'Farhan Maulana', 'Indah Safitri', 'Aditya Pratama', 'Bagas Setiawan', 'Citra Lestari', 'Dewi Anggraini',
  'Eko Prasetyo', 'Gita Permata', 'Hendra Wijaya', 'Joko Santoso', 'Kirana Putri', 'Lutfi Hakim',
]

function peserta(kunci: boolean): PesertaSesi[] {
  return NAMA_MURID.map((nama, i): PesertaSesi => {
    const terkunci = kunci && i < 2
    const senyap = i === 5 || i === 8
    return {
      muridId: `m${i + 1}`, nama,
      terakhirDenyut: senyap ? menitLalu(1.5) : new Date().toISOString(),
      keluarLayar: i === 0 ? 2 : i === 1 || i === 8 ? 1 : 0,
      hilangFokus: i === 0 || i === 3 ? 1 : 0,
      terkunciPada: terkunci ? menitLalu(i === 0 ? 1.7 : 0.6) : null,
    }
  })
}

const HASIL_SOAL: HasilSoal[] = soalUji('f2').slice(0, 3).map(s => ({
  id: s.id, pertanyaan: s.pertanyaan, pilihan: s.pilihan, jawabanBenar: s.jawabanBenar ?? 0,
}))

function sesi(p: Partial<SesiKelas> & Pick<SesiKelas, 'id' | 'judul' | 'kodeJoin'>): SesiKelas {
  return {
    formulirId: null, deskripsi: '', durasiMenit: 45, mulaiPada: null, selesaiPada: null, status: 'aktif',
    kontenList: [{ id: 'k1', tipe: 'soal', judul: p.judul, data: HASIL_SOAL }],
    kunciLayar: false, terimaTerlambat: false, muridJoined: [], dibuatPada: menitLalu(60), superSesiId: null, superSesiJudul: null,
    ...p,
  }
}

export function sesiUji(): SesiKelas[] {
  return [
    sesi({ id: 'sesi1', formulirId: 'f1', judul: 'Ulangan Harian: Jaringan Dasar', kodeJoin: 'ASJ-482',
      mulaiPada: menitLalu(7), kunciLayar: true, muridJoined: peserta(true), dibuatPada: menitLalu(15) }),
    sesi({ id: 'sesi2', judul: 'PAS Ganjil: Teknologi Layanan Jaringan', kodeJoin: 'TLJ-117', durasiMenit: 90,
      superSesiId: 'ss1', superSesiJudul: 'PAS Ganjil 2026/2027', dibuatPada: menitLalu(30) }),
    sesi({ id: 'sesi3', formulirId: 'f2', judul: 'Kuis Topologi Jaringan', kodeJoin: 'DDJ-310', durasiMenit: 20,
      status: 'selesai', mulaiPada: hariLalu(12), selesaiPada: hariLalu(12), muridJoined: peserta(false), dibuatPada: hariLalu(12) }),
    sesi({ id: 'sesi4', formulirId: 'f6', judul: 'Ulangan Harian: Model OSI', kodeJoin: 'DDJ-221', durasiMenit: 40,
      status: 'selesai', mulaiPada: hariLalu(19), selesaiPada: hariLalu(19), muridJoined: peserta(false).slice(0, 10), dibuatPada: hariLalu(19) }),
    sesi({ id: 'sesi5', formulirId: 'f7', judul: 'Kuis Alamat IP', kodeJoin: 'DDJ-118', durasiMenit: 20,
      status: 'selesai', mulaiPada: hariLalu(21), selesaiPada: hariLalu(21), muridJoined: peserta(false).slice(0, 9), dibuatPada: hariLalu(21) }),
  ]
}

export const kelasTersediaUji: KelasSuperSesiTersedia[] = [
  { sesiId: 'kt1', mapel: 'Teknologi Layanan Jaringan', kelas: 'XI-1', jurusan: 'TKJ', judul: 'PAS Ganjil: TLJ',
    superSesiJudul: 'PAS Ganjil 2026/2027', durasiMenit: 90, dibuatPada: menitLalu(20) },
]

/** Nilai kelas contoh untuk layar Jawaban & nilai (sesi selesai). */
export function hasilUji(p: PesertaSesi[]): JawabanSoalMurid[] {
  const pola = [[0, 1, 0], [1, 1, 0], [0, 2, 1], [1, 1, 1], [0, 2, 0], [1, 1, 0], [2, 0, 0], [0, 0, 1]]
  return p.map((m, i) => {
    if (i === 9) return { muridId: m.muridId, nama: m.nama, jawaban: {}, nilai: null, nilaiId: null, diubahGuru: false }
    const jawab = pola[i % pola.length]
    const jawaban: Record<string, number> = {}
    HASIL_SOAL.forEach((s, j) => { jawaban[s.id] = jawab[j] === 0 ? s.jawabanBenar : (s.jawabanBenar + jawab[j]) % s.pilihan.length })
    const benar = HASIL_SOAL.filter(s => jawaban[s.id] === s.jawabanBenar).length
    const nilai = i === 4 ? 75 : Math.round((benar / HASIL_SOAL.length) * 100)
    return { muridId: m.muridId, nama: m.nama, jawaban, nilai, nilaiId: `n${i}`, diubahGuru: i === 4 }
  })
}

// ─── Super Sesi (kepala sekolah) ─────────────────────────────────────────────

export function superSesiUji(): SuperSesi[] {
  return [
    { id: 'ss1', judul: 'PAS Ganjil 2026/2027', deskripsi: 'Penilaian Akhir Semester Ganjil, kelas X sampai XII',
      status: 'berjalan', mulaiPada: menitLalu(7), dibuatPada: hariLalu(5), kunciLayar: true },
    { id: 'ss2', judul: 'Ujian Praktik Kejuruan', deskripsi: 'Praktik kejuruan kelas XI dan XII',
      status: 'mengumpulkan', mulaiPada: null, dibuatPada: hariLalu(8), kunciLayar: false },
    { id: 'ss3', judul: 'PTS Ganjil 2026/2027', deskripsi: '', status: 'selesai', mulaiPada: hariLalu(21), dibuatPada: hariLalu(21), kunciLayar: false },
  ]
}

function muridSuper(n: number, terkunci: number): MuridSuperSesi[] {
  return peserta(false).slice(0, n).map((p, i) => ({
    muridId: p.muridId, nama: p.nama, terakhirDenyut: p.terakhirDenyut,
    terkunciPada: i < terkunci ? menitLalu(1.2) : null,
    keluarLayar: p.keluarLayar, hilangFokus: p.hilangFokus,
  }))
}

function kiriman(
  id: string, mapel: string, kelas: string, guru: string, pengawas: string | null, kode: string | null,
  jumlah: number, terkunci: number, berjalan: boolean, jurusan = '',
): SubmisiSuperSesi {
  return {
    id, mapel, kelas, jurusan, judul: mapel, guruMapelNama: guru,
    pengawasId: pengawas ? `p-${id}` : null, pengawasNama: pengawas,
    sesiId: kode ? `se-${id}` : null, kodeJoin: kode,
    sesiStatus: kode ? 'aktif' : null, mulaiPadaSesi: berjalan ? menitLalu(7) : null,
    kunciLayar: terkunci > 0, jumlahMurid: jumlah, murid: berjalan ? muridSuper(8, terkunci) : [],
  }
}

export function submisiUji(superSesiId: string): SubmisiSuperSesi[] {
  if (superSesiId === 'ss2') {
    return [
      kiriman('b1', 'Administrasi Infrastruktur Jaringan', 'XII TKJ 1', 'Pak Hadi', null, null, 0, 0, false),
      kiriman('b2', 'Administrasi Sistem Jaringan', 'XI TKJ 1', 'Bu Ratna', null, null, 0, 0, false),
      kiriman('b3', 'Teknologi Layanan Jaringan', 'XI TKJ 2', 'Pak Hadi', null, null, 0, 0, false),
    ]
  }
  return [
    kiriman('a1', 'Administrasi Sistem Jaringan', 'XI-1', 'Bu Ratna', 'Pak Dimas', 'PAS-101', 31, 1, true, 'TKJ'),
    kiriman('a2', 'Administrasi Sistem Jaringan', 'XI-2', 'Bu Ratna', 'Bu Sari', 'PAS-102', 30, 1, true, 'TKJ'),
    kiriman('a3', 'Teknologi Layanan Jaringan', 'XI TKJ 1', 'Pak Hadi', null, 'PAS-103', 0, 0, false),
    kiriman('a4', 'Matematika', 'X TKJ 1', 'Bu Wulan', 'Pak Rudi', 'PAS-104', 33, 0, true),
    kiriman('a5', 'Matematika', 'X TKJ 2', 'Bu Wulan', 'Bu Ani', 'PAS-105', 32, 2, true),
    kiriman('a6', 'Administrasi Infrastruktur Jaringan', 'XII TKJ 1', 'Pak Hadi', 'Bu Lina', 'PAS-106', 29, 0, true),
  ]
}
