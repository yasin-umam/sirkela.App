import { MuridSesiPage } from './MuridSesiPage'

// ─── Rumah murid ─────────────────────────────────────────────────────────────
// Sekaligus pintu depan aplikasi untuk siapa pun yang belum masuk. Murid tidak
// punya akun (identitasnya akun anonim, lihat masukTamu di AuthContext), jadi
// tidak ada tab Saya: nama diketik di tiap sesi dan tidak ada akun untuk
// dikeluari. Luang punya tab Riwayat juga; di sini tidak ikut disalin.
export function MuridHome() {
  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-slate-50">
      <MuridSesiPage />
    </div>
  )
}
