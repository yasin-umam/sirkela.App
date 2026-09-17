import { supabase } from './supabase'
import type { KontenItem, HasilSoal, PesertaSesi } from '../types'

/**
 * Kebalikan dari ratakanSoal() di sesiMurid.ts: guru memegang kontenList utuh
 * lengkap dengan jawabanBenar (baris sesi_kelas miliknya sendiri). Dedup-nya
 * SAMA persis dengan ratakanSoal supaya nomor & daftar soal yang dilihat guru
 * cocok dengan yang dihitung selesaikan_murid() di server.
 */
export function ratakanSoalGuru(konten: KontenItem[]): HasilSoal[] {
  const terlihat = new Set<string>()
  return konten
    .filter(k => k.tipe === 'soal' && Array.isArray(k.data))
    .flatMap(k => k.data)
    .filter(s => {
      if (!s?.id || terlihat.has(s.id)) return false
      terlihat.add(s.id)
      return true
    })
}

export interface JawabanSoalMurid {
  muridId: string
  nama: string
  /** soalId -> index pilihan. Soal yang belum dijawab tidak punya entri (bukan
   *  -1) -- "belum dijawab" harus kelihatan beda dari "menjawab salah". */
  jawaban: Record<string, number>
  /** null = belum pernah mengirim. */
  nilai: number | null
  /** id baris nilai_murid, dibutuhkan untuk veto. null selama nilai masih null. */
  nilaiId: string | null
  diubahGuru: boolean
}

/**
 * Gabungan `jawaban_sesi` + `nilai_murid` per murid untuk SATU sesi. `peserta`
 * diambil dari muridJoined yang sudah dimuat SesiContext -- satu sumber yang
 * sama dengan daftar "Murid Bergabung".
 */
export async function bacaHasilSoalSesi(sesiId: string, peserta: PesertaSesi[]): Promise<JawabanSoalMurid[]> {
  const [jawabanRes, nilaiRes] = await Promise.all([
    supabase.from('jawaban_sesi').select('murid_id, soal_id, jawaban').eq('sesi_id', sesiId),
    supabase.from('nilai_murid').select('id, murid_id, nilai, diubah_guru').eq('sesi_id', sesiId),
  ])
  // Dilempar, bukan ditelan jadi daftar kosong: "belum ada yang mengirim" dan
  // "gagal memuat" tidak boleh terlihat sama di layar yang dipakai menilai.
  if (jawabanRes.error) throw new Error(jawabanRes.error.message)
  if (nilaiRes.error) throw new Error(nilaiRes.error.message)

  const jawabanPer = new Map<string, Record<string, number>>()
  for (const r of (jawabanRes.data ?? []) as { murid_id: string; soal_id: string; jawaban: number | null }[]) {
    if (r.jawaban == null) continue
    if (!jawabanPer.has(r.murid_id)) jawabanPer.set(r.murid_id, {})
    jawabanPer.get(r.murid_id)![r.soal_id] = r.jawaban
  }

  const nilaiPer = new Map<string, { id: string; nilai: number; diubahGuru: boolean }>()
  for (const r of (nilaiRes.data ?? []) as { id: string; murid_id: string | null; nilai: number; diubah_guru: boolean }[]) {
    if (r.murid_id) nilaiPer.set(r.murid_id, { id: r.id, nilai: r.nilai, diubahGuru: r.diubah_guru })
  }

  return peserta.map(p => {
    const n = nilaiPer.get(p.muridId)
    return {
      muridId: p.muridId,
      nama: p.nama,
      jawaban: jawabanPer.get(p.muridId) ?? {},
      nilai: n?.nilai ?? null,
      nilaiId: n?.id ?? null,
      diubahGuru: n?.diubahGuru ?? false,
    }
  })
}

/**
 * Veto: guru menimpa nilai otomatis (kunci salah ketik, soal ambigu). UPDATE
 * langsung -- policy nilai_murid_guru_update membatasinya ke nilai sesi guru
 * sendiri. `diubah_guru` ikut ditulis supaya nilai hasil veto tidak diam-diam
 * terlihat sama dengan hitungan otomatis.
 */
export async function vetoNilaiSesi(nilaiId: string, nilaiBaru: number): Promise<void> {
  const { error } = await supabase
    .from('nilai_murid')
    .update({ nilai: nilaiBaru, diubah_guru: true })
    .eq('id', nilaiId)
  if (error) throw new Error(error.message)
}
