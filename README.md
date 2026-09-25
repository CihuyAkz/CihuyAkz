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
- Tombol utama `Login` diganti nama menjadi `Manage`; akses tetap dibatasi ke akun GitHub `CihuyAkz`.
- `Suggestion` membuka GitHub Issue terprefill agar saran dapat dikelola owner.
- Setiap halaman script memiliki `Report` yang membuka issue terprefill dengan label `bug`.
- Komentar, reply, Like, dan Dislike disiapkan melalui giscus/GitHub Discussions. Sebelum aktif, owner perlu mengaktifkan Discussions dan mengisi `repoId` serta `categoryId` dari giscus.app pada `app.js`.


### Aktivasi komentar / Like / Dislike
1. Aktifkan **Discussions** pada repository `CihuyAkz/CihuyAkz`.
2. Buka giscus.app, pilih repository tersebut, lalu pilih category `General`.
3. Salin `Repository ID` dan `Category ID` ke `community-config.js`.
4. Setelah itu halaman script akan memakai GitHub Discussions untuk komentar, reply, dan reactions (termasuk Like/Dislike).

`Suggestion` dan `Report` tidak membutuhkan token pengunjung; keduanya membuka form GitHub Issue yang sudah diisi otomatis.
