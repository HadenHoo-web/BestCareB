# File tạo trong Phase 1

## Frontend

- `src/app/App.tsx` — định tuyến ứng dụng.
- `src/app/navigation.ts` — cấu hình điều hướng.
- `src/app/styles.css` — hệ thống giao diện desktop.
- `src/components/History.tsx` — lịch sử hoạt động.
- `src/components/ModulePlaceholder.tsx` — trạng thái cho module chưa triển khai.
- `src/components/ui/button.tsx` — primitive button.
- `src/layouts/DesktopLayout.tsx` — layout, sidebar, header, footer.
- `src/modules/dashboard/Dashboard.tsx` — dashboard.
- `src/modules/accounts/Accounts.tsx` — CRUD tài khoản Facebook.
- `src/modules/groups/Groups.tsx` — CRUD, CSV import/export và lọc Facebook Group.
- `src/modules/content/Content.tsx` — tạo nội dung AI/demo và thư viện bài viết.
- `src/modules/campaigns/Campaigns.tsx` — tạo chiến dịch và workflow bài viết.
- `src/modules/settings/Settings.tsx` — cài đặt.
- `src/components/ui/Modal.tsx` — modal nhập liệu dùng chung.
- `src/services/database.ts` — lớp IPC SQLite.
- `src/stores/app.ts` — Zustand state.
- `src/types/index.ts`, `src/utils/cn.ts`, `src/main.tsx` — phần dùng chung và bootstrap.

## Desktop / SQLite

- `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` — Tauri backend và database service.
- `src-tauri/migrations/001_initial.sql` — migration schema version 1.
- `src-tauri/capabilities/default.json` — capability tối thiểu.
- `src-tauri/tauri.conf.json` — cấu hình desktop/bundle.
- `.github/workflows/ci.yml`, `.github/workflows/release.yml` — kiểm tra và build cross-platform trên GitHub Actions.
- `src-tauri/icons/` — icon được tạo từ `source.svg`.

## Cấu hình, kiểm thử và tài liệu

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `postcss.config.js`, `components.json`, `index.html`, `.gitignore`.
- `tests/database.test.ts`, `tests/test_schema.py`.
- `README.md`, `SETUP_MAC.md`, `SETUP_WINDOWS.md`, `docs/PHASE_1.md`, `docs/PHASE_2.md`, `docs/PHASE_3.md`, `docs/PHASE_4.md`, `docs/TESTING.md`.
