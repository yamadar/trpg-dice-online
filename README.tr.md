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
- **Çok dilli ve otomatik çeviri** — UI 19 dili destekler. İsteğe bağlı
  otomatik çeviri, diğer oyuncuların sohbetini arayüz dilinizde gösterir;
  öncelikli olarak cihaz üzerindeki Chrome Translator API'yi kullanır,
  kullanılamadığında anahtarsız [MyMemory](https://mymemory.translated.net/)
  REST API'sine geri döner. Çevrilmiş bir mesajda «Özgün»e dokunarak
  gönderilen metni olduğu gibi görebilirsiniz.

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

## Yapılandırma (TURN aktarıcısı)

WebRTC, ağı UDP'yi engelleyen ya da simetrik NAT kullanan oyuncuları
(genellikle halka açık Wi-Fi'lerde) bağlamak için TURN aktarıcısına
ihtiyaç duyar. Varsayılan olarak uygulama Open Relay Project'in ücretsiz
herkese açık TURN sunucularına geri döner — gündelik kullanım için yeterli
ama «best effort». Güvenilir bir aktarıcı için `.env.example` dosyasını
`.env` olarak kopyalayın ve şu değerleri tanımlayın:

- `VITE_TURN_URLS` — virgülle ayrılmış TURN URL'leri. UDP'nin engellendiği
  ağlarda da çalışsın diye TCP/443 üzerinden bir `turns:` girdisi ekleyin.
- `VITE_TURN_USERNAME` — TURN kullanıcı adı.
- `VITE_TURN_CREDENTIAL` — TURN kimlik bilgisi (şifre).

GitHub Pages dağıtımında kullanmak için bunları depo gizli anahtarları
olarak ekleyin ve `.github/workflows/deploy.yml` derleme adımına aktarın.
Ücretsiz seçenekler: [Metered](https://www.metered.ca/) ücretsiz katmanı
veya [coturn](https://github.com/coturn/coturn)'ı kendiniz barındırmak.

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
