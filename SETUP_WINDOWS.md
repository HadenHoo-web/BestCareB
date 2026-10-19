# Cài đặt trên Windows x64

1. Cài Node.js 22 LTS.
2. Cài Visual Studio Build Tools với workload **Desktop development with C++** và Windows SDK.
3. Cài Rust stable từ https://rustup.rs, chọn toolchain MSVC.
4. Cài Microsoft Edge WebView2 Runtime nếu máy chưa có.
5. Mở terminal mới, kiểm tra `node --version`, `cargo --version`.
6. Chạy trong thư mục dự án:

```powershell
npm ci
npm run tauri dev
```

Đường dẫn SQLite hiển thị trong trang Cài đặt. Ứng dụng không cần VPS, không yêu cầu Facebook token hoặc AI key để mở.

## Kiểm tra và build

```powershell
npm run typecheck
npm run lint
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles msi
```

Lệnh MSI cần môi trường WiX phù hợp. Installer thường ở `src-tauri/target/x86_64-pc-windows-msvc/release/bundle`. Build Windows chưa được xác minh trong phiên phát triển trên macOS. Workflow GitHub Actions và ký mã thuộc Phase 4.
