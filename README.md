# CihuyAkz Studio Lite

Panel admin untuk mengelola Page, banyak script Lua dalam satu Page, pustaka potongan Lua, dan bot Discord.

## Perubahan versi ini
- Tombol **Terbitkan Page** diperbaiki. Fungsi pengumpulan isi editor yang hilang sudah ditambahkan.
- Semua akses GitHub sebelum publish dicek ulang dengan SHA database terbaru agar konflik data browser tidak mudah membuat publish gagal.
- Pesan error penting menggunakan Bahasa Indonesia.
- UI Admin Panel didesain ulang menjadi dashboard + navigasi samping.
- Satu Page dapat berisi banyak **Nama Script**.
- Nama script dibuat memiliki ID/file unik sehingga script dengan nama mirip tidak saling menimpa.
- **Pustaka Lua** untuk menyimpan potongan kode yang sering dipakai.
- Tombol **Sisipkan Lua** tersedia di setiap editor script untuk memasukkan potongan langsung ke posisi kursor.
- Linkvertise tidak digunakan.
- Notifikasi Toast dapat ditutup dengan sentuhan/klik.

## Publish
Login menggunakan token GitHub yang memiliki izin **Contents: Read and write** pada repository target. Repository dan branch diatur di `app.js` pada objek `CONFIG`.
