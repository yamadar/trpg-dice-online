# TRPG Xúc xắc trực tuyến

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Trình tung xúc xắc trực tuyến cho phiên TRPG: tung xúc xắc, lưu mẫu dùng
lại và chia sẻ kết quả, lịch sử, trò chuyện theo thời gian thực với
nhóm chơi — tất cả từ một trang tĩnh, không backend.

**🎲 Bản demo:** https://yamadar.github.io/trpg-dice-online/

## Tính năng

- **Xúc xắc (A)** — chọn số lượng và loại cho mỗi lần tung
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` tung hai d10 làm chữ số;
  `00` được hiểu là 100.
- **Hệ số điều chỉnh (B)** — cộng/trừ số nguyên vào kết quả.
- **Loại (C)** — `sát thương` hoặc `kiểm tra`.
- **Nhân vật** — quản lý nhiều nhân vật (tên, bối cảnh công khai, ghi
  chú riêng, ảnh đại diện tuỳ chọn, danh sách mẫu và tuỳ chọn "đưa ghi
  chú vào xuất" theo từng nhân vật); chuyển đổi và xuất/nhập dạng JSON.
- **Mẫu** — kết hợp A + B + C với một tên và lưu theo nhân vật; tung lại
  bằng một lần chạm từ danh sách.
- **Dòng lịch sử và trò chuyện** — kết quả tung và trò chuyện trong cùng
  một dòng thời gian, có bộ lọc Tất cả / Tung / Trò chuyện / Tệp.
- **Lịch sử phòng trước đây** — mỗi phiên đều được lưu; xem dòng đọc-
  chỉ-được-đọc từ sảnh và xoá theo phiên hoặc tất cả. Chạm vào tên để
  xem ảnh chụp nhân vật và ảnh đại diện gần nhất đã biết.
- **Phòng trực tuyến** — màn Tạo / Tham gia riêng biệt với mã phòng
  (tối thiểu 4 ký tự; tự sinh ra 6 ký tự). Lịch sử, trò chuyện và danh
  sách người chơi chia sẻ qua P2P; khi tải lại, GM tự hosting lại và
  người chơi tự vào lại.
- **Điều khiển GM** — đổi tên phòng và đổi mã phòng nằm trong khu vực
  GM có thể thu gọn; nút thoát của GM ghi là "Đóng phòng".
- **Tung ẩn của GM** — GM có thể ẩn giá trị; người khác chỉ thấy có
  tung ẩn xảy ra.
- **Màu người chơi & chỉ báo đang nhập** — mỗi người chơi có màu cố
  định, chỉ báo nhẹ cho biết ai đang nhập.
- **Sự kiện phòng** — vào/rời xuất hiện trong dòng tin; khi GM đóng
  phòng, mọi người được thông báo rõ ràng.
- **Đa ngôn ngữ** — giao diện hỗ trợ 19 ngôn ngữ.

## Cách hoạt động chia sẻ trực tuyến

Ứng dụng dùng **kết nối WebRTC P2P qua [PeerJS](https://peerjs.com/)**.
Người tạo phòng (GM) làm host; những người khác kết nối trực tiếp đến
GM, GM truyền trạng thái chung. Không có dữ liệu nào đi qua máy chủ của
dự án này. Vì là P2P, phòng chỉ tồn tại khi GM mở trang.

## Công nghệ

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (kiểm thử)
- GitHub Pages + GitHub Actions (lưu trữ)

## Phát triển

```bash
npm install      # cài phụ thuộc
npm run dev      # chạy dev server
npm test         # chạy test
npm run lint     # lint
npm run build    # build production vào dist/
```

## Triển khai

Push lên `main` sẽ kích hoạt workflow GitHub Actions
(`.github/workflows/deploy.yml`): lint, test, build và publish lên
GitHub Pages. Base path trong production là `/trpg-dice-online/`; ghi
đè bằng biến môi trường `BASE_PATH` khi host ở nơi khác.

## Tài liệu

- Yêu cầu và kế hoạch: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Nghiên cứu API dịch: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Giấy phép

[MIT](LICENSE) © 2026 yamadar
