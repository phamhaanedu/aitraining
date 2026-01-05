# Hướng dẫn Cấu hình Google Sheets để nhận dữ liệu Form

Bạn hoàn toàn có thể sử dụng tài khoản Gmail cá nhân miễn phí. Hãy làm theo các bước sau:

## Bước 1: Tạo Google Sheet
1. Truy cập [Google Sheets](https://sheets.new) và tạo một bảng tính mới.
2. Đặt tên bảng tính (ví dụ: "Data Khách Hàng AI").
3. Ở dòng đầu tiên (Hàng 1), đặt tên các cột chính xác như sau:
   - Cột A: `Timestamp`
   - Cột B: `Name`
   - Cột C: `Email`
   - Cột D: `Phone`
   - Cột E: `Track` (Để biết họ chọn Lộ trình nào)

## Bước 2: Tạo Google Apps Script
1. Tại Google Sheet đó, trên thanh menu chọn **Extensions (Tiện ích mở rộng)** > **Apps Script**.
2. Một tab mới mở ra. Xóa hết code trắng trong đó và dán đoạn code sau vào:

```javascript
var SHEET_NAME = "Sheet1"; // Đổi nếu tên sheet của bạn khác

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName(SHEET_NAME);

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var nextRow = sheet.getLastRow() + 1;

    var newRow = headers.map(function(header) {
      if (header === 'Timestamp') {
        return new Date();
      }
      // Khớp tên biến từ form HTML gửi lên
      return e.parameter[header];
    });

    sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);

    return ContentService
      .createTextOutput(JSON.stringify({ "result": "success", "row": nextRow }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ "result": "error", "error": e }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  finally {
    lock.releaseLock();
  }
}
```

3. Nhấn **Save** (Biểu tượng đĩa mềm).

## Bước 3: Triển khai (Deploy)
Đây là bước quan trọng nhất:
1. Nhấn nút **Deploy (Triển khai)** (màu xanh góc phải) > **New deployment (Tùy chọn triển khai mới)**.
2. Tại bảng hiện ra:
   - **Select type**: Chọn biểu tượng bánh răng > **Web app**.
   - **Description**: Ghi chú tùy ý (vd: v1).
   - **Execute as (Chạy dưới quyền)**: Chọn **Me (Tôi)** (quan trọng!).
   - **Who has access (Ai có quyền truy cập)**: Chọn **Anyone (Bất kỳ ai)** (Rất quan trọng! Để form trên web có thể gửi tin về mà không bắt khách đăng nhập).
3. Nhấn **Deploy**.
4. Google sẽ yêu cầu cấp quyền (Authorize access). Vì script này do bạn viết nên Google sẽ cảnh báo "Unverified app".
   - Chọn tài khoản của bạn.
   - Bấm **Advanced (Nâng cao)** > **Go to ... (unsafe)**.
   - Bấm **Allow**.
5. Copy **Web App URL** (đường link dài bắt đầu bằng `https://script.google.com/macros/s/...`).

## Bước 4: Cập nhật vào Website
1. Mở file [script.js](file:///d:/web%20project/AITraining/landing-page-ai/script.js) trong thư mục code.
2. Tìm dòng `const SCRIPT_URL = '...';` (tôi đã để sẵn placeholder).
3. Dán URL bạn vừa copy vào đó.

Vậy là xong!



Deployment ID
AKfycbype4T5-vYvRq-r-6Dh5sIR3ZOUklj0rpQ2_VtRJKXnUw7JbObDtnIFOmzqxZVfsMrD

Web app
URL:
https://script.google.com/macros/s/AKfycbype4T5-vYvRq-r-6Dh5sIR3ZOUklj0rpQ2_VtRJKXnUw7JbObDtnIFOmzqxZVfsMrD/exec