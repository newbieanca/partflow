# Cadangan Data PARTFLOW

Paket gratis Firebase tidak punya cadangan terjadwal. PARTFLOW menyediakan dua cara:

1. **Manual** (menu Admin, **Cadangan Data**): unduh JSON (lengkap, bisa dipulihkan) atau Excel (hanya dibaca).
2. **Otomatis mingguan** lewat GitHub Actions: setiap Senin 00:00 WIB seluruh database diekspor, dienkripsi AES-256, dan disimpan sebagai *artifact* selama 90 hari. Banner pengingat di aplikasi hilang otomatis setelah cadangan berhasil.

## Memasang cadangan otomatis (satu kali, sekitar 10 menit, semua lewat browser)

1. **Kunci service account.** Firebase console > roda gigi > **Project settings** > tab **Service accounts** > **Generate new private key**. Sebuah file `.json` terunduh. File ini setara kunci admin: **jangan dibagikan, jangan diunggah ke repo**.
2. **Secret GitHub.** Repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT`: tempel **seluruh isi** file `.json` tadi.
   - `BACKUP_PASSPHRASE`: kata sandi panjang buatan Anda (simpan di tempat aman. Tanpa ini cadangan tidak bisa dibuka).
3. **Pastikan repo Private** (Settings > General > bagian bawah). Cadangan terenkripsi, tetapi tetap sebaiknya tidak publik.
4. **Unggah berkas baru** ke repo: folder `scripts/` dan `.github/workflows/backup.yml`. Jika folder `.github` sulit diunggah, buat dengan **Add file > Create new file**, ketik nama `.github/workflows/backup.yml`, lalu tempel isinya.
5. **Uji sekarang.** Tab **Actions** > **Backup Firestore** > **Run workflow**. Setelah hijau (beberapa menit), kartu "Cadangan otomatis terakhir" di menu Cadangan Data terisi.

Catatan:
- Setiap cadangan membaca seluruh dokumen. Mingguan aman untuk batas gratis (50.000 baca/hari); jangan dijadikan harian kecuali data masih kecil.
- GitHub mematikan jadwal otomatis pada repo publik yang tidak ada aktivitas 60 hari. Untuk repo private jadwal tetap jalan; cek tab Actions sesekali.
- Kunci service account bocor? Hapus di Firebase console (Service accounts > Manage), buat baru, dan ganti secret.

## Mengambil dan membuka cadangan

1. Tab **Actions** > pilih run terbaru > bagian **Artifacts** > unduh `partflow-backup` (zip berisi satu file `.tar.gz.enc`).
2. Buka di komputer yang punya OpenSSL (Linux, macOS, atau Git Bash di Windows):
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in partflow-backup-2026-11-30.tar.gz.enc -out backup.tar.gz
   tar xzf backup.tar.gz
   ```
   Hasilnya: `backup.json` (lengkap), `data.xlsx` (dibaca), `manifest.json` (jumlah dokumen).

## Memulihkan data

Pemulihan menulis ulang dokumen dengan id yang sama dari `backup.json`. Tidak ada yang dihapus. Skrip ada di `scripts/restore.mjs` dan butuh Node.js 20+ serta kunci service account:

```
cd scripts && npm install
set FIREBASE_SERVICE_ACCOUNT=<isi file kunci>      (Linux/macOS: export FIREBASE_SERVICE_ACCOUNT='...')
node restore.mjs ../backup.json                     # SIMULASI: hanya menampilkan jumlah
node restore.mjs ../backup.json --collections parts,models --yes   # menulis koleksi tertentu
```

Selalu jalankan simulasi dulu, dan pulihkan hanya koleksi yang perlu. Akun login (email dan password) tidak ikut karena disimpan Firebase Authentication; daftar pengguna dan role ikut tersimpan di koleksi `users`.

## Yang belum teruji
Logika ekspor, enkripsi format, dan pemulihan sudah diuji dengan database tiruan, tetapi belum pernah dijalankan terhadap proyek Firebase Anda. Jalankan langkah 5 dan satu kali **simulasi** pemulihan sebelum bergantung padanya.
