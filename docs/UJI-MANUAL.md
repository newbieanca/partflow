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

## Tampilan (redesain SHARP Industrial Modern)
Belum diuji di browser nyata. Lakukan di Chrome dengan DevTools (Ctrl+Shift+M) dan di HP Android sungguhan.
- [ ] Lebar 360, 390, 430 px: tidak ada konten terpotong atau menggulir menyamping; navigasi bawah tidak menutupi tombol terakhir di halaman panjang.
- [ ] Lebar tablet (768 px) dan 1366 / 1920 px: sidebar kiri tampil, konten rapi di tengah, tabel Riwayat terbaca.
- [ ] Supply: bar pencarian dan chip kategori tetap menempel di atas saat menggulir; tombol Ambil semua dan Sebagian mudah dijangkau satu tangan; panel Catat muncul dari bawah dan angka bisa diketik dengan keypad.
- [ ] Over supply: peringatan merah tampil di dalam panel, tombol Ubah jumlah dan Catat over supply terbaca jelas.
- [ ] Dashboard: empat angka utama tersusun 2x2 di HP dan 1 baris di desktop, tanpa garis ganda.
- [ ] Huruf Inter tampil (bukan huruf bawaan sistem); angka sejajar rapi di kolom Sisa.
- [ ] Layar login terbaca di HP dan desktop; masuk dengan Enter berfungsi.
- [ ] Kontras teks mudah dibaca di bawah sinar terang pabrik (uji di lantai produksi bila bisa).

## Logo dan ikon
- [ ] Layar login: logo PARTFLOW tampil tajam (desktop di panel kiri, HP di atas formulir); logo SHARP kecil muncul di bawah.
- [ ] Sidebar desktop menampilkan tulisan PARTFLOW; app bar HP menampilkan lambang P di sebelah judul halaman.
- [ ] Tab browser menampilkan ikon P merah (favicon).
- [ ] Hapus aplikasi PARTFLOW lama dari layar utama HP, buka ulang di Chrome, lalu pasang lagi: ikon baru (P putih di kotak merah) muncul dan tidak terpotong.

## Akun supply (supply@wm.prod, role OPERATOR)
- [ ] Buat akun lewat Profil > Pengguna > Tambah akun: nama "Supply WM", email supply@wm.prod, role OPERATOR. Login dari 2 HP sekaligus: keduanya berhasil.
- [ ] Beranda: tidak ada tombol Produksi; ada kotak Nama, Kategori supply, dan Shift. Nama dan pilihan tersimpan setelah halaman dimuat ulang, dan berbeda di tiap HP.
- [ ] Beranda: Jadwal produksi menampilkan produksi yang diinput Leader/Admin; tombol panah ganti hari; mengetuk kartu membuka Supply untuk model itu.
- [ ] Aktivitas terbaru: tombol Sembunyikan menyembunyikan daftar; pilihan tetap setelah dimuat ulang; hanya menampilkan kategori yang dipilih.
- [ ] Produksi: tidak ada Produksi baru, Ubah, atau Batalkan. Tombol Supply dan Selesai masih ada.
- [ ] Mencoba membuat produksi dari akun supply lewat cara lain (misalnya konsol browser): ditolak aturan Firestore setelah rules baru dipublikasikan.
- [ ] Supply: tidak ada dropdown Produksi, diganti kartu model; "Ganti model" kembali ke daftar kartu.
- [ ] Supply: hanya part kategori yang dipilih yang tampil, tanpa chip kategori lain. Mengubah kategori di Beranda langsung mengubah daftar part.
- [ ] Nama yang diisi muncul sebagai operator di Riwayat dan di aktivitas terbaru, bukan "Supply WM".
- [ ] Kosongkan nama lalu buka Supply: muncul ajakan melengkapi data di Beranda dan pencatatan ditolak.
