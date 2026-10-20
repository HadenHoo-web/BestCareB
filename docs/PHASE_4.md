# Phase 4 — Test, backup và release

## Đã hoàn thành

- Backup SQLite dùng SQLite backup API; không sao chép thô một file database đang mở.
- Restore chỉ từ danh sách backup do ứng dụng tạo và kiểm tra ID file để chặn path traversal.
- Trước khi restore, ứng dụng tạo một bản sao an toàn của database hiện tại.
- Export CSV báo cáo campaign posts.
- CI chạy typecheck, lint, tests, build frontend, Rust tests và schema tests.
- Release workflow build macOS ARM64, macOS Intel x64, Windows x64 NSIS/MSI và tải artifacts lên GitHub Actions.
- Tài liệu kiểm thử thủ công và cấu hình release.

## Cần cấu hình trước khi phát hành công khai

1. Đẩy project lên GitHub và đặt nhánh mặc định là `main` hoặc sửa workflow phù hợp.
2. Thêm GitHub Secrets cho Tauri signing key. Đây là điều kiện cần cho updater có chữ ký.
3. Với macOS, thêm Apple signing/notarization secrets trong `docs/TESTING.md`.
4. Cấu hình endpoint updater trỏ tới `latest.json` của GitHub Release sau khi đã có repository và public key phát hành. Không đặt endpoint hoặc public key giả trong source.
5. Tạo tag `v0.1.0` để workflow tạo installers. Cài thử từng installer trên máy mục tiêu trước khi phát hành rộng rãi.

## Trạng thái test

Backend và frontend đã kiểm tra local. macOS ARM64 là môi trường phát triển hiện tại. Windows, macOS Intel, code signing, notarization và auto-update cần GitHub Actions/certificate thực để xác minh; chúng không thể được tuyên bố đã kiểm tra thành công khi chưa có các credentials đó.
