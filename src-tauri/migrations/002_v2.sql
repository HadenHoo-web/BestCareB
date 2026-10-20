-- Migration 002 — V2 Upgrade
-- Tương thích ngược: chỉ thêm cột và bảng, không xóa dữ liệu cũ.
-- Backup SQLite trước khi chạy.

-- 1. Thêm cột category vào accounts (phân loại tài khoản)
ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'personal'
  CHECK(category IN ('personal','business','page','other'));

-- 2. Thêm cột blacklisted và last_used_at vào groups
ALTER TABLE groups ADD COLUMN blacklisted INTEGER NOT NULL DEFAULT 0
  CHECK(blacklisted IN (0,1));
ALTER TABLE groups ADD COLUMN last_used_at TEXT;

-- 3. Bảng campaign_jobs (Job Queue V2 — song song với campaign_posts cũ)
CREATE TABLE campaign_jobs (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  group_id        TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','PREPARING','READY','AWAITING_USER','COMPLETED','FAILED','CANCELLED','SKIPPED')),
  content         TEXT NOT NULL DEFAULT '',
  prepared_content TEXT,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
  scheduled_at    TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, group_id)
);

-- 4. Bảng publishing_history (lịch sử đăng bài)
CREATE TABLE publishing_history (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES campaign_jobs(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  post_url    TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes mới
CREATE INDEX idx_jobs_campaign   ON campaign_jobs(campaign_id, status);
CREATE INDEX idx_jobs_status     ON campaign_jobs(status);
CREATE INDEX idx_jobs_group      ON campaign_jobs(group_id);
CREATE INDEX idx_groups_blacklist ON groups(blacklisted);
CREATE INDEX idx_history_campaign ON publishing_history(campaign_id);
CREATE INDEX idx_history_group    ON publishing_history(group_id);
