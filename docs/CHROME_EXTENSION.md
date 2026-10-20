# Hướng Dẫn Sử Dụng Chrome Extension (Tùy Chọn) — FB Manager AI V2

## Giới thiệu
Chrome Extension `FB Manager AI — Save Group` là công cụ tiện ích tùy chọn hỗ trợ người dùng thu thập thông tin các Facebook Group đang duyệt trên trình duyệt để thêm nhanh vào ứng dụng desktop FB Manager AI.

---

## 1. Nguyên Tắc An Toàn & Bảo Mật
- **Không thu thập mật khẩu, cookie, session hay mã 2FA.**
- **Không yêu cầu Facebook Access Token.**
- **Không tự động quét ngầm hay gửi request tới máy chủ ngoài.**
- **Chỉ kích hoạt khi người dùng bấm vào biểu tượng Extension** trên một tab Facebook Group (`https://www.facebook.com/groups/*`).
- Chỉ đọc URL và tiêu đề công khai của Group hiển thị trên tab hiện tại.

---

## 2. Cài Đặt Vào Google Chrome / Brave / Edge (Chromium)

1. Mở trình duyệt Chrome và truy cập: `chrome://extensions/`
2. Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Bấm nút **Load unpacked** (Tải tiện ích đã giải nén).
4. Điều hướng tới thư mục dự án và chọn thư mục:
   ```
   BestCareB/chrome-extension
   ```
5. Tiện ích `FB Manager AI — Save Group` sẽ xuất hiện trên thanh công cụ của trình duyệt.
6. (Tùy chọn) Bấm vào biểu tượng mảnh ghép trên Chrome để ghim (Pin) icon tiện ích lên thanh địa chỉ.

---

## 3. Cách Sử Dụng

1. Điều hướng đến bất kỳ nhóm Facebook nào, ví dụ:
   `https://www.facebook.com/groups/congdongmarketingvn`
2. Nhấp vào icon **FB Manager AI** trên thanh tiện ích Chrome.
3. Popup sẽ hiển thị:
   - Tên nhóm Facebook
   - URL chuẩn của nhóm
4. Bấm nút **📋 Copy để dán vào FB Manager AI**.
5. Mở ứng dụng desktop **FB Manager AI** -> vào menu **Quản lý nhóm** -> bấm **Thêm nhóm** -> Dán URL và lưu nhóm.

---

## 4. Cấu Trúc Mã Nguồn Extension

```
chrome-extension/
├── manifest.json   # Manifest V3 cấu hình quyền tối thiểu (activeTab, storage)
├── content.js      # Content script đọc URL & title công khai khi có yêu cầu
├── popup.html      # Giao diện popup desktop mini
└── popup.js        # Logic điều khiển, hiển thị, copy clipboard và lịch sử lưu tạm
```
