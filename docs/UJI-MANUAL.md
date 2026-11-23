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

## Loss pack (koreksi isi box)
Siapkan satu produksi dengan satu part: kebutuhan 100, catat pengambilan 100.
- [ ] Produksi: kartu model (akun supply) punya tombol **Edit**, juga untuk produksi yang sudah Selesai. Tombol Ubah dan Batalkan tidak ada.
- [ ] Edit: pilih pengambilan 100, isi qty aktual 97 dan catatan. Tombol Simpan mati sampai qty berubah dan catatan terisi (minimal 3 huruf).
- [ ] Setelah disimpan: Supply menunjukkan diambil 97, sisa 3; riwayat part menampilkan "97 (semula 100)" dan catatan loss pack beserta nama pengoreksi.
- [ ] Ambil Semua pada part itu sekarang mengusulkan 3.
- [ ] Mengedit transaksi yang sama kedua kali: ditolak ("sudah pernah dikoreksi").
- [ ] Riwayat: qty menampilkan 97 dengan keterangan "semula 100"; ekspor Excel punya kolom "Qty awal" dan "Catatan loss pack". Transaksi yang dikoreksi loss pack TIDAK tampil dicoret (hanya yang dibatalkan Leader yang dicoret).
- [ ] Laporan per model/shift menghitung 97, bukan 100.
- [ ] Leader membatalkan (Koreksi) transaksi yang sudah dikoreksi loss pack: total kembali tepat (tidak minus, tidak sisa 3).
- [ ] Audit Log (Admin) memuat TX_LOSS_PACK dengan nilai sebelum dan sesudah serta catatannya.
- [ ] Akun supply mencoba mengubah transaksi langsung lewat konsol browser: ditolak (transaksi asli tidak bisa diubah).

## Kategori Part (hanya part berkategori yang dicatat)
- [ ] Menu Kategori Part (Admin): unggah daftar kode part + kategori. Pratinjau menampilkan jumlah akan diubah, sudah sama, dan bermasalah; tombol terapkan mati bila ada baris bermasalah.
- [ ] Kategori yang tidak ada di Master Data, atau kode yang sama dengan kategori berbeda, tampil sebagai kkesalahan dengan nomor baris.
- [ ] Baris tanpa kategori diabaikan (bukan kesalahan) dan tidak menghapus kategori yang sudah ada.
- [ ] Setelah diterapkan, buat PRODUKSI BARU untuk model yang BOM-nya sudah diimpor: hanya part berkategori yang ada di Supply, Dashboard, dan Laporan. Part tanpa kategori tidak muncul di mana pun.
- [ ] Produksi yang dibuat SEBELUM kategori diisi tidak berubah (snapshot lama). Buat ulang produksi uji tersebut.
- [ ] Cari Part: part tanpa kategori bertuliskan "Tidak dicatat di aplikasi"; Admin bisa mengosongkan atau mengisi kategori satu per satu.
- [ ] Akun supply: tidak ada pilihan "Belum diatur"; kategori lama yang tersimpan di perangkat (jika sudah tidak ada) meminta memilih ulang.

## Cadangan data
- [ ] Menu Cadangan Data: jumlah dokumen per koleksi tampil; "Unduh cadangan (JSON)" mengunduh file; "Unduh Excel" mengunduh file yang bisa dibuka.
- [ ] Setelah mengunduh, status "Unduhan manual terakhir" terisi dan banner kuning pengingat menghilang.
- [ ] Banner pengingat muncul untuk Admin bila cadangan terakhir lebih dari 7 hari (atau belum pernah); tidak muncul untuk Leader dan Operator.
- [ ] Ikuti docs/CADANGAN.md: jalankan workflow Backup Firestore secara manual, unduh artifact, buka dengan OpenSSL, dan jalankan SIMULASI pemulihan (tanpa --yes).
- [ ] Setelah workflow berhasil, "Cadangan otomatis terakhir" di aplikasi terisi.
