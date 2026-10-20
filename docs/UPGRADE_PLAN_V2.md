# FB Manager AI — Upgrade Plan V2

_Ngày lập kế hoạch: 2026-10-19_  
_Branch: `feature/v2-upgrade`_

---

## 1. Existing Features (Đã hoàn thành)

### Infrastructure
- Tauri 2 + React 18 + TypeScript + Vite + Tailwind CSS + Zustand + SQLite
- Git CI/CD qua GitHub Actions (ci.yml, release.yml)
- Cross-platform: macOS + Windows
- SQLite migration version 1 với 10 bảng đã tạo
- Keychain (keyring) lưu OpenAI API key bảo mật
- Backup/Restore SQLite

### Account Manager (Phase 2 — Hoàn chỉnh)
- CRUD tài khoản (tên, ghi chú, connection_status)
- Search + bulk delete
- Pagination

### Group Manager (Phase 2 — Hoàn chỉnh)
- CRUD group (URL, tên, mô tả, topic, rules, advertising, favorite)
- URL normalization + UNIQUE constraint
- Import CSV (tối đa 1000 dòng, bỏ qua trùng)
- Export CSV trang hiện tại
- Search + topic filter + favorite filter
- Multi-select + bulk delete
- Mở Group trong trình duyệt mặc định

### AI Content (Phase 3 — Cơ bản)
- AI generation với OpenAI (hoặc demo mode)
- Lưu template vào thư viện
- Quản lý thư viện (list + delete)
- Config AI key qua keychain

### Campaign Manager (Phase 3 — Cơ bản)
- CRUD campaign với danh sách Group
- Tạo campaign_posts cho từng Group
- Workflow states: DRAFT → READY → REVIEWED → OPENED → USER_CONFIRMED → COMPLETED
- Mở Facebook Group trong trình duyệt (Assisted Publishing)

### Settings
- Light/Dark theme (lưu vào SQLite)
- Backup/Restore SQLite
- Hiển thị thông tin database

### Dashboard
- Số liệu tổng quan từ SQLite (accounts, groups, campaigns, contents, confirmed)
- Activity log (lịch sử 50 hoạt động gần nhất)
- Getting started guide

---

## 2. Missing Features (Cần bổ sung theo V2)

### Account Manager V2
- [ ] Mở Facebook bằng trình duyệt do người dùng chọn (không chỉ mặc định)
- [ ] Phân loại tài khoản (cột `category`)
- [ ] Liên kết account ↔ group (UI hiển thị số Group/account) — `account_groups` table đã có
- [ ] Hiển thị số Group đã liên kết trên danh sách tài khoản

### Group Manager V2
- [ ] Phân loại OWNED / JOINED (membership trong `account_groups`)
- [ ] Gắn Group với tài khoản cụ thể (UI chọn account trong GroupForm)
- [ ] Group blacklist
- [ ] Pagination group picker trong campaign form (hiện chỉ load 100 đầu)
- [ ] Lịch sử sử dụng Group (lần cuối đăng bài)
- [ ] Chỉnh sửa hàng loạt (bulk edit topic/advertising)
- [ ] Pagination controls đầy đủ (hiện footer thiếu nút chuyển trang)

### AI Content V2
- [ ] Nhập đối tượng khách hàng (audience)
- [ ] Chỉnh sửa bài viết trực tiếp trong draft
- [ ] Preview bài đăng (giả lập layout Facebook)
- [ ] Đính kèm hình ảnh (media_assets table đã có)
- [ ] Khi chọn nhiều Group: đề xuất nội dung theo từng nhóm chủ đề
- [ ] Export nội dung ra file

### Campaign Manager V2 — Thiết kế lại hoàn toàn
- [ ] Campaign Dashboard 3-panel (left/center/right)
- [ ] Account selector trong Campaign
- [ ] Campaign Jobs với trạng thái V2: PENDING/PREPARING/READY/AWAITING_USER/COMPLETED/FAILED/CANCELLED/SKIPPED
- [ ] Background Job Queue (persistent, pause/resume/cancel)
- [ ] Duplicate job prevention
- [ ] Progress tracking + error logging
- [ ] Assisted Publishing flow cải tiến (copy nội dung, preview media)
- [ ] Hiển thị Publishing Capability (ASSISTED / UNSUPPORTED) rõ ràng
- [ ] Campaign stats: Total/Prepared/Awaiting/Completed/Failed/Progress bar
- [ ] Activity log per campaign
- [ ] Cancel campaign + cancel individual jobs

### Browser Extension (Chrome)
- [ ] Extension manifest V3 cơ bản
- [ ] Nút "Save Group" khi đang xem FB Group
- [ ] Gửi URL + tên Group về Desktop App qua native messaging

### Database Migrations
- [ ] Migration 002: thêm `category` cho accounts, `blacklisted` cho groups, `last_used_at` cho groups
- [ ] Migration 002: thêm `campaign_jobs` table với trạng thái V2
- [ ] Migration 002: thêm `publishing_history` table
- [ ] Migration 002: thêm index mới

---

## 3. Features Requiring Modification (Cần sửa)

| File | Thay đổi |
|------|---------|
| `src-tauri/src/lib.rs` | Thêm commands mới, mở rộng structs, thêm job queue logic |
| `src-tauri/migrations/` | Tạo `002_v2.sql` |
| `src/types/index.ts` | Bổ sung types mới |
| `src/services/database.ts` | Bổ sung service calls mới |
| `src/modules/campaigns/Campaigns.tsx` | Redesign thành 3-panel dashboard |
| `src/modules/content/Content.tsx` | Thêm audience, preview, edit draft |
| `src/modules/accounts/Accounts.tsx` | Thêm category, group count |
| `src/modules/groups/Groups.tsx` | Thêm blacklist, bulk edit, last used, account link |
| `src/layouts/DesktopLayout.tsx` | Cập nhật version label |
| `src/app/navigation.ts` | Không thay đổi |

---

## 4. Database Changes

### Migration 002 — V2 Additions

```sql
-- Thêm cột cho accounts
ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'personal';

-- Thêm cột cho groups
ALTER TABLE groups ADD COLUMN blacklisted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE groups ADD COLUMN last_used_at TEXT;

-- Bảng campaign_jobs (Job Queue V2)
CREATE TABLE campaign_jobs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  content TEXT NOT NULL DEFAULT '',
  prepared_content TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bảng publishing_history
CREATE TABLE publishing_history (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES campaign_jobs(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  post_url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Rollback:** Không thể undo `ALTER TABLE` trong SQLite. Rollback = khôi phục backup SQLite.

---

## 5. Files Expected to Change

### New files
- `src-tauri/migrations/002_v2.sql`
- `src/modules/campaigns/CampaignDashboard.tsx`
- `src/modules/campaigns/JobQueue.tsx`
- `chrome-extension/manifest.json`
- `chrome-extension/content.js`
- `chrome-extension/popup.html`
- `docs/CHROME_EXTENSION.md`
- `docs/UPGRADE_PLAN_V2.md` (file này)

### Modified files
- `src-tauri/src/lib.rs`
- `src/types/index.ts`
- `src/services/database.ts`
- `src/modules/campaigns/Campaigns.tsx`
- `src/modules/content/Content.tsx`
- `src/modules/accounts/Accounts.tsx`
- `src/modules/groups/Groups.tsx`

---

## 6. Compatibility Risks

| Risk | Mức độ | Giải pháp |
|------|--------|-----------|
| `ALTER TABLE` không rollback trong SQLite | Thấp | Backup trước khi migrate |
| Job queue cần tokio async | Trung bình | Dùng `std::thread` + channel hoặc tokio via tauri |
| Chrome Extension cần localhost server | Trung bình | Dùng HTTP server nhỏ trong Tauri hoặc native messaging |
| Existing `campaign_posts` statuses khác V2 | Thấp | Giữ nguyên campaign_posts, thêm campaign_jobs song song |

---

## 7. Implementation Order

1. **[DONE]** Backup SQLite + tạo branch `feature/v2-upgrade`
2. Migration 002 + Rust commands mới
3. Types + Database service layer
4. Group Manager V2
5. Account Manager V2
6. AI Content V2
7. Campaign Dashboard V2 + Job Queue
8. Chrome Extension (cơ bản)
9. Testing toàn bộ
10. Report

---

## 8. Pre-migration Backup

SQLite backup được tạo tự động khi người dùng chạy lệnh `create_backup` trong app (Settings).
Path: `~/Library/Application Support/com.fbmanagerai.desktop/backups/` (macOS)
Path: `%APPDATA%\com.fbmanagerai.desktop\backups\` (Windows)

Để tạo backup thủ công trong development:
```bash
cp ~/Library/Application\ Support/com.fbmanagerai.desktop/fb-manager-ai.sqlite \
   ~/Library/Application\ Support/com.fbmanagerai.desktop/fb-manager-ai.backup-before-v2.sqlite
```
