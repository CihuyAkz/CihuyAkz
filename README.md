# CihuyAkz Studio Lite

Project publishing script dengan Page Builder: satu Page dapat berisi banyak Script Name + source Lua.

## Linkvertise Anti-Bypass

Project ini memakai alur resmi Linkvertise Anti-Bypass:

1. Aktifkan **Anti-Bypassing** di dashboard Publisher Linkvertise dan salin **Anti-Bypassing Token**. Dokumentasi Linkvertise menyatakan fitur ini hanya bekerja untuk **Target-Links**, bukan Paste-Links.
2. Buat Target-Link Linkvertise yang target-nya adalah URL page script kamu.
3. Setelah user menyelesaikan ad-step, Linkvertise mengembalikan `?hash=...` ke target URL. Hash tersebut hanya tersedia sekitar 10 detik dan hanya dapat diverifikasi sekali.
4. Deploy `linkvertise-worker.js` sebagai Cloudflare Worker.
5. Simpan token sebagai Worker secret bernama `LINKVERTISE_TOKEN`. Jangan pernah memasukkan token ke `app.js`, `index.html`, atau GitHub Pages.
6. Di Admin Panel > Page Builder > Linkvertise Protection, isi:
   - **Linkvertise URL**: URL Target-Link Linkvertise milikmu.
   - **Verification Endpoint**: URL Worker yang sudah dideploy, misalnya `https://nama-worker.workers.dev`.

### Cloudflare Worker

Dengan Wrangler:

```bash
npx wrangler login
npx wrangler secret put LINKVERTISE_TOKEN
npx wrangler deploy
```

Saat diminta secret, paste token Anti-Bypassing dari Linkvertise. File `wrangler.toml` sudah disediakan.

Worker menerima `POST` JSON `{ "hash": "..." }`, kemudian melakukan `POST` ke endpoint resmi:

`https://publisher.linkvertise.com/api/v1/anti_bypassing?token=...&hash=...`

Linkvertise mengembalikan `TRUE` jika hash valid dan langsung menghapus hash tersebut; `FALSE` berarti hash tidak ditemukan/tidak valid. Karena hash one-time, refresh atau pemakaian ulang hash yang sama memang tidak akan lolos.

## Catatan penting

- Anti-Bypass Linkvertise membutuhkan backend; jangan menaruh token di frontend.
- Gunakan Target-Link, bukan Paste-Link.
- Untuk pengujian, gunakan hash baru dari alur Linkvertise. Hash yang sudah diverifikasi tidak dapat dipakai lagi.
- Admin/Owner di project ini dapat melewati gate berdasarkan session GitHub Owner yang sudah ada.
