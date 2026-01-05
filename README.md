# AI Training Project

Dự án này bao gồm hai phần chính:
1. **MyGallery**: Trình tạo album ảnh tĩnh (Static Photo Gallery).
2. **Landing Page AI**: Trang giới thiệu khóa học "Làm chủ AI Thực chiến".

## 1. Landing Page AI
Landing page được thiết kế độc lập bằng HTML/CSS/JS thuần, tối ưu cho tốc độ và dễ dàng triển khai.

### Vị trí mã nguồn
- Mã nguồn gốc (nếu có): `landing-page-ai/` (đã được di chuyển).
- **Mã nguồn chạy thực tế (Public)**: `docs/landing-page-ai/`

### Cách truy cập
Sau khi deploy lên GitHub Pages hoặc Web Server, đường dẫn sẽ là:
`https://[your-domain]/AITraining/landing-page-ai/`

Nếu chạy local (mở trực tiếp file):
- Mở file `docs/landing-page-ai/index.html`

### Cấu hình Form Đăng ký
Landing page tích hợp sẵn form đăng ký gửi dữ liệu về **Google Sheets** thông qua **Google Apps Script**.

**Các bước cấu hình:**
1. Đọc file hướng dẫn chi tiết tại: `customize/google_sheet_instructions.md`.
2. Tạo Google Sheet và Google Apps Script theo hướng dẫn.
3. Deploy Web App (chế độ *Anyone*).
4. Lấy **Web App URL**.
5. Mở file `docs/landing-page-ai/script.js`.
6. Thay thế biến `SCRIPT_URL` bằng URL của bạn:
   ```javascript
   const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

## 2. MyGallery (Thư viện ảnh)
Hệ thống tạo gallery tĩnh từ thư mục ảnh.

### Lệnh chính
- **Cài đặt**: `npm install`
- **Chạy development**: `npm run dev` (Build + Serve tại `http://localhost:3000`)
- **Build tĩnh**: `npm run build` (Tạo output tại thư mục `docs/`)

### Cấu trúc thư mục
- `albums/`: Chứa các folder ảnh và file markdown/json cấu hình.
- `templates/`: Giao diện (Theme) của Gallery.
- `scripts/`: Chứa các script build nodejs.
- `docs/`: Thư mục đầu ra (Output) -> Đây là thư mục bạn sẽ upload lên host.
