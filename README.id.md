<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Ruang dadu seukuran saku untuk malam TRPG kalian.</strong></p>

<p align="center">
  Buka halaman, bagikan kode ruang yang singkat, dan satu grup bisa melempar dadu bersama —<br/>
  tanpa akun, tanpa instalasi, tanpa server game. Cukup tautan dan dadu.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Buka demo langsung →</strong></a>
</p>

<p align="center">
  <em><strong>Bahasa:</strong></em>
  <a href="README.md">English</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.hi.md">हिन्दी</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.uk.md">Українська</a>
</p>

<p align="center">
  <img src="public/images/lobby-mobile.png" width="280" alt="Lobi kosong di sebuah ponsel dengan logo Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Umpan langsung berisi lemparan dadu dan obrolan" />
</p>

## Kenapa pilih ini untuk sesi berikutnya

- **Bagikan kode, langsung lempar.** GM membuat ruang dan membacakan kode 4–6 karakter; yang lain tinggal mengetiknya. Tidak perlu akun, tidak ada konfirmasi email, tidak perlu daftar apa pun.
- **Lemparan tetap di antara kalian.** P2P murni di atas WebRTC — lemparan dan obrolan berjalan langsung antar perangkat, tidak lewat server kami.
- **Pas di ponsel di atas meja.** Tata letak mobile-first, bisa dipasang sebagai PWA di iOS dan Android, terbuka layar penuh.
- **Berbicara 19 bahasa, dan menerjemahkan obrolan untuk kalian.** Klerikus berbahasa Jerman bisa bercanda dengan rogue berbahasa Jepang tanpa merusak imersi.
- **Dirancang untuk dibuka lagi.** Karakter, pola, tema, ukuran huruf, dan sesi lampau semuanya tersimpan secara lokal — terasa seperti *kotak dadu kalian sendiri*, bukan kios bersama.

## Mulai sesi dalam 30 detik

1. **GM:** buka demo, ketuk **Ruang → Buat**, bacakan kode dengan keras.
2. **Pemain:** buka demo, ketuk **Ruang → Gabung**, masukkan kode.
3. **Semua:** lempar, ngobrol, rayakan 20 alami pertama bersama-sama.

GM adalah host: selama tabnya terbuka, ruang tetap hidup. Tutup tab artinya sesi selesai — ruang-ruang lama tetap tersimpan secara lokal supaya logsnya bisa dibaca lagi nanti.

## Isi kotak dadu

### Dadu yang langsung mudah dibaca

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, dengan jumlah, modifier bertanda, dan jenis **damage / pemeriksaan** yang menyusun hasil seperti yang akan diucapkan di meja — *"Hasil pemeriksaan Persepsi: 18"*, *"Pedang besar: damage 11"*. Setiap mata yang keluar muncul sebagai siluet kecil yang sesuai bentuk dadunya, jadi langsung terbaca.

### Pola — jurus andalan kalian dalam satu sentuhan

Simpan `2D6 + 3 — damage` dengan nama seperti *"Pedang besar"* dan ulangi lemparannya di putaran berikut hanya dengan satu sentuhan. Pola milik karakter — dua PC di perangkat yang sama menyimpan repertoar masing-masing.

### Karakter dengan potret, catatan, dan pola tersendiri

Banyak PC per pemain. Tiap karakter punya nama, latar yang dibagi ke ruang, catatan pribadi yang hanya kalian lihat, potret opsional, daftar pola sendiri, dan preferensi per-karakter *"sertakan catatan saat ekspor"*. Ekspor ke JSON untuk cadangan; impor di perangkat lain untuk membawa PC ke sesi berikutnya. Saat berperan sebagai karakter, namanya tampil sebagai `Karakter (Pemain)`.

### Satu umpan untuk lemparan *dan* obrolan

Lemparan dan obrolan berbagi satu garis waktu kronologis dengan filter **Semua / Lemparan / Obrolan / File**. Pelengkapan otomatis `@` menyebut pemain yang tepat; `@all` mencapai semua orang. Lampirkan gambar ke obrolan dan ukurannya akan otomatis diperkecil sebelum dikirim.

### Ruang lama yang bisa dibaca ulang

Setiap sesi lampau disimpan secara lokal sebagai log tahan lama. Buka ruang lama dari lobi dalam mode baca-saja; sentuh nama pemain di log lama untuk melihat snapshot karakter dan potret terakhir yang diketahui. Ekspor satu ruang penuh (obrolan, lemparan, gambar) sebagai satu file ZIP.

### Alat untuk GM

GM bisa melempar **diam-diam** — yang lain hanya melihat *"sebuah lemparan tersembunyi telah dilakukan"*, bukan angkanya. Bagian GM juga menyatukan penggantian nama ruang dan pembuatan ulang kode di balik sebuah disclosure, dan tombol keluar GM bertuliskan **Tutup ruang** sehingga jelas bahwa itu mengakhiri sesi untuk semua.

### UI 19 bahasa &amp; obrolan diterjemahkan otomatis

UI tersedia dalam 19 bahasa. Terjemahan otomatis obrolan opsional memakai Chrome Translator API di perangkat saat tersedia dan jatuh ke REST API tanpa kunci dari [MyMemory](https://mymemory.translated.net/). Ketuk **Asli** pada pesan yang sudah diterjemahkan untuk melihat pesan apa adanya.

### Sentuhan kecil yang enak dipakai

Warna stabil per pemain, indikator mengetik yang halus, peristiwa masuk / keluar di umpan, tema yang bisa diganti, ukuran huruf yang bisa diatur, dan penanganan yang ramah saat GM menutup ruang.

## Pasang di ponsel (PWA)

Situs ini adalah Progressive Web App, jadi bisa ditambahkan ke layar utama iOS dan Android dan dijalankan layar penuh — tanpa UI peramban, dengan peluncuran berulang yang nyaris instan.

- **Android (Chrome):** buka demo, ketuk menu peramban, pilih **Pasang aplikasi** (atau *Tambah ke Layar Utama*).
- **iOS (Safari):** buka demo, ketuk bagikan, pilih **Tambah ke Layar Utama**.

Service worker melakukan pre-cache shell aplikasi supaya membuka kembali nyaris instan, tetapi ruang sendiri tetap P2P lewat WebRTC dan butuh koneksi jaringan aktif.

**Orientasi layar:** manifest tidak mengunci atau menimpa orientasi, jadi PWA yang terpasang mengikuti pengaturan auto-rotate / kunci rotasi perangkat (mis. di Android, dengan auto-rotate dimatikan, aplikasi tetap pada orientasi sekarang meskipun perangkat dimiringkan).

## Bagaimana berbagi online bekerja

Ruang memakai **WebRTC peer-to-peer** melalui [PeerJS](https://peerjs.com/). Pembuat ruang (GM) menjadi host; pemain lain terhubung langsung ke GM, dan GM meneruskan keadaan bersama. Tidak ada data permainan yang melewati server yang dioperasikan proyek ini. Karena P2P, ruang hanya terbuka selama GM membiarkan tabnya tetap aktif.

## Tumpukan teknologi

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) untuk ruang P2P di WebRTC
- [Vitest](https://vitest.dev/) untuk uji unit
- GitHub Pages + GitHub Actions sebagai hosting

## Pengembangan

```bash
npm install      # pasang dependensi
npm run dev      # jalankan dev server
npm test         # jalankan uji unit
npm run lint     # lint sumber
npm run build    # build produksi ke dist/
```

## Konfigurasi (TURN relay, opsional)

WebRTC butuh TURN relay untuk menghubungkan pemain yang jaringannya memblokir UDP atau memakai NAT simetris (umum di Wi-Fi kafe / publik). Secara default aplikasi jatuh ke server TURN publik gratis Open Relay Project — cocok untuk pemakaian santai, tetapi best-effort.

Untuk relay yang andal, salin `.env.example` ke `.env` dan isi:

- `VITE_TURN_URLS` — URL TURN yang dipisahkan koma. Sertakan entri `turns:` di TCP/443 supaya berfungsi di tempat UDP diblokir.
- `VITE_TURN_USERNAME` — pengguna TURN.
- `VITE_TURN_CREDENTIAL` — kredensial / kata sandi TURN.

> **Catatan keamanan:** Vite menyematkan setiap variabel `VITE_*` ke bundle produksi, sehingga kredensial TURN yang dipasang di sini terlihat oleh siapa pun yang membuka halaman. Gunakan kredensial TURN berumur pendek / sementara (mis. pola time-limited credential dari TURN REST API) dan terapkan pembatas di sisi penyedia — origin yang diizinkan, filter IP, kuota bulanan. Jangan pakai ulang kredensial produksi berumur panjang di sini.

Untuk memakainya di deploy GitHub Pages, tambahkan sebagai secret repositori dan teruskan pada langkah build di `.github/workflows/deploy.yml`. Opsi gratis: paket gratis [Metered](https://www.metered.ca/) atau self-host [coturn](https://github.com/coturn/coturn).

## Deploy

Push ke `main` memicu workflow GitHub Actions (`.github/workflows/deploy.yml`) yang menjalankan lint, uji, build, dan menerbitkan ke GitHub Pages. Base path produksi adalah `/trpg-dice-online/`; timpa dengan variabel lingkungan `BASE_PATH` jika di-host di tempat lain.

## Dokumentasi

- Kebutuhan dan rencana implementasi: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Catatan perubahan: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Riset API penerjemah real-time: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Lisensi

[MIT](LICENSE) © 2026 yamadar
