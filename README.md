# PARTFLOW – Part Supply Management System
React + TypeScript + Vite + Tailwind, Firebase (Auth + Firestore), Vercel.

## Status
Semua fase selesai dibangun: master data, BOM (impor Excel + versi), produksi (snapshot BOM), supply (Take All / Partial / over supply / koreksi),
dashboard, laporan, ekspor Excel, audit log, manajemen pengguna, PWA. Lihat `docs/UJI-MANUAL.md` untuk apa yang masih harus dibuktikan dengan akun nyata.

## Setup
1. Firebase console: buat proyek, aktifkan Email/Password dan Firestore, daftarkan web app.
2. Salin `.env.example` ke `.env` (atau isi variabel yang sama di Vercel).
3. Tempel `firestore.rules` di Firestore > Rules > Publish (ulangi setiap file ini berubah).
4. Buat akun pertama di Authentication > Users, login sekali, lalu ubah `users/{uid}.role` menjadi `ADMIN` di console. Akun lain dibuat dari menu Pengguna.
5. Vercel: import repo, isi 6 variabel `VITE_FIREBASE_*`. Tambahkan domain Vercel di Authentication > Settings > Authorized domains.
6. `npm install`, `npm test`, `npm run build` (opsional, Vercel menjalankannya otomatis).

## Keputusan arsitektur
- **Tanpa Cloud Functions** (butuh paket Blaze). Pencatatan part memakai `runTransaction` Firestore: kebutuhan dihitung ulang dari snapshot BOM + jumlah produksi di dalam transaksi, ID transaksi = kunci idempotensi, total berjalan hanya bisa berubah sebesar transaksi yang dibuat bersamaan (dijaga Security Rules).
- **Snapshot BOM per produksi** (satu dokumen). Perubahan BOM master tidak mengubah produksi yang sudah berjalan.
- **Tanpa composite index.** Semua query memakai satu field (filter + urutan pada field yang sama), jadi tidak ada `firestore.indexes.json`.
- **Transaksi tidak pernah dihapus.** Koreksi = dokumen `transactionAdjustments` (satu per transaksi) + audit log.
- **Hemat kuota gratis.** Laporan memuat saat diminta; dashboard hanya mendengarkan data yang perlu; pencatatan biasa tidak menulis audit log terpisah (transaksi itu sendiri tidak bisa diubah).
- **Nonaktifkan pengguna** ditegakkan di Security Rules (`active == false` menutup semua akses).

## Struktur
`src/lib` logika murni + tes, `src/pages` layar, `src/auth` login/peran, `public` PWA (manifest, ikon, `sw.js`), `docs` panduan dan daftar uji.

## Cabang Git yang disarankan
`main` = produksi (Vercel deploy otomatis), `development` = pengembangan, cabang fitur dari `development`. Jangan pernah commit `.env` atau kunci service account.

## Design system (SHARP Industrial Modern)
Token warna dan font ada di `src/index.css` (`@theme`): merah SHARP `#E60012` hanya untuk aksi utama dan penanda aktif, charcoal untuk teks dan navigasi, latar `#F4F5F7`.
Kelas komponen (`.btn`, `.input`, `.chip`, `.pill`, `.surface`, `.tbl`) di CSS yang sama; komponen React bersama di `src/ui.tsx`
(Pill/StatusPill, Progress, PageHeader, Section, Empty, Loading, ErrorNote, Highlight, Sheet, Toast, DialogProvider/useDialog).
Dialog konfirmasi dan alasan memakai `useDialog()`, bukan `confirm()`/`prompt()` bawaan browser. Shift aktif ada di `src/lib/shift.ts`. Tidak ada logo SHARP resmi di repo; header memakai wordmark teks.

## Logo dan aset merek
Berkas logo dari pemilik ada di `public/brand/` (WebP transparan): `partflow-logo` (lambang + tulisan + tagline), `partflow-wordmark`, `partflow-mark`, dan `sharp-logo`.
Logo PARTFLOW berwarna charcoal dan merah, jadi hanya dipakai di latar terang. Ikon PWA, favicon, dan apple-touch-icon dibuat dari lambang P itu (siluet putih di kotak merah SHARP).

## Akun supply bersama
Tim supply memakai satu akun (role OPERATOR, mis. supply@wm.prod). Siapa yang bekerja ditentukan di perangkat masing-masing: nama, kategori supply, dan shift diisi di Beranda (disimpan di browser perangkat, `src/lib/supplyProfile.ts`).
Nama itu dicatat sebagai operator di setiap transaksi. Jadwal produksi hanya dibuat dan diubah oleh LEADER/ADMIN; aturan Firestore membatasi OPERATOR hanya boleh menandai produksi ACTIVE menjadi COMPLETED.
