# Daftar Uji Manual PARTFLOW

Uji otomatis (vitest) hanya mencakup logika murni. Hal di bawah ini hanya bisa dibuktikan dengan akun dan perangkat nyata.
Centang setelah benar-benar dicoba. Siapkan 3 akun: ADMIN, LEADER, OPERATOR.

## Keamanan dan peran
- [ ] OPERATOR tidak melihat menu Laporan, Master Data, Upload BOM, Pengguna, Audit.
- [ ] OPERATOR mengetik alamat /master di browser: dialihkan ke Beranda.
- [ ] OPERATOR membuat produksi: berhasil. Membuka kembali produksi yang selesai: tombol tidak ada.
- [ ] OPERATOR tidak punya tombol Koreksi di riwayat part. LEADER dan ADMIN punya.
- [ ] Nonaktifkan akun OPERATOR (menu Pengguna). Operator yang sedang login tidak bisa lagi menyimpan data, dan login berikutnya ditolak dengan pesan akun nonaktif.
- [ ] Ubah role lewat menu Pengguna: pengguna perlu keluar dan masuk lagi, lalu menu berubah.
- [ ] Akun OPERATOR tidak bisa mengubah role sendiri (di console jaringan atau lewat aplikasi lain): ditolak.

## Transaksi
- [ ] Take All pada part dengan kebutuhan 100, diambil 60: mencatat 40.
- [ ] Partial 60 + 25 + 15 dari tiga shift: sisa 0, status Selesai, rincian S1/S2/S3 benar.
- [ ] Jumlah melebihi sisa: muncul peringatan, tercatat OVER SUPPLY hanya setelah konfirmasi.
- [ ] Dua HP menekan Take All pada part yang sama bersamaan: total tidak melebihi kebutuhan.
- [ ] Matikan data seluler saat menekan Catat: muncul pesan koneksi, tidak ada transaksi tersimpan. Nyalakan lagi dan ulangi: tercatat satu kali.
- [ ] Produksi diselesaikan: tombol Ambil hilang. Dibuka kembali Leader: tombol muncul lagi.
- [ ] Kurangi jumlah produksi di bawah yang sudah diambil: muncul daftar over supply dan alasan wajib.
- [ ] Koreksi satu transaksi: sisa bertambah, transaksi tampil dicoret, ada di Audit Log. Koreksi kedua ditolak.

## BOM dan impor
- [ ] Upload Excel asli: jumlah model dan part sesuai. Upload ulang file yang sama: semua model "tidak berubah".
- [ ] Ubah QTY satu part di Excel lalu upload: hanya model itu mendapat versi baru, produksi lama tetap memakai BOM lama.

## HP dan PWA
- [ ] Chrome Android: Profil, tombol pasang atau menu ⋮ Instal aplikasi. Ikon muncul di layar utama.
- [ ] Aplikasi terpasang terbuka layar penuh, navigasi bawah tidak tertutup tombol sistem.
- [ ] Mode pesawat: aplikasi tetap terbuka (data terakhir tampil). Pengambilan part menolak dengan pesan jelas.
- [ ] Layar 360 px lebar: tidak ada konten terpotong menyamping, tombol mudah ditekan.

## Beban
- [ ] Buka halaman Supply untuk produksi dengan 200+ part: tetap lancar saat mencari dan menggulir.
- [ ] Lihat pemakaian di Firebase console, tab Usage: baca dan tulis harian jauh di bawah batas gratis (50.000 baca, 20.000 tulis).
