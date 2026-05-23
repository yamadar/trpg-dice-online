<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Một phòng xí ngầu bỏ túi cho đêm TRPG của bạn.</strong></p>

<p align="center">
  Mở trang web, chia sẻ một mã phòng ngắn, cả nhóm có thể tung xí ngầu cùng nhau —<br/>
  không cần tài khoản, không cài đặt, không có máy chủ game. Chỉ cần liên kết và xí ngầu.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Mở bản demo →</strong></a>
</p>

<p align="center">
  <em><strong>Ngôn ngữ:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Sảnh trống trên điện thoại với nhãn hiệu Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Dòng cập nhật trực tiếp với kết quả xí ngầu và trò chuyện" />
</p>

## Vì sao chọn ứng dụng này cho buổi chơi tiếp theo

- **Chia sẻ mã, bắt đầu tung.** GM tạo phòng và đọc mã 4–6 ký tự; những người khác chỉ cần nhập vào. Không cần tài khoản, không cần xác nhận email, không cần đăng ký.
- **Kết quả ở lại giữa cả nhóm.** P2P thuần qua WebRTC — kết quả và trò chuyện đi thẳng từ máy này sang máy khác, không đi qua bất kỳ máy chủ nào của chúng tôi.
- **Vừa khít chiếc điện thoại trên bàn.** Bố cục ưu tiên di động, cài được làm PWA trên iOS và Android, mở ra toàn màn hình.
- **Nói được 19 ngôn ngữ và dịch trò chuyện hộ bạn.** Vị tu sĩ tiếng Đức có thể đùa với tên đạo tặc tiếng Nhật mà không ai bị bật khỏi không khí nhập vai.
- **Được thiết kế để mở lại.** Nhân vật, mẫu, theme, cỡ chữ và các phiên cũ đều lưu trên máy — ứng dụng giống *hộp xí ngầu của bạn* hơn là một máy dùng chung.

## Bắt đầu một phiên trong 30 giây

1. **GM:** mở demo, chạm **Phòng → Tạo**, đọc to mã.
2. **Người chơi:** mở demo, chạm **Phòng → Tham gia**, nhập mã.
3. **Tất cả:** tung xí ngầu, trò chuyện, cùng nhau hò reo cho cú 20 tự nhiên đầu tiên.

GM là host: chỉ cần tab của GM còn mở, phòng vẫn còn sống. Đóng tab nghĩa là phiên kết thúc — các phòng cũ được lưu trên máy để có thể đọc lại nhật ký sau này.

## Bên trong hộp xí ngầu

### Xí ngầu nhìn cái là đọc ra

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, với số lượng, giá trị điều chỉnh có dấu và loại **sát thương / kiểm tra** diễn đạt kết quả như cách bàn chơi sẽ nói — *"Kết quả kiểm tra Tri giác: 18"*, *"Đại kiếm: 11 sát thương"*. Mỗi mặt rơi ra hiện ra dưới dạng một bóng nhỏ ứng với hình dáng của viên xí ngầu, đọc liền tức thì.

### Mẫu — đòn quen tay, một chạm là xong

Lưu `2D6 + 3 — sát thương` với cái tên như *"Đại kiếm"* và tung lại ở lượt sau chỉ với một lần chạm. Mẫu thuộc về nhân vật, nên hai PC trên cùng máy giữ kho mẫu của riêng mình.

### Nhân vật có chân dung, ghi chú và mẫu riêng

Mỗi người chơi có nhiều PC. Mỗi nhân vật có tên, tiểu sử chia sẻ trong phòng, ghi chú riêng tư chỉ bạn thấy, chân dung tùy chọn, danh sách mẫu riêng và tuỳ chọn *"đính kèm ghi chú khi xuất"* riêng theo nhân vật. Xuất ra JSON để sao lưu; nhập trên máy khác để mang PC đến phiên kế tiếp. Khi bạn đang nhập vai một nhân vật, tên hiển thị dưới dạng `Nhân vật (Người chơi)`.

### Một dòng cho cả xí ngầu *và* trò chuyện

Kết quả tung và trò chuyện chia sẻ một dòng thời gian với bộ lọc **Tất cả / Tung / Trò chuyện / Tệp**. Gõ `@` để gợi ý đúng người chơi; `@all` chạm tới mọi người. Đính kèm ảnh trong trò chuyện sẽ được tự động giảm kích thước trước khi gửi.

### Đọc lại phòng cũ

Mỗi phiên cũ được lưu trên máy dưới dạng nhật ký bền vững. Mở phòng cũ từ sảnh ở chế độ chỉ-đọc; chạm vào tên người chơi trong nhật ký cũ để xem ảnh chụp nhân vật thời điểm đó và chân dung cuối cùng đã biết. Xuất cả phòng (trò chuyện, kết quả tung, ảnh) thành một tệp ZIP.

### Công cụ cho GM

GM có thể tung **kín** — người khác chỉ thấy *"đã có một lần tung kín"*, không thấy số. Khu vực GM cũng gộp đổi tên phòng và đổi mã phòng vào một mục bung ra, và nút thoát của GM ghi **Đóng phòng** để khẳng định rằng việc đó kết thúc phiên cho cả nhóm.

### Giao diện 19 ngôn ngữ &amp; tự động dịch trò chuyện

Giao diện ở 19 ngôn ngữ. Tự động dịch trò chuyện (tùy chọn) ưu tiên dùng Chrome Translator API trên thiết bị nếu có và dự phòng REST API không cần khóa của [MyMemory](https://mymemory.translated.net/). Chạm **Bản gốc** trên tin nhắn đã dịch để xem chính xác nội dung được gửi.

### Vài chi tiết nhỏ tinh tế

Màu riêng cố định cho mỗi người chơi, chỉ báo đang gõ nhẹ nhàng, sự kiện vào / ra hiện trong dòng cập nhật, đổi theme, chỉnh cỡ chữ, và xử lý lịch sự khi GM đóng phòng.

## Cài lên điện thoại (PWA)

Trang web là Progressive Web App, nên có thể thêm vào màn hình chính iOS và Android và mở toàn màn hình — không thanh trình duyệt, mở lại gần như tức thời.

- **Android (Chrome):** mở demo, chạm menu trình duyệt, chọn **Cài đặt ứng dụng** (hoặc *Thêm vào Màn hình chính*).
- **iOS (Safari):** mở demo, chạm chia sẻ, chọn **Thêm vào Màn hình chính**.

Service worker đã pre-cache vỏ ứng dụng nên mở lại gần như tức thời, nhưng các phòng vẫn là WebRTC P2P và cần mạng đang hoạt động.

**Hướng màn hình:** manifest không khoá hay ghi đè hướng — PWA đã cài chạy theo cài đặt tự xoay / khoá xoay của thiết bị (ví dụ trên Android nếu tắt tự xoay, nghiêng máy thì ứng dụng vẫn giữ hướng hiện tại).

## Cách chia sẻ online hoạt động

Phòng dùng **WebRTC peer-to-peer** qua [PeerJS](https://peerjs.com/). Người tạo phòng (GM) là host; mỗi người chơi khác kết nối trực tiếp đến GM, GM chuyển tiếp trạng thái chia sẻ. Không có dữ liệu trò chơi nào đi qua máy chủ do dự án này vận hành. Vì là P2P, phòng chỉ tồn tại khi GM còn mở tab.

## Stack công nghệ

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) cho phòng P2P trên WebRTC
- [Vitest](https://vitest.dev/) cho unit test
- GitHub Pages + GitHub Actions cho hosting

## Phát triển

```bash
npm install      # cài dependency
npm run dev      # chạy dev server
npm test         # chạy unit test
npm run lint     # lint mã nguồn
npm run build    # build production vào dist/
```

## Cấu hình (TURN relay, tuỳ chọn)

WebRTC cần TURN relay để kết nối những người chơi mà mạng chặn UDP hoặc dùng NAT đối xứng (thường gặp ở Wi-Fi quán cà phê / công cộng). Mặc định ứng dụng dùng các máy chủ TURN miễn phí công cộng của Open Relay Project — đủ dùng thoải mái nhưng best-effort.

Để có relay đáng tin cậy, sao chép `.env.example` thành `.env` và đặt:

- `VITE_TURN_URLS` — danh sách URL TURN ngăn cách bằng dấu phẩy. Bao gồm một mục `turns:` trên TCP/443 để hoạt động ở nơi UDP bị chặn.
- `VITE_TURN_USERNAME` — tên người dùng TURN.
- `VITE_TURN_CREDENTIAL` — credential / mật khẩu TURN.

> **Lưu ý bảo mật:** Vite chèn mọi biến `VITE_*` vào bundle production, nên thông tin TURN đặt ở đây sẽ hiển thị cho bất kỳ ai mở trang. Dùng credential TURN ngắn hạn / tạm thời (ví dụ mẫu time-limited credential của TURN REST API) và đặt giới hạn phía nhà cung cấp — origin được phép, lọc IP, hạn ngạch tháng. Đừng dùng lại credential production lâu dài ở đây.

Để dùng trong deploy GitHub Pages, thêm chúng dưới dạng repo secret và truyền vào bước build trong `.github/workflows/deploy.yml`. Lựa chọn miễn phí gồm gói free của [Metered](https://www.metered.ca/) hoặc self-host [coturn](https://github.com/coturn/coturn).

## Deploy

Push lên `main` kích hoạt workflow GitHub Actions (`.github/workflows/deploy.yml`), chạy lint, test, build và publish lên GitHub Pages. Base path production là `/trpg-dice-online/`; ghi đè bằng biến môi trường `BASE_PATH` nếu host nơi khác.

## Tài liệu

- Yêu cầu và kế hoạch triển khai: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Nhật ký thay đổi: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Nghiên cứu API dịch thời gian thực: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Giấy phép

[MIT](LICENSE) © 2026 yamadar
