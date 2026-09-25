# CihuyAkz Studio Lite

Website untuk menyimpan dan mengelola script Roblox Studio Lite / Roblox Studio.

- Tema: merah gradient
- Script bawaan: hanya `Example Script`
- Script baru dapat ditambahkan dari menu `Manage` → `Add New`
- Ikon web: ikon YouTube CihuyAkz


### Perubahan versi Lite
- Library script publik menggunakan `database.json` lokal terlebih dahulu agar script lama dari database remote tidak muncul lagi.
- Script bawaan hanya `Example Script`.
- Tema antarmuka merah gradient.
- Favicon menggunakan ikon YouTube.
- `Manage` → `Add New` tetap tersedia; setelah login GitHub, perubahan script juga dikirim ke repository yang dikonfigurasi.

- Login dibatasi untuk akun GitHub `CihuyAkz`; token GitHub tetap diperlukan untuk operasi Manage/Publish.


### Community features

- Tombol `Login` diganti nama menjadi `Manage`; akses tetap dibatasi ke akun GitHub `CihuyAkz`.
- `Suggestion` sekarang membuka `Suggestion Board` langsung di website. Saran ditulis sebagai komentar di GitHub Discussions, bukan GitHub Issues.
- Setiap halaman script memiliki `Report` yang tetap membuka issue bug terprefill.
- Komentar, reply, dan reactions untuk setiap script menggunakan giscus/GitHub Discussions.

### Aktivasi komentar / Like / Dislike / Suggestion Board

1. Pastikan GitHub Discussions aktif pada repository `CihuyAkz/CihuyAkz`. Giscus membutuhkan repository publik, Discussions aktif, dan aplikasi giscus terpasang agar pengunjung dapat melihat serta memposting komentar/reactions.
2. Buka giscus.app, pilih repository `CihuyAkz/CihuyAkz`, lalu pilih kategori yang dipakai untuk komentar script (misalnya `General`) dan kategori `Ideas` untuk Suggestion Board.
3. Salin `Repository ID` dan `Category ID` ke `community-config.js`. Untuk Suggestion Board isi `suggestionCategoryId` sesuai kategori `Ideas`.
4. Deploy ulang. Setelah terhubung, halaman script menampilkan komentar/reply dan reactions GitHub, sedangkan tombol `Suggestion` membuka board saran langsung di website.

`Report` tetap memakai GitHub Issues karena fungsinya khusus untuk laporan bug/masalah teknis.
