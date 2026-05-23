<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>FRP gecesi için cebe sığan bir zar odası.</strong></p>

<p align="center">
  Sayfayı aç, kısa bir oda kodunu paylaş — grubun tamamı birlikte zar atabilir.<br/>
  Hesap yok, kurulum yok, oyun sunucusu yok. Sadece bağlantı ve zarlar.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Canlı demoyu aç →</strong></a>
</p>

<p align="center">
  <em><strong>Diller:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Dice & Chat markasıyla bir telefon üzerinde boş lobi" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Zar atışları ve sohbetin birlikte aktığı canlı akış" />
</p>

## Bir sonraki oturum için neden bunu seçmelisiniz

- **Kodu paylaş, zar atmaya başla.** OY (Oyun Yöneticisi) bir oda açar ve 4–6 karakterlik kodu yüksek sesle okur; diğerleri sadece yazar. Hesap yok, e-posta onayı yok, kaydolacak hiçbir şey yok.
- **Atışlarınız aranızda kalır.** WebRTC üzerinden saf P2P — atışlar ve sohbet doğrudan cihazdan cihaza gider, bizim hiçbir sunucumuzdan geçmez.
- **Masadaki telefonda kendini evinde hisseder.** Mobil öncelikli düzen, iOS ve Android'de PWA olarak kurulabilir, tam ekran açılır.
- **19 dil konuşur, sohbeti sizin için çevirir.** Alman rahibe, Japon hırsızla atışırken kimse atmosferden kopmaz.
- **Yeniden açılmak için tasarlandı.** Karakterler, kalıplar, temalar, yazı boyutu ve geçmiş oturumlar yerel olarak saklanır — uygulama paylaşımlı bir kiosk değil, *sizin* zar kutunuz gibi hissettirir.

## 30 saniyede bir oturum başlatın

1. **OY:** Demoyu açın, **Oda → Oluştur**'a dokunun, kodu yüksek sesle okuyun.
2. **Oyuncular:** Demoyu açın, **Oda → Katıl**'a dokunun, kodu yazın.
3. **Hepsi birden:** Zar atın, sohbet edin, ilk doğal 20'yi birlikte kutlayın.

OY ev sahibidir: sekmesi açık kaldığı sürece oda yaşar. Sekme kapanırsa oturum biter — geçmiş odalar yerel olarak saklı kaldığı için günlüğü daha sonra yeniden okuyabilirsiniz.

## Zar kutusunun içinde

### Tek bakışta okunan zarlar

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, sayı, işaretli modifikatör ve **hasar / kontrol** türüyle — masa nasıl söylerse öyle ifade edilir: *"Algı kontrolü sonucu: 18"*, *"Pala: 11 hasar"*. Her gelen yüzey, zarın siluetiyle eşleşen küçük bir simge olarak görünür; anında okunur.

### Kalıplar — favori hamleleriniz tek dokunuşla

`2D6 + 3 — hasar`'ı *"Pala"* gibi bir adla kaydedin, bir sonraki turda tek dokunuşla yeniden atın. Kalıplar karakterlere bağlıdır — aynı cihazdaki iki KK kendi setlerini ayrı ayrı tutar.

### Portre, not ve özel kalıplara sahip karakterler

Her oyuncuya birden çok KK. Her birinde isim, paylaşılan arka plan, sadece sizin gördüğünüz özel not, isteğe bağlı portre, kalıp listesi ve karaktere özel *"notu dışa aktarıma dahil et"* tercihi vardır. Yedek için JSON'a aktarın; başka bir cihaza içe aktararak KK'yı bir sonraki oturuma götürün. Bir karakteri oynarken ad `Karakter (Oyuncu)` biçiminde görünür.

### Zar atışları *ve* sohbet için tek akış

Atışlar ve sohbet, **Tümü / Atışlar / Sohbet / Dosyalar** filtresine sahip tek bir zaman çizelgesini paylaşır. `@` otomatik tamamlama doğru oyuncuyu işaret eder; `@all` herkese ulaşır. Sohbete bir resim eklediğinizde, gönderilmeden önce otomatik olarak küçültülür.

### Yeniden okunabilen geçmiş odalar

Her geçmiş oturum, kalıcı bir günlük olarak yerel saklanır. Lobiden eski bir odayı salt-okunur modda açabilirsiniz; eski günlükteki bir oyuncu adına dokunduğunuzda o günkü karakter anlık görüntüsü ve bilinen son portre görünür. Tüm odayı (sohbet, atışlar, resimler) tek bir ZIP olarak dışa aktarabilirsiniz.

### OY için araçlar

OY **gizli** atış yapabilir — diğerleri yalnızca *"gizli bir atış yapıldı"* yazısını görür, sayıyı görmez. OY bölümü ayrıca oda yeniden adlandırma ve kod yenileme işlemlerini bir açılır panel altında toplar; OY'nin çıkış butonu **Odayı kapat** yazar, böylece oturumun herkes için biteceği nettir.

### 19 dilde arayüz &amp; otomatik sohbet çevirisi

Arayüz 19 dilde. İsteğe bağlı sohbet otomatik çevirisi, varsa cihaz üzerindeki Chrome Translator API'sini kullanır; yoksa anahtar gerektirmeyen [MyMemory](https://mymemory.translated.net/) REST API'sine düşer. Çevrilmiş bir mesajda **Orijinal**'e dokununca tam olarak gönderileni görebilirsiniz.

### Küçük ama hoş ayrıntılar

Oyuncuya özel sabit renk, hafif yazıyor göstergesi, akışta katılma / ayrılma olayları, değiştirilebilir tema, ayarlanabilir yazı boyutu ve OY oda kapatınca nazik bildirim.

## Telefona kurun (PWA)

Site bir Progressive Web App'tir — iOS ve Android ana ekranına eklenip tam ekran başlatılabilir, tarayıcı çerçevesi olmadan ve neredeyse anında.

- **Android (Chrome):** Demoyu açın, tarayıcı menüsünden **Uygulamayı yükle** (veya *Ana ekrana ekle*) seçin.
- **iOS (Safari):** Demoyu açın, paylaş düğmesinden **Ana Ekrana Ekle** seçin.

Service worker uygulama kabuğunu önbelleğe aldığı için yeniden başlatma neredeyse anlıktır. Odaların kendisi WebRTC üzerinden P2P kaldığı için canlı bağlantı gerekir.

**Ekran yönü:** Manifest yönü kilitlemez veya geçersiz kılmaz; kurulu PWA cihazın otomatik döndürme / yön kilidi ayarına uyar (örn. Android'de otomatik döndürme kapalıyken cihazı yatırsanız bile uygulama mevcut yönde kalır).

## Çevrim içi paylaşım nasıl çalışır

Odalar [PeerJS](https://peerjs.com/) üzerinden **WebRTC peer-to-peer** kullanır. Oda oluşturucu (OY) ev sahibidir; diğer her oyuncu doğrudan OY'ye bağlanır ve OY paylaşılan durumu iletir. Bu projenin sunucularından oyun verisi geçmez. P2P olduğu için oda yalnızca OY sekmesini açık tuttuğu sürece açıktır.

## Teknoloji yığını

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- WebRTC P2P odalar için [PeerJS](https://peerjs.com/)
- Birim testler için [Vitest](https://vitest.dev/)
- Barındırma için GitHub Pages + GitHub Actions

## Geliştirme

```bash
npm install      # bağımlılıkları yükle
npm run dev      # geliştirme sunucusunu başlat
npm test         # birim testleri çalıştır
npm run lint     # kaynak lint
npm run build    # dist/ içine üretim derlemesi
```

## Yapılandırma (TURN relay, isteğe bağlı)

WebRTC, ağı UDP'yi engelleyen veya simetrik NAT kullanan (kafe / kamuya açık Wi-Fi'da sık görülür) oyuncuları bağlamak için bir TURN relay'e ihtiyaç duyar. Varsayılan olarak uygulama Open Relay Project'in ücretsiz kamuya açık TURN sunucularına düşer — sıradan kullanım için iyi, ancak best-effort.

Güvenilir bir relay için `.env.example`'ı `.env` olarak kopyalayın ve şunları ayarlayın:

- `VITE_TURN_URLS` — virgülle ayrılmış TURN URL'leri. UDP'nin engellendiği yerlerde de çalışacak şekilde TCP/443 üzerinde bir `turns:` girişini ekleyin.
- `VITE_TURN_USERNAME` — TURN kullanıcı adı.
- `VITE_TURN_CREDENTIAL` — TURN kimlik bilgisi / parola.

> **Güvenlik notu:** Vite her `VITE_*` değişkenini üretim paketine satır içine alır; burada ayarlanan TURN kimlik bilgileri sayfayı yükleyen herkese görünür. Kısa ömürlü / geçici TURN kimlik bilgileri kullanın (örn. TURN REST API'nin süreyle sınırlı kimlik bilgisi kalıbı) ve sağlayıcı tarafında limitler tanımlayın — izinli origin'ler, IP filtresi, aylık kota. Burada uzun ömürlü üretim kimlik bilgilerini yeniden kullanmayın.

GitHub Pages dağıtımında kullanmak için bunları repo gizli anahtarları olarak ekleyin ve `.github/workflows/deploy.yml` derleme adımında geçirin. Ücretsiz seçenekler arasında [Metered](https://www.metered.ca/) ücretsiz katmanı veya [coturn](https://github.com/coturn/coturn) öz-host'lama vardır.

## Dağıtım

`main`'e push, GitHub Actions iş akışını (`.github/workflows/deploy.yml`) tetikler; bu akış lint, test, derleme yapıp GitHub Pages'a yayımlar. Üretim temel yolu `/trpg-dice-online/`'dur; başka yerde barındırırken `BASE_PATH` ortam değişkeniyle değiştirin.

## Belgeler

- Gereksinimler ve uygulama planı: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Değişiklik günlüğü: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Gerçek zamanlı çeviri API araştırması: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Lisans

[MIT](LICENSE) © 2026 yamadar
