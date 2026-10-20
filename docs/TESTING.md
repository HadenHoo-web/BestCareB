# Hướng dẫn test FB Manager AI

## Test nhanh trên macOS

```sh
cd /Users/hoquochuy/Desktop/BestCareB
export CARGO_HOME="$PWD/.toolchain/cargo"
export RUSTUP_HOME="$PWD/.toolchain/rustup"
export PATH="$CARGO_HOME/bin:$PATH"
npm run tauri dev
```

## Checklist thao tác

1. Mở **Tài khoản Facebook**, thêm một tài khoản, sửa ghi chú và xóa nó.
2. Mở **Quản lý nhóm**, thêm URL hợp lệ `https://www.facebook.com/groups/example`, sau đó thử nhập lại để xác minh chống trùng.
3. Nhập CSV có cột `url,name,topic`; xác nhận toast báo số dòng nhập và bỏ qua.
4. Mở **Sáng tạo với AI**, tạo bản demo, lưu vào thư viện, sau đó tạo một chiến dịch dùng nội dung đó.
5. Đi tuần tự qua trạng thái chiến dịch. Ở `REVIEWED`, nút mở Group phải chỉ mở trình duyệt; cần bấm xác nhận riêng để sang `USER_CONFIRMED`.
6. Vào **Cài đặt**, tạo backup, chỉnh một dữ liệu, rồi khôi phục backup. Ứng dụng tự tạo thêm bản sao an toàn trước khi restore.
7. Vào **Lịch sử hoạt động**, tải báo cáo CSV.

## Kiểm tra tự động

```sh
npm run typecheck
npm run lint
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
python3 tests/test_schema.py
```

## CI/release

`.github/workflows/ci.yml` xác minh pull request và nhánh `main`. Khi tạo tag `vX.Y.Z`, `.github/workflows/release.yml` build macOS ARM64, macOS x64 và Windows x64, rồi tải installer lên Actions artifacts.

Để ký và notarize, cấu hình GitHub Secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. Chưa có các secret này, workflow vẫn là cấu hình build; không được xem là bản phát hành đã ký.
