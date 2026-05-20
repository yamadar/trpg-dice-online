# TRPG Çevrimiçi Zar

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Masaüstü TRPG oturumları için çevrimiçi zar atıcı. Zar at, yeniden
kullanılabilir şablonlar kaydet ve sonuçları, geçmişi ve sohbeti ekibinle
gerçek zamanlı paylaş — hepsi backend'siz statik bir sayfadan.

**🎲 Canlı demo:** https://yamadar.github.io/trpg-dice-online/

## Özellikler

- **Zar (A)** — her atıştan önce sayı ve türü seç
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` iki d10'u basamak olarak
  atar; `00` 100 sayılır.
- **Değiştirici (B)** — sonuca `+/-` tam sayı ekler.
- **Tür (C)** — `hasar` veya `test`.
- **Karakterler** — birden çok karakteri tut (ad, herkese açık arka
  plan, özel not, isteğe bağlı portre, şablon listesi ve karakter başına
  "notu dışa aktarmaya dahil et" tercihi), aralarında geçiş yap ve JSON
  olarak içe/dışa aktar.
- **Şablonlar** — A + B + C'yi ada bağla, karakter başına kaydet ve
  listeden tek dokunuşla at.
- **Geçmiş ve sohbet akışı** — atışlar ve sohbet tek bir kronolojik
  akışta; Tümü / Atışlar / Sohbet / Dosyalar filtresi.
- **Önceki odaların geçmişi** — her oturum kaydedilir; lobiden salt
  okunur akışı gez, tek tek veya tümünü sil. Bir ada dokunmak karakterin
  o anki anlık görüntüsünü ve son bilinen portreyi gösterir.
- **Çevrimiçi odalar** — ayrı Oluştur / Katıl ekranları ve oda kodu
  (en az 4 karakter; otomatik üretilenler 6). Geçmiş, sohbet ve oyuncu
  listesi P2P paylaşılır; yenilemede GM yeniden barındırır, oyuncu
  otomatik yeniden katılır.
- **GM kontrolleri** — oda adı ve kod değişimi katlanabilir GM bölümünde,
  çıkış düğmesi "Odayı kapat".
- **GM gizli atış** — GM değeri gizleyebilir; diğerleri yalnızca gizli
  bir atış olduğunu görür.
- **Oyuncu renkleri ve yazıyor göstergesi** — her katılımcının kararlı
  bir rengi vardır; gizli bir gösterge kimin yazdığını belirtir.
- **Oda olayları** — giriş/çıkışlar akışta görünür, GM odayı kapattığında
  herkese düzgün bildirilir.
- **Çok dilli** — UI 19 dili destekler.

## Çevrimiçi paylaşım nasıl çalışır

Uygulama **[PeerJS](https://peerjs.com/) üzerinden WebRTC P2P bağlantıları**
kullanır. Odayı oluşturan (GM) host'tur; diğerleri doğrudan GM'e bağlanır,
GM paylaşılan durumu iletir. Bu projeye ait hiçbir sunucudan veri geçmez.
P2P olduğu için oda yalnızca GM sayfayı açık tuttuğu sürece açık kalır.

## Teknoloji yığını

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (birim testler)
- GitHub Pages + GitHub Actions (barındırma)

## Geliştirme

```bash
npm install      # bağımlılıkları yükle
npm run dev      # geliştirme sunucusu
npm test         # testleri çalıştır
npm run lint     # lint
npm run build    # dist/ için üretim build'i
```

## Dağıtım

`main` üzerine push, GitHub Actions iş akışını
(`.github/workflows/deploy.yml`) tetikler: lint, test, build ve GitHub
Pages'e yayımlama. Üretim base path'i `/trpg-dice-online/`; başka bir
yerde barındıracaksan `BASE_PATH` ortam değişkeniyle değiştir.

## Belgeler

- Gereksinimler ve plan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Çeviri API araştırması: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Lisans

[MIT](LICENSE) © 2026 yamadar
