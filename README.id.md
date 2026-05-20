# TRPG Dadu Online

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Pelempar dadu online untuk sesi TRPG di meja. Lempar dadu, simpan pola
yang bisa dipakai ulang, dan bagikan hasil, riwayat, serta obrolan
secara real-time dengan tim — semua dari halaman statis tanpa backend.

**🎲 Demo:** https://yamadar.github.io/trpg-dice-online/

## Fitur

- **Dadu (A)** — pilih jumlah dan jenis pada setiap lemparan
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` melempar dua d10 sebagai
  digit; `00` dibaca 100.
- **Modifier (B)** — tambah/kurang bilangan bulat terhadap hasil.
- **Jenis (C)** — `damage` atau `tes`.
- **Karakter** — kelola banyak karakter (nama, latar publik, memo
  pribadi, potret opsional, daftar pola, dan preferensi per karakter
  "sertakan memo saat ekspor"), beralih dan ekspor/impor sebagai JSON.
- **Pola** — gabungkan A + B + C dengan nama dan simpan per karakter;
  lempar dengan satu ketuk dari daftar.
- **Feed riwayat & obrolan** — lemparan dan obrolan dalam satu feed
  kronologis dengan filter Semua / Lemparan / Obrolan / File.
- **Riwayat ruang sebelumnya** — setiap sesi disimpan; jelajahi feed
  read-only dari lobby dan hapus per sesi atau seluruhnya. Mengetuk
  nama menampilkan snapshot karakter dan potret terakhir yang diketahui.
- **Ruang online** — layar Buat / Gabung terpisah dengan kode ruang
  (minimal 4 karakter; yang otomatis 6). Riwayat, obrolan, dan daftar
  pemain dibagikan P2P; setelah refresh GM hosting ulang dan pemain
  bergabung kembali otomatis.
- **Kontrol GM** — pengubahan nama ruang dan kode dirapikan di bagian
  GM yang dapat dilipat; tombol keluar berbunyi "Tutup ruang".
- **Lemparan tersembunyi GM** — GM bisa menyembunyikan nilai; yang lain
  hanya melihat bahwa terjadi lemparan tersembunyi.
- **Warna pemain & indikator mengetik** — setiap peserta dapat warna
  tetap, dan indikator halus menunjukkan siapa yang sedang mengetik.
- **Peristiwa ruang** — masuk/keluar muncul di feed; menutup ruang
  sebagai GM memberi tahu semua dengan rapi.
- **Multilingual & terjemahan otomatis** — UI mendukung 19 bahasa.
  Terjemahan otomatis opsional menampilkan obrolan dari pemain lain dalam
  bahasa antarmuka Anda; mengutamakan API Chrome Translator di perangkat
  dan beralih ke API REST tanpa kunci dari
  [MyMemory](https://mymemory.translated.net/) jika tidak tersedia. Ketuk
  «Asli» pada pesan terjemahan untuk melihat teks asli yang dikirim.

## Cara berbagi online

Aplikasi memakai **koneksi WebRTC P2P melalui [PeerJS](https://peerjs.com/)**.
Pembuat ruang (GM) menjadi host; pemain lain terhubung langsung ke GM,
yang meneruskan keadaan bersama. Tidak ada data yang melewati server
milik proyek ini. Karena P2P, ruang hanya hidup selama halaman GM tetap
terbuka.

## Tech stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (unit test)
- GitHub Pages + GitHub Actions (hosting)

## Pengembangan

```bash
npm install      # pasang dependensi
npm run dev      # jalankan dev server
npm test         # jalankan test
npm run lint     # lint
npm run build    # production build ke dist/
```

## Konfigurasi (relay TURN)

WebRTC memerlukan relay TURN untuk menyambungkan pemain yang jaringannya
memblokir UDP atau menggunakan NAT simetris (umum di Wi-Fi publik). Secara
default aplikasi memakai server TURN publik gratis dari Open Relay Project
— cukup untuk pemakaian sesekali tapi «best effort». Untuk relay yang
andal, salin `.env.example` ke `.env` lalu atur:

- `VITE_TURN_URLS` — URL TURN dipisah koma. Sertakan entri `turns:`
  melalui TCP/443 supaya tetap bekerja saat UDP diblokir.
- `VITE_TURN_USERNAME` — nama pengguna TURN.
- `VITE_TURN_CREDENTIAL` — kredensial TURN (kata sandi).

**Catatan keamanan:** Vite menempelkan setiap variabel `VITE_*` ke dalam
bundle produksi, sehingga kredensial TURN yang diatur di sini terlihat
oleh siapa pun yang membuka halaman. Untuk mengurangi risiko
penyalahgunaan, gunakan kredensial TURN yang berumur pendek / sementara
(misalnya pola kredensial bertenggang waktu lewat TURN REST API) dan
batasan dari sisi penyedia — origin yang diizinkan, filter IP, atau
kuota bulanan. Jangan memakai kembali kredensial produksi berjangka
panjang di sini.

Untuk memakainya pada deploy GitHub Pages, tambahkan sebagai secret
repositori dan teruskan pada langkah build di
`.github/workflows/deploy.yml`. Opsi gratis: tingkat gratis
[Metered](https://www.metered.ca/) atau hosting sendiri
[coturn](https://github.com/coturn/coturn).

## Deployment

Push ke `main` memicu workflow GitHub Actions
(`.github/workflows/deploy.yml`): lint, test, build, dan publikasi ke
GitHub Pages. Base path produksi `/trpg-dice-online/`; gunakan variabel
`BASE_PATH` saat hosting di tempat lain.

## Dokumentasi

- Persyaratan dan rencana: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Riset API terjemahan: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Lisensi

[MIT](LICENSE) © 2026 yamadar
