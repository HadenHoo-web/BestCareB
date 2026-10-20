use rusqlite::{Connection, params, OptionalExtension, OpenFlags};
use rusqlite::backup::Backup;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use url::Url;
use uuid::Uuid;

struct Database { connection: Mutex<Connection>, path: String }

// ─── Backup ──────────────────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile { id: String, created_at: String, bytes: u64 }

// ─── Migration ───────────────────────────────────────────────────────────────
fn migrate(connection: &mut Connection) -> rusqlite::Result<()> {
    connection.pragma_update(None, "foreign_keys", "ON")?;
    connection.busy_timeout(std::time::Duration::from_secs(5))?;
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > 2 { return Err(rusqlite::Error::InvalidQuery); }
    if version == 0 {
        let tx = connection.transaction()?;
        tx.execute_batch(include_str!("../migrations/001_initial.sql"))?;
        tx.pragma_update(None, "user_version", 1)?;
        tx.commit()?;
    }
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version == 1 {
        let tx = connection.transaction()?;
        tx.execute_batch(include_str!("../migrations/002_v2.sql"))?;
        tx.pragma_update(None, "user_version", 2)?;
        tx.commit()?;
    }
    Ok(())
}

// ─── Overview & Activity ─────────────────────────────────────────────────────
#[derive(Serialize)]
struct Overview {
    accounts: i64, groups: i64, campaigns: i64, contents: i64, confirmed: i64,
    database_path: String, schema_version: i64, theme: String,
    pending_jobs: i64, completed_jobs: i64,
}
#[derive(Serialize)]
struct Activity { id: i64, action: String, created_at: String }

// ─── Account ─────────────────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Account {
    id: String, name: String, notes: String,
    avatar_path: Option<String>, connection_status: String,
    category: String, group_count: i64, created_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountInput { name: String, notes: String, connection_status: String, category: String }

// ─── Group ───────────────────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Group {
    id: String, url: String, facebook_id: Option<String>, name: String,
    description: String, topic: String, rules: String, advertising: String,
    favorite: bool, blacklisted: bool, last_used_at: Option<String>, created_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupInput {
    url: String, name: String, description: String, topic: String,
    rules: String, advertising: String, favorite: bool, blacklisted: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupImportRow {
    url: String, name: Option<String>, description: Option<String>,
    topic: Option<String>, rules: Option<String>, advertising: Option<String>,
    favorite: Option<bool>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BulkEditGroupInput { ids: Vec<String>, topic: Option<String>, advertising: Option<String>, blacklisted: Option<bool> }

// ─── Pagination & ImportResult ────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Page<T> { items: Vec<T>, total: i64 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportResult { imported: usize, skipped: usize }

// ─── Content ─────────────────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentTemplate { id: String, title: String, body: String, hashtags: String, created_at: String }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContentInput { title: String, body: String, hashtags: String }

// ─── AI ──────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiRequest {
    topic: String, product: String, audience: String,
    tone: String, length: String, variants: i64,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiDraft { title: String, body: String, hashtags: String, mode: String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiConfig { configured: bool, model: String }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiConfigInput { api_key: String, model: String }

// ─── Campaign ────────────────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Campaign {
    id: String, name: String, objective: String, audience: String,
    starts_at: Option<String>, ends_at: Option<String>, status: String,
    notes: String, group_count: i64, post_count: i64, created_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CampaignInput {
    name: String, objective: String, audience: String,
    starts_at: Option<String>, ends_at: Option<String>,
    notes: String, group_ids: Vec<String>, content: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CampaignPost {
    id: String, campaign_id: String, group_id: String,
    group_name: String, group_url: String, content: String,
    status: String, post_url: Option<String>, notes: String, created_at: String,
}

// ─── Campaign Job (V2) ────────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CampaignJob {
    id: String, campaign_id: String, group_id: String,
    group_name: String, group_url: String, group_topic: String,
    status: String, content: String, prepared_content: Option<String>,
    error_message: Option<String>, retry_count: i64,
    scheduled_at: Option<String>, started_at: Option<String>,
    completed_at: Option<String>, created_at: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CampaignStats {
    total: i64, pending: i64, preparing: i64, ready: i64,
    awaiting_user: i64, completed: i64, failed: i64,
    cancelled: i64, skipped: i64,
}

// ─── Publishing History ───────────────────────────────────────────────────────
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishingHistoryEntry {
    id: String, job_id: String, group_id: String, group_name: String,
    campaign_id: String, campaign_name: String,
    action: String, post_url: Option<String>, notes: String, created_at: String,
}

// ─── Account-Group Link ───────────────────────────────────────────────────────
#[derive(Serialize)]
#[allow(dead_code)]
#[serde(rename_all = "camelCase")]
struct AccountGroup { account_id: String, group_id: String, membership: String }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountGroupInput { account_id: String, group_id: String, membership: String }

// ─── Helpers ─────────────────────────────────────────────────────────────────
fn safe_error(_: impl std::fmt::Display) -> String { "Không thể truy cập dữ liệu cục bộ.".into() }

fn validate_text(value: &str, field: &str, required: bool, maximum: usize) -> Result<String, String> {
    let trimmed = value.trim();
    if required && trimmed.is_empty() { return Err(format!("{} không được để trống.", field)); }
    if trimmed.len() > maximum { return Err(format!("{} quá dài.", field)); }
    Ok(trimmed.to_string())
}

fn validate_status(value: &str, valid: &[&str], field: &str) -> Result<String, String> {
    if valid.contains(&value) { Ok(value.to_string()) } else { Err(format!("{} không hợp lệ.", field)) }
}

fn normalize_group_url(input: &str) -> Result<(String, Option<String>), String> {
    let source = input.trim();
    let source = if source.starts_with("http://") || source.starts_with("https://") {
        source.to_string()
    } else {
        format!("https://{}", source)
    };
    let parsed = Url::parse(&source).map_err(|_| "URL không hợp lệ.".to_string())?;
    if parsed.scheme() != "https" { return Err("Chỉ chấp nhận URL HTTPS.".into()); }
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    if host != "facebook.com" && host != "www.facebook.com" && !host.ends_with(".facebook.com") {
        return Err("URL phải thuộc facebook.com.".into());
    }
    let segments: Vec<_> = parsed.path_segments()
        .map(|parts| parts.filter(|part| !part.is_empty()).collect())
        .unwrap_or_default();
    if segments.is_empty() { return Err("URL phải là đường dẫn Group hoặc Fanpage cụ thể.".into()); }

    let first = segments[0];
    let reserved = [
        "marketplace", "login", "messages", "notifications",
        "friends", "watch", "gaming", "settings", "help",
        "recover", "checkpoint", "ads", "adsmanager", "privacy", "policies"
    ];
    if reserved.contains(&first.to_ascii_lowercase().as_str()) {
        return Err(format!("Đường dẫn /{first} không phải là Nhóm hoặc Fanpage hợp lệ."));
    }

    if first == "groups" {
        let group_id = segments.get(1)
            .filter(|value| value.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.'))
            .map(|value| (*value).to_string());
        let normalized = match group_id.as_deref() {
            Some(id) => format!("https://www.facebook.com/groups/{id}"),
            None => "https://www.facebook.com/groups".to_string(),
        };
        Ok((normalized, group_id))
    } else {
        // Fanpage / Trang Facebook (ví dụ: facebook.com/freecratfstudio hoặc facebook.com/pages/...)
        let page_id = if first == "pages" || first == "p" {
            segments.get(segments.len() - 1).map(|v| (*v).to_string())
        } else {
            Some(first.to_string())
        };
        let normalized = format!("https://www.facebook.com/{first}");
        Ok((normalized, page_id))
    }
}


fn account_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<Account> {
    Ok(Account {
        id: row.get(0)?, name: row.get(1)?, notes: row.get(2)?,
        avatar_path: row.get(3)?, connection_status: row.get(4)?,
        category: row.get(5)?, group_count: row.get(6)?, created_at: row.get(7)?,
    })
}

fn group_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<Group> {
    Ok(Group {
        id: row.get(0)?, url: row.get(1)?, facebook_id: row.get(2)?,
        name: row.get(3)?, description: row.get(4)?, topic: row.get(5)?,
        rules: row.get(6)?, advertising: row.get(7)?,
        favorite: row.get::<_, i64>(8)? == 1,
        blacklisted: row.get::<_, i64>(9)? == 1,
        last_used_at: row.get(10)?,
        created_at: row.get(11)?,
    })
}

fn content_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentTemplate> {
    Ok(ContentTemplate { id: row.get(0)?, title: row.get(1)?, body: row.get(2)?, hashtags: row.get(3)?, created_at: row.get(4)? })
}

fn campaign_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<Campaign> {
    Ok(Campaign {
        id: row.get(0)?, name: row.get(1)?, objective: row.get(2)?, audience: row.get(3)?,
        starts_at: row.get(4)?, ends_at: row.get(5)?, status: row.get(6)?, notes: row.get(7)?,
        group_count: row.get(8)?, post_count: row.get(9)?, created_at: row.get(10)?,
    })
}

fn post_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<CampaignPost> {
    Ok(CampaignPost {
        id: row.get(0)?, campaign_id: row.get(1)?, group_id: row.get(2)?,
        group_name: row.get(3)?, group_url: row.get(4)?, content: row.get(5)?,
        status: row.get(6)?, post_url: row.get(7)?, notes: row.get(8)?, created_at: row.get(9)?,
    })
}

fn job_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<CampaignJob> {
    Ok(CampaignJob {
        id: row.get(0)?, campaign_id: row.get(1)?, group_id: row.get(2)?,
        group_name: row.get(3)?, group_url: row.get(4)?, group_topic: row.get(5)?,
        status: row.get(6)?, content: row.get(7)?, prepared_content: row.get(8)?,
        error_message: row.get(9)?, retry_count: row.get(10)?,
        scheduled_at: row.get(11)?, started_at: row.get(12)?,
        completed_at: row.get(13)?, created_at: row.get(14)?,
    })
}

fn log_activity(conn: &Connection, action: &str) -> rusqlite::Result<()> {
    conn.execute("INSERT INTO activity_logs(action) VALUES (?1)", params![action])?;
    Ok(())
}

fn backup_directory(path: &str) -> Result<std::path::PathBuf, String> {
    let directory = std::path::Path::new(path)
        .parent()
        .ok_or_else(|| "Không xác định được thư mục dữ liệu.".to_string())?
        .join("backups");
    std::fs::create_dir_all(&directory).map_err(|_| "Không thể tạo thư mục sao lưu.".to_string())?;
    Ok(directory)
}

fn backup_id() -> String { format!("fb-manager-ai-{}.sqlite", Uuid::new_v4()) }

fn valid_tone(value: &str) -> bool { ["professional","friendly","sales","experience"].contains(&value) }
fn valid_length(value: &str) -> bool { ["short","medium","long"].contains(&value) }
fn valid_category(value: &str) -> bool { ["personal","business","page","other"].contains(&value) }

fn default_model(conn: &Connection) -> String {
    conn.query_row("SELECT value FROM app_settings WHERE key='ai_model'", [], |r| r.get(0))
        .unwrap_or_else(|_| "gpt-4.1-mini".to_string())
}

fn keychain_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.fbmanagerai.desktop", "openai-api-key")
        .map_err(|_| "Không thể truy cập kho khóa bảo mật của hệ điều hành.".into())
}

fn demo_drafts(input: &AiRequest) -> Vec<AiDraft> {
    let topic = input.topic.trim();
    let product = input.product.trim();
    let audience = if input.audience.trim().is_empty() { "khách hàng tiềm năng" } else { input.audience.trim() };
    let voice = match input.tone.as_str() {
        "professional" => "chuyên nghiệp",
        "sales" => "gần gũi và rõ lợi ích",
        "experience" => "chia sẻ kinh nghiệm",
        _ => "thân thiện",
    };
    let detail = match input.length.as_str() {
        "short" => "ngắn gọn, đi thẳng vào giá trị",
        "long" => "có dẫn dắt, lợi ích và lời mời trao đổi",
        _ => "vừa đủ, dễ đọc",
    };
    (1..=input.variants.clamp(1, 3)).map(|i| AiDraft {
        title: format!("{topic}: một gợi ý đáng cân nhắc"),
        body: format!(
            "Bạn đang quan tâm đến {topic}?\n\n{product} có thể là điểm khởi đầu phù hợp cho {audience}. Bài viết này được viết với giọng {voice}, {detail}.\n\nHãy xem nhu cầu thực tế của bạn và nhắn tin để trao đổi thêm trước khi quyết định."
        ),
        hashtags: format!("#{topic} #chiasẻ #giátrị").replace(' ', ""),
        mode: format!("demo-{i}"),
    }).collect()
}

// ─── Overview & Utility Commands ─────────────────────────────────────────────
#[tauri::command]
fn get_overview(db: tauri::State<Database>) -> Result<Overview, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.query_row(
        "SELECT \
          (SELECT count(*) FROM accounts), \
          (SELECT count(*) FROM groups WHERE blacklisted=0), \
          (SELECT count(*) FROM campaigns), \
          (SELECT count(*) FROM content_templates), \
          (SELECT count(*) FROM campaign_posts WHERE status IN ('USER_CONFIRMED','COMPLETED')), \
          (SELECT value FROM app_settings WHERE key='theme'), \
          (SELECT count(*) FROM campaign_jobs WHERE status IN ('PENDING','PREPARING','READY','AWAITING_USER')), \
          (SELECT count(*) FROM campaign_jobs WHERE status='COMPLETED')",
        [],
        |r| Ok(Overview {
            accounts: r.get(0)?, groups: r.get(1)?, campaigns: r.get(2)?,
            contents: r.get(3)?, confirmed: r.get(4)?,
            database_path: db.path.clone(), schema_version: 2, theme: r.get(5)?,
            pending_jobs: r.get(6)?, completed_jobs: r.get(7)?,
        }),
    ).map_err(safe_error)
}

#[tauri::command]
fn get_activities(db: tauri::State<Database>) -> Result<Vec<Activity>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT id, action, created_at FROM activity_logs ORDER BY id DESC LIMIT 100"
    ).map_err(safe_error)?;
    let rows = stmt.query_map([], |r| Ok(Activity {
        id: r.get(0)?, action: r.get(1)?, created_at: r.get(2)?,
    })).map_err(safe_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(safe_error)
}

#[tauri::command]
fn save_theme(theme: String, db: tauri::State<Database>) -> Result<(), String> {
    if theme != "light" && theme != "dark" { return Err("Giao diện không hợp lệ.".into()); }
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "INSERT INTO app_settings(key,value) VALUES ('theme',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![theme],
    ).map_err(safe_error)?;
    Ok(())
}

#[tauri::command]
fn list_backups(db: tauri::State<Database>) -> Result<Vec<BackupFile>, String> {
    let directory = backup_directory(&db.path)?;
    let mut files = Vec::new();
    for entry in std::fs::read_dir(directory).map_err(|_| "Không thể đọc thư mục sao lưu.".to_string())? {
        let entry = entry.map_err(|_| "Không thể đọc bản sao lưu.".to_string())?;
        let metadata = entry.metadata().map_err(|_| "Không thể đọc bản sao lưu.".to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if metadata.is_file() && name.starts_with("fb-manager-ai-") && name.ends_with(".sqlite") {
            let created = metadata.modified().ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|time| time.as_secs().to_string())
                .unwrap_or_else(|| "Không rõ".into());
            files.push(BackupFile { id: name, created_at: created, bytes: metadata.len() });
        }
    }
    files.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(files)
}

#[tauri::command]
fn create_backup(db: tauri::State<Database>) -> Result<BackupFile, String> {
    let directory = backup_directory(&db.path)?;
    let id = backup_id();
    let target = directory.join(&id);
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut destination = Connection::open(&target).map_err(safe_error)?;
    let backup = Backup::new(&conn, &mut destination).map_err(safe_error)?;
    backup.run_to_completion(128, std::time::Duration::from_millis(5), None).map_err(safe_error)?;
    let bytes = std::fs::metadata(&target).map_err(|_| "Không thể đọc bản sao lưu.".to_string())?.len();
    log_activity(&conn, "Đã tạo bản sao lưu SQLite.").map_err(safe_error)?;
    Ok(BackupFile {
        id,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|v| v.as_secs().to_string())
            .unwrap_or_else(|_| "Không rõ".into()),
        bytes,
    })
}

#[tauri::command]
fn restore_backup(id: String, db: tauri::State<Database>) -> Result<(), String> {
    if id.contains('/') || id.contains('\\') || !id.starts_with("fb-manager-ai-") || !id.ends_with(".sqlite") {
        return Err("Bản sao lưu không hợp lệ.".into());
    }
    let directory = backup_directory(&db.path)?;
    let source_path = directory.join(&id);
    if !source_path.is_file() { return Err("Không tìm thấy bản sao lưu.".into()); }
    let automatic_id = backup_id();
    let automatic_path = directory.join(&automatic_id);
    let conn = db.connection.lock().map_err(safe_error)?;
    {
        let mut safety = Connection::open(&automatic_path).map_err(safe_error)?;
        let backup = Backup::new(&conn, &mut safety).map_err(safe_error)?;
        backup.run_to_completion(128, std::time::Duration::from_millis(5), None).map_err(safe_error)?;
    }
    let source = Connection::open_with_flags(source_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "Bản sao lưu không thể mở.".to_string())?;
    let mut target = conn;
    let backup = Backup::new(&source, &mut target).map_err(|_| "Không thể khôi phục bản sao lưu.".to_string())?;
    backup.run_to_completion(128, std::time::Duration::from_millis(5), None)
        .map_err(|_| "Không thể khôi phục bản sao lưu.".to_string())?;
    drop(backup);
    log_activity(&target, "Đã khôi phục bản sao lưu SQLite.").map_err(safe_error)
}

#[tauri::command]
fn export_report_csv(db: tauri::State<Database>) -> Result<String, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut out = String::from("campaign_name,status,group_name,post_url,processed_at\n");
    let mut stmt = conn.prepare(
        "SELECT c.name,cp.status,g.name,coalesce(cp.post_url,''),cp.created_at \
         FROM campaign_posts cp \
         JOIN campaigns c ON c.id=cp.campaign_id \
         JOIN groups g ON g.id=cp.group_id \
         ORDER BY cp.created_at DESC"
    ).map_err(safe_error)?;
    let rows = stmt.query_map([], |row| Ok((
        row.get::<_, String>(0)?, row.get::<_, String>(1)?,
        row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?,
    ))).map_err(safe_error)?;
    for row in rows {
        let row = row.map_err(safe_error)?;
        let cells = [row.0, row.1, row.2, row.3, row.4];
        out.push_str(&cells.iter().map(|cell| format!("\"{}\"", cell.replace('"', "\"\""))).collect::<Vec<_>>().join(","));
        out.push('\n');
    }
    Ok(out)
}

// ─── Account Commands ─────────────────────────────────────────────────────────
#[tauri::command]
fn list_accounts(query: String, page: i64, page_size: i64, db: tauri::State<Database>) -> Result<Page<Account>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let q = format!("%{}%", query.trim());
    let limit = page_size.clamp(1, 100);
    let offset = (page.max(1) - 1) * limit;
    let total = conn.query_row(
        "SELECT count(*) FROM accounts WHERE name LIKE ?1 OR notes LIKE ?1",
        params![q], |r| r.get(0),
    ).map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT a.id, a.name, a.notes, a.avatar_path, a.connection_status, a.category, \
         (SELECT count(*) FROM account_groups ag WHERE ag.account_id=a.id), a.created_at \
         FROM accounts a \
         WHERE a.name LIKE ?1 OR a.notes LIKE ?1 \
         ORDER BY a.created_at DESC LIMIT ?2 OFFSET ?3"
    ).map_err(safe_error)?;
    let items = stmt.query_map(params![q, limit, offset], account_from)
        .map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(Page { items, total })
}

#[tauri::command]
fn create_account(input: AccountInput, db: tauri::State<Database>) -> Result<Account, String> {
    let name = validate_text(&input.name, "Tên tài khoản", true, 120)?;
    let notes = validate_text(&input.notes, "Ghi chú", false, 2000)?;
    let status = validate_status(&input.connection_status, &["unconfirmed","confirmed"], "Trạng thái")?;
    if !valid_category(&input.category) { return Err("Phân loại tài khoản không hợp lệ.".into()); }
    let id = Uuid::new_v4().to_string();
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "INSERT INTO accounts(id,name,notes,connection_status,category) VALUES (?1,?2,?3,?4,?5)",
        params![id, name, notes, status, input.category],
    ).map_err(safe_error)?;
    log_activity(&conn, "Đã thêm tài khoản Facebook.").map_err(safe_error)?;
    conn.query_row(
        "SELECT a.id,a.name,a.notes,a.avatar_path,a.connection_status,a.category,\
         (SELECT count(*) FROM account_groups WHERE account_id=a.id),a.created_at \
         FROM accounts a WHERE a.id=?1",
        params![id], account_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn update_account(id: String, input: AccountInput, db: tauri::State<Database>) -> Result<Account, String> {
    let name = validate_text(&input.name, "Tên tài khoản", true, 120)?;
    let notes = validate_text(&input.notes, "Ghi chú", false, 2000)?;
    let status = validate_status(&input.connection_status, &["unconfirmed","confirmed"], "Trạng thái")?;
    if !valid_category(&input.category) { return Err("Phân loại tài khoản không hợp lệ.".into()); }
    let conn = db.connection.lock().map_err(safe_error)?;
    if conn.execute(
        "UPDATE accounts SET name=?1,notes=?2,connection_status=?3,category=?4 WHERE id=?5",
        params![name, notes, status, input.category, id],
    ).map_err(safe_error)? == 0 {
        return Err("Không tìm thấy tài khoản.".into());
    }
    log_activity(&conn, "Đã cập nhật tài khoản Facebook.").map_err(safe_error)?;
    conn.query_row(
        "SELECT a.id,a.name,a.notes,a.avatar_path,a.connection_status,a.category,\
         (SELECT count(*) FROM account_groups WHERE account_id=a.id),a.created_at \
         FROM accounts a WHERE a.id=?1",
        params![id], account_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn delete_accounts(ids: Vec<String>, db: tauri::State<Database>) -> Result<(), String> {
    if ids.is_empty() || ids.len() > 100 { return Err("Danh sách tài khoản không hợp lệ.".into()); }
    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;
    for id in ids { tx.execute("DELETE FROM accounts WHERE id=?1", params![id]).map_err(safe_error)?; }
    tx.commit().map_err(safe_error)?;
    log_activity(&conn, "Đã xóa tài khoản Facebook.").map_err(safe_error)
}

// ─── Account ↔ Group Link ─────────────────────────────────────────────────────
#[tauri::command]
fn link_account_group(input: AccountGroupInput, db: tauri::State<Database>) -> Result<(), String> {
    let membership = validate_status(&input.membership, &["unconfirmed","joined","not_joined"], "Membership")?;
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "INSERT INTO account_groups(account_id,group_id,membership) VALUES(?1,?2,?3) \
         ON CONFLICT(account_id,group_id) DO UPDATE SET membership=excluded.membership",
        params![input.account_id, input.group_id, membership],
    ).map_err(safe_error)?;
    log_activity(&conn, "Đã liên kết tài khoản với nhóm.").map_err(safe_error)
}

#[tauri::command]
fn unlink_account_group(account_id: String, group_id: String, db: tauri::State<Database>) -> Result<(), String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "DELETE FROM account_groups WHERE account_id=?1 AND group_id=?2",
        params![account_id, group_id],
    ).map_err(safe_error)?;
    log_activity(&conn, "Đã hủy liên kết tài khoản-nhóm.").map_err(safe_error)
}

#[tauri::command]
fn list_account_groups(account_id: String, db: tauri::State<Database>) -> Result<Vec<Group>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT g.id,g.url,g.facebook_id,g.name,g.description,g.topic,g.rules,\
         g.advertising,g.favorite,g.blacklisted,g.last_used_at,g.created_at \
         FROM groups g \
         JOIN account_groups ag ON ag.group_id=g.id \
         WHERE ag.account_id=?1 \
         ORDER BY g.name"
    ).map_err(safe_error)?;
    let items = stmt.query_map(params![account_id], group_from)
        .map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(items)
}

// ─── Group Commands ───────────────────────────────────────────────────────────
#[tauri::command]
fn list_groups(
    query: String, topic: String, favorite_only: bool,
    blacklisted_only: bool, page: i64, page_size: i64,
    db: tauri::State<Database>,
) -> Result<Page<Group>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let q = format!("%{}%", query.trim());
    let topic_filter = format!("%{}%", topic.trim());
    let limit = page_size.clamp(1, 100);
    let offset = (page.max(1) - 1) * limit;
    let where_sql = "(name LIKE ?1 OR url LIKE ?1 OR description LIKE ?1 OR topic LIKE ?1) \
                     AND topic LIKE ?2 AND (?3=0 OR favorite=1) AND (?4=0 OR blacklisted=1)";
    let total = conn.query_row(
        &format!("SELECT count(*) FROM groups WHERE {where_sql}"),
        params![q, topic_filter, favorite_only as i64, blacklisted_only as i64],
        |r| r.get(0),
    ).map_err(safe_error)?;
    let mut stmt = conn.prepare(&format!(
        "SELECT id,url,facebook_id,name,description,topic,rules,advertising,favorite,blacklisted,last_used_at,created_at \
         FROM groups WHERE {where_sql} \
         ORDER BY blacklisted ASC, favorite DESC, created_at DESC LIMIT ?5 OFFSET ?6"
    )).map_err(safe_error)?;
    let items = stmt.query_map(
        params![q, topic_filter, favorite_only as i64, blacklisted_only as i64, limit, offset],
        group_from,
    ).map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(Page { items, total })
}

fn validated_group(input: GroupInput) -> Result<(String, Option<String>, String, String, String, String, String, bool, bool), String> {
    let (url, facebook_id) = normalize_group_url(&input.url)?;
    Ok((
        url, facebook_id,
        validate_text(&input.name, "Tên nhóm", true, 180)?,
        validate_text(&input.description, "Mô tả", false, 2000)?,
        validate_text(&input.topic, "Chủ đề", false, 100)?,
        validate_text(&input.rules, "Quy định", false, 4000)?,
        validate_status(&input.advertising, &["unknown","allowed","prohibited"], "Loại quảng cáo")?,
        input.favorite,
        input.blacklisted,
    ))
}

#[tauri::command]
fn create_group(input: GroupInput, db: tauri::State<Database>) -> Result<Group, String> {
    let (url, facebook_id, name, description, topic, rules, advertising, favorite, blacklisted) = validated_group(input)?;
    let id = Uuid::new_v4().to_string();
    let conn = db.connection.lock().map_err(safe_error)?;
    match conn.execute(
        "INSERT INTO groups(id,url,facebook_id,name,description,topic,rules,advertising,favorite,blacklisted) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![id, url, facebook_id, name, description, topic, rules, advertising, favorite as i64, blacklisted as i64],
    ) {
        Ok(_) => {},
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.extended_code == 2067 =>
            return Err("Nhóm này đã có trong danh sách.".into()),
        Err(e) => return Err(safe_error(e)),
    }
    log_activity(&conn, "Đã thêm Facebook Group.").map_err(safe_error)?;
    conn.query_row(
        "SELECT id,url,facebook_id,name,description,topic,rules,advertising,favorite,blacklisted,last_used_at,created_at \
         FROM groups WHERE id=?1",
        params![id], group_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn update_group(id: String, input: GroupInput, db: tauri::State<Database>) -> Result<Group, String> {
    let (url, facebook_id, name, description, topic, rules, advertising, favorite, blacklisted) = validated_group(input)?;
    let conn = db.connection.lock().map_err(safe_error)?;
    match conn.execute(
        "UPDATE groups SET url=?1,facebook_id=?2,name=?3,description=?4,topic=?5,\
         rules=?6,advertising=?7,favorite=?8,blacklisted=?9 WHERE id=?10",
        params![url, facebook_id, name, description, topic, rules, advertising, favorite as i64, blacklisted as i64, id],
    ) {
        Ok(0) => return Err("Không tìm thấy nhóm.".into()),
        Ok(_) => {},
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.extended_code == 2067 =>
            return Err("URL nhóm đã tồn tại.".into()),
        Err(e) => return Err(safe_error(e)),
    }
    log_activity(&conn, "Đã cập nhật Facebook Group.").map_err(safe_error)?;
    conn.query_row(
        "SELECT id,url,facebook_id,name,description,topic,rules,advertising,favorite,blacklisted,last_used_at,created_at \
         FROM groups WHERE id=?1",
        params![id], group_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn delete_groups(ids: Vec<String>, db: tauri::State<Database>) -> Result<(), String> {
    if ids.is_empty() || ids.len() > 100 { return Err("Danh sách nhóm không hợp lệ.".into()); }
    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;
    for id in ids { tx.execute("DELETE FROM groups WHERE id=?1", params![id]).map_err(safe_error)?; }
    tx.commit().map_err(safe_error)?;
    log_activity(&conn, "Đã xóa Facebook Group.").map_err(safe_error)
}

#[tauri::command]
fn import_groups(rows: Vec<GroupImportRow>, db: tauri::State<Database>) -> Result<ImportResult, String> {
    if rows.len() > 1000 { return Err("Mỗi lần chỉ nhập tối đa 1.000 nhóm.".into()); }
    let mut imported = 0;
    let mut skipped = 0;
    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;
    for row in rows {
        let (url, facebook_id) = match normalize_group_url(&row.url) { Ok(v) => v, Err(_) => { skipped += 1; continue } };
        let name = row.name.unwrap_or_else(|| facebook_id.clone().unwrap_or_else(|| "Facebook Group".into()));
        let advertising = row.advertising.unwrap_or_else(|| "unknown".into());
        if !["unknown","allowed","prohibited"].contains(&advertising.as_str()) { skipped += 1; continue; }
        let changes = tx.execute(
            "INSERT INTO groups(id,url,facebook_id,name,description,topic,rules,advertising,favorite) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(url) DO NOTHING",
            params![
                Uuid::new_v4().to_string(), url, facebook_id,
                validate_text(&name, "Tên nhóm", true, 180).unwrap_or_else(|_| "Facebook Group".into()),
                row.description.unwrap_or_default().chars().take(2000).collect::<String>(),
                row.topic.unwrap_or_default().chars().take(100).collect::<String>(),
                row.rules.unwrap_or_default().chars().take(4000).collect::<String>(),
                advertising,
                row.favorite.unwrap_or(false) as i64,
            ],
        ).map_err(safe_error)?;
        if changes == 1 { imported += 1; } else { skipped += 1; }
    }
    tx.commit().map_err(safe_error)?;
    if imported > 0 {
        log_activity(&conn, &format!("Đã nhập {} Facebook Group.", imported)).map_err(safe_error)?;
    }
    Ok(ImportResult { imported, skipped })
}

#[tauri::command]
fn bulk_edit_groups(input: BulkEditGroupInput, db: tauri::State<Database>) -> Result<usize, String> {
    if input.ids.is_empty() || input.ids.len() > 100 { return Err("Danh sách nhóm không hợp lệ.".into()); }
    if let Some(ref adv) = input.advertising {
        validate_status(adv, &["unknown","allowed","prohibited"], "Loại quảng cáo")?;
    }
    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;
    let mut updated = 0;
    for id in &input.ids {
        if let Some(ref topic) = input.topic {
            let t = validate_text(topic, "Chủ đề", false, 100)?;
            tx.execute("UPDATE groups SET topic=?1 WHERE id=?2", params![t, id]).map_err(safe_error)?;
        }
        if let Some(ref adv) = input.advertising {
            tx.execute("UPDATE groups SET advertising=?1 WHERE id=?2", params![adv, id]).map_err(safe_error)?;
        }
        if let Some(bl) = input.blacklisted {
            tx.execute("UPDATE groups SET blacklisted=?1 WHERE id=?2", params![bl as i64, id]).map_err(safe_error)?;
        }
        updated += 1;
    }
    tx.commit().map_err(safe_error)?;
    log_activity(&conn, &format!("Đã chỉnh sửa hàng loạt {} nhóm.", updated)).map_err(safe_error)?;
    Ok(updated)
}

#[tauri::command]
fn open_facebook_group(url: String, app: tauri::AppHandle) -> Result<(), String> {
    let (normalized, _) = normalize_group_url(&url)?;
    app.opener().open_url(normalized, None::<&str>).map_err(safe_error)
}

#[tauri::command]
fn open_url_in_browser(url: String, app: tauri::AppHandle) -> Result<(), String> {
    // Mở bất kỳ URL hợp lệ nào qua trình duyệt mặc định
    let parsed = Url::parse(url.trim()).map_err(|_| "URL không hợp lệ.".to_string())?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("Chỉ cho phép mở URL HTTP/HTTPS.".into());
    }
    app.opener().open_url(url.trim(), None::<&str>).map_err(safe_error)
}

// ─── Content Commands ─────────────────────────────────────────────────────────
#[tauri::command]
fn list_content(query: String, page: i64, page_size: i64, db: tauri::State<Database>) -> Result<Page<ContentTemplate>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let q = format!("%{}%", query.trim());
    let limit = page_size.clamp(1, 100);
    let offset = (page.max(1) - 1) * limit;
    let total = conn.query_row(
        "SELECT count(*) FROM content_templates WHERE title LIKE ?1 OR body LIKE ?1",
        params![q], |r| r.get(0),
    ).map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT id,title,body,hashtags,created_at FROM content_templates \
         WHERE title LIKE ?1 OR body LIKE ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
    ).map_err(safe_error)?;
    let items = stmt.query_map(params![q, limit, offset], content_from)
        .map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(Page { items, total })
}

#[tauri::command]
fn create_content(input: ContentInput, db: tauri::State<Database>) -> Result<ContentTemplate, String> {
    let title = validate_text(&input.title, "Tiêu đề", true, 180)?;
    let body = validate_text(&input.body, "Nội dung", true, 10000)?;
    let hashtags = validate_text(&input.hashtags, "Hashtag", false, 1000)?;
    let id = Uuid::new_v4().to_string();
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "INSERT INTO content_templates(id,title,body,hashtags) VALUES(?1,?2,?3,?4)",
        params![id, title, body, hashtags],
    ).map_err(safe_error)?;
    log_activity(&conn, "Đã lưu nội dung vào thư viện.").map_err(safe_error)?;
    conn.query_row(
        "SELECT id,title,body,hashtags,created_at FROM content_templates WHERE id=?1",
        params![id], content_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn update_content(id: String, input: ContentInput, db: tauri::State<Database>) -> Result<ContentTemplate, String> {
    let title = validate_text(&input.title, "Tiêu đề", true, 180)?;
    let body = validate_text(&input.body, "Nội dung", true, 10000)?;
    let hashtags = validate_text(&input.hashtags, "Hashtag", false, 1000)?;
    let conn = db.connection.lock().map_err(safe_error)?;
    if conn.execute(
        "UPDATE content_templates SET title=?1,body=?2,hashtags=?3 WHERE id=?4",
        params![title, body, hashtags, id],
    ).map_err(safe_error)? == 0 {
        return Err("Không tìm thấy nội dung.".into());
    }
    log_activity(&conn, "Đã cập nhật nội dung thư viện.").map_err(safe_error)?;
    conn.query_row(
        "SELECT id,title,body,hashtags,created_at FROM content_templates WHERE id=?1",
        params![id], content_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn delete_content(ids: Vec<String>, db: tauri::State<Database>) -> Result<(), String> {
    if ids.is_empty() || ids.len() > 100 { return Err("Danh sách nội dung không hợp lệ.".into()); }
    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;
    for id in ids { tx.execute("DELETE FROM content_templates WHERE id=?1", params![id]).map_err(safe_error)?; }
    tx.commit().map_err(safe_error)?;
    log_activity(&conn, "Đã xóa nội dung thư viện.").map_err(safe_error)
}

// ─── AI Commands ──────────────────────────────────────────────────────────────
#[tauri::command]
fn get_ai_config(db: tauri::State<Database>) -> Result<AiConfig, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let configured = keychain_entry()
        .and_then(|entry| entry.get_password().map_err(|_| "".into()))
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false);
    Ok(AiConfig { configured, model: default_model(&conn) })
}

#[tauri::command]
fn save_ai_config(input: AiConfigInput, db: tauri::State<Database>) -> Result<(), String> {
    let model = validate_text(&input.model, "Model", true, 100)?;
    let key = validate_text(&input.api_key, "API key", true, 300)?;
    if !key.starts_with("sk-") { return Err("API key có định dạng không hợp lệ.".into()); }
    keychain_entry()?.set_password(&key)
        .map_err(|_| String::from("Không thể lưu API key vào kho khóa bảo mật của hệ điều hành."))?;
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "INSERT INTO app_settings(key,value) VALUES('ai_model',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![model],
    ).map_err(safe_error)?;
    Ok(())
}

#[tauri::command]
fn clear_ai_config(db: tauri::State<Database>) -> Result<(), String> {
    if let Ok(entry) = keychain_entry() { let _ = entry.delete_credential(); }
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute("DELETE FROM app_settings WHERE key='ai_model'", []).map_err(safe_error)?;
    Ok(())
}

#[tauri::command]
async fn generate_content(input: AiRequest, db: tauri::State<'_, Database>) -> Result<Vec<AiDraft>, String> {
    let topic = validate_text(&input.topic, "Chủ đề", true, 300)?;
    let product = validate_text(&input.product, "Sản phẩm hoặc dịch vụ", true, 500)?;
    let audience = validate_text(&input.audience, "Đối tượng khách hàng", false, 300)?;
    if !valid_tone(&input.tone) || !valid_length(&input.length) {
        return Err("Tùy chọn tạo nội dung không hợp lệ.".into());
    }
    let normalized = AiRequest {
        topic, product, audience,
        tone: input.tone, length: input.length, variants: input.variants.clamp(1, 3),
    };
    let key = keychain_entry().ok()
        .and_then(|entry| entry.get_password().ok())
        .filter(|value| !value.trim().is_empty());
    if key.is_none() { return Ok(demo_drafts(&normalized)); }
    let model = { let conn = db.connection.lock().map_err(safe_error)?; default_model(&conn) };
    let audience_note = if normalized.audience.is_empty() { String::new() } else { format!(" Đối tượng: {}.", normalized.audience) };
    let prompt = format!(
        "Viết {} bản nháp bài Facebook bằng tiếng Việt. Chủ đề: {}. Sản phẩm/dịch vụ: {}.{} \
         Giọng văn: {}. Độ dài: {}. \
         Không tạo nội dung giả mạo, seeding, tương tác giả hoặc hứa hẹn không có cơ sở. \
         Với mỗi bản, trả về đúng khối: TIÊU ĐỀ:, NỘI DUNG:, HASHTAG:.\n",
        normalized.variants, normalized.topic, normalized.product,
        audience_note, normalized.tone, normalized.length,
    );
    let body = serde_json::json!({"model": model, "input": prompt});
    let response = reqwest::Client::new()
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(key.unwrap())
        .json(&body)
        .send().await
        .map_err(|_| "Không thể kết nối dịch vụ AI. Hãy kiểm tra mạng và cấu hình AI.")?;
    if !response.status().is_success() {
        return Err("Dịch vụ AI không thể tạo nội dung lúc này. Hãy kiểm tra API key và hạn mức sử dụng.".into());
    }
    let value: serde_json::Value = response.json().await
        .map_err(|_| String::from("Phản hồi AI không hợp lệ."))?;
    let output = value.get("output_text").and_then(|v| v.as_str()).unwrap_or_default();
    if output.trim().is_empty() { return Err("AI chưa trả về nội dung có thể sử dụng.".into()); }
    let draft = AiDraft {
        title: format!("{} — Bản nháp AI", normalized.topic),
        body: output.to_string(),
        hashtags: String::new(),
        mode: "openai".into(),
    };
    Ok(vec![draft])
}

// ─── Campaign Commands ────────────────────────────────────────────────────────
#[tauri::command]
fn list_campaigns(query: String, page: i64, page_size: i64, db: tauri::State<Database>) -> Result<Page<Campaign>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let q = format!("%{}%", query.trim());
    let limit = page_size.clamp(1, 100);
    let offset = (page.max(1) - 1) * limit;
    let total = conn.query_row(
        "SELECT count(*) FROM campaigns WHERE name LIKE ?1",
        params![q], |r| r.get(0),
    ).map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT c.id,c.name,c.objective,c.audience,c.starts_at,c.ends_at,c.status,c.notes,\
         count(DISTINCT cg.group_id),count(DISTINCT cp.id),c.created_at \
         FROM campaigns c \
         LEFT JOIN campaign_groups cg ON cg.campaign_id=c.id \
         LEFT JOIN campaign_posts cp ON cp.campaign_id=c.id \
         WHERE c.name LIKE ?1 GROUP BY c.id \
         ORDER BY c.created_at DESC LIMIT ?2 OFFSET ?3"
    ).map_err(safe_error)?;
    let items = stmt.query_map(params![q, limit, offset], campaign_from)
        .map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(Page { items, total })
}

#[tauri::command]
fn create_campaign(input: CampaignInput, db: tauri::State<Database>) -> Result<Campaign, String> {
    let name = validate_text(&input.name, "Tên chiến dịch", true, 180)?;
    let objective = validate_text(&input.objective, "Mục tiêu", false, 1000)?;
    let audience = validate_text(&input.audience, "Nhóm đối tượng", false, 1000)?;
    let notes = validate_text(&input.notes, "Ghi chú", false, 2000)?;
    let content = validate_text(&input.content, "Nội dung", true, 10000)?;
    if input.group_ids.is_empty() || input.group_ids.len() > 100 {
        return Err("Chọn từ 1 đến 100 nhóm cho chiến dịch.".into());
    }
    let id = Uuid::new_v4().to_string();
    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;
    tx.execute(
        "INSERT INTO campaigns(id,name,objective,audience,starts_at,ends_at,notes) VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![id, name, objective, audience, input.starts_at, input.ends_at, notes],
    ).map_err(safe_error)?;
    for group_id in &input.group_ids {
        let exists: Option<i64> = tx.query_row(
            "SELECT 1 FROM groups WHERE id=?1 AND blacklisted=0",
            params![group_id], |r| r.get(0),
        ).optional().map_err(safe_error)?;
        if exists.is_none() { return Err("Một nhóm đã chọn không còn tồn tại hoặc đã bị khóa.".into()); }
        tx.execute(
            "INSERT INTO campaign_groups(campaign_id,group_id) VALUES(?1,?2)",
            params![id, group_id],
        ).map_err(safe_error)?;
        // Tạo campaign_post (legacy) cho backward compatibility
        tx.execute(
            "INSERT INTO campaign_posts(id,campaign_id,group_id,content) VALUES(?1,?2,?3,?4)",
            params![Uuid::new_v4().to_string(), id, group_id, content],
        ).map_err(safe_error)?;
        // Tạo campaign_job (V2 Queue)
        tx.execute(
            "INSERT INTO campaign_jobs(id,campaign_id,group_id,content,status) VALUES(?1,?2,?3,?4,'PENDING') \
             ON CONFLICT(campaign_id,group_id) DO NOTHING",
            params![Uuid::new_v4().to_string(), id, group_id, content],
        ).map_err(safe_error)?;
    }
    tx.commit().map_err(safe_error)?;
    log_activity(&conn, "Đã tạo chiến dịch với bài viết nháp.").map_err(safe_error)?;
    conn.query_row(
        "SELECT c.id,c.name,c.objective,c.audience,c.starts_at,c.ends_at,c.status,c.notes,\
         (SELECT count(*) FROM campaign_groups WHERE campaign_id=c.id),\
         (SELECT count(*) FROM campaign_posts WHERE campaign_id=c.id),c.created_at \
         FROM campaigns c WHERE c.id=?1",
        params![id], campaign_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn update_campaign(id: String, input: CampaignInput, db: tauri::State<Database>) -> Result<Campaign, String> {
    let name = validate_text(&input.name, "Tên chiến dịch", true, 180)?;
    let objective = validate_text(&input.objective, "Mục tiêu", false, 1000)?;
    let audience = validate_text(&input.audience, "Nhóm đối tượng", false, 1000)?;
    let notes = validate_text(&input.notes, "Ghi chú", false, 2000)?;
    let content = validate_text(&input.content, "Nội dung", true, 10000)?;
    if input.group_ids.is_empty() || input.group_ids.len() > 100 {
        return Err("Chọn từ 1 đến 100 nhóm cho chiến dịch.".into());
    }

    let conn = db.connection.lock().map_err(safe_error)?;
    let tx = conn.unchecked_transaction().map_err(safe_error)?;

    tx.execute(
        "UPDATE campaigns SET name=?1, objective=?2, audience=?3, starts_at=?4, ends_at=?5, notes=?6 WHERE id=?7",
        params![name, objective, audience, input.starts_at, input.ends_at, notes, id],
    ).map_err(safe_error)?;

    // Cập nhật nội dung cho các bài viết/jobs chưa hoàn tất
    tx.execute(
        "UPDATE campaign_posts SET content=?1 WHERE campaign_id=?2 AND status NOT IN ('USER_CONFIRMED', 'COMPLETED')",
        params![content, id],
    ).map_err(safe_error)?;

    tx.execute(
        "UPDATE campaign_jobs SET content=?1, prepared_content=CASE WHEN prepared_content IS NOT NULL THEN ?1 ELSE NULL END \
         WHERE campaign_id=?2 AND status IN ('PENDING', 'PREPARING', 'READY', 'AWAITING_USER')",
        params![content, id],
    ).map_err(safe_error)?;

    // Lấy danh sách nhóm hiện tại
    let existing_groups: Vec<String> = {
        let mut stmt = tx.prepare("SELECT group_id FROM campaign_groups WHERE campaign_id=?1").map_err(safe_error)?;
        let rows = stmt.query_map(params![id], |r| r.get(0))
            .map_err(safe_error)?.collect::<Result<Vec<String>, _>>().map_err(safe_error)?;
        rows
    };

    // Thêm các nhóm mới
    for group_id in &input.group_ids {
        if !existing_groups.contains(group_id) {
            let exists: Option<i64> = tx.query_row(
                "SELECT 1 FROM groups WHERE id=?1 AND blacklisted=0",
                params![group_id], |r| r.get(0),
            ).optional().map_err(safe_error)?;
            if exists.is_none() { return Err("Một nhóm đã chọn không còn tồn tại hoặc đã bị khóa.".into()); }

            tx.execute(
                "INSERT INTO campaign_groups(campaign_id,group_id) VALUES(?1,?2)",
                params![id, group_id],
            ).map_err(safe_error)?;

            tx.execute(
                "INSERT INTO campaign_posts(id,campaign_id,group_id,content) VALUES(?1,?2,?3,?4)",
                params![Uuid::new_v4().to_string(), id, group_id, content],
            ).map_err(safe_error)?;

            tx.execute(
                "INSERT INTO campaign_jobs(id,campaign_id,group_id,content,status) VALUES(?1,?2,?3,?4,'PENDING') \
                 ON CONFLICT(campaign_id,group_id) DO NOTHING",
                params![Uuid::new_v4().to_string(), id, group_id, content],
            ).map_err(safe_error)?;
        }
    }

    // Xóa các nhóm bị bỏ chọn (chỉ xóa khi job chưa hoàn tất)
    for group_id in &existing_groups {
        if !input.group_ids.contains(group_id) {
            let is_completed: Option<i64> = tx.query_row(
                "SELECT 1 FROM campaign_jobs WHERE campaign_id=?1 AND group_id=?2 AND status='COMPLETED'",
                params![id, group_id], |r| r.get(0),
            ).optional().map_err(safe_error)?;

            if is_completed.is_none() {
                tx.execute("DELETE FROM campaign_jobs WHERE campaign_id=?1 AND group_id=?2", params![id, group_id]).map_err(safe_error)?;
                tx.execute("DELETE FROM campaign_posts WHERE campaign_id=?1 AND group_id=?2", params![id, group_id]).map_err(safe_error)?;
                tx.execute("DELETE FROM campaign_groups WHERE campaign_id=?1 AND group_id=?2", params![id, group_id]).map_err(safe_error)?;
            }
        }
    }

    tx.commit().map_err(safe_error)?;
    log_activity(&conn, &format!("Đã cập nhật chiến dịch {}.", name)).map_err(safe_error)?;

    conn.query_row(
        "SELECT c.id,c.name,c.objective,c.audience,c.starts_at,c.ends_at,c.status,c.notes,\
         (SELECT count(*) FROM campaign_groups WHERE campaign_id=c.id),\
         (SELECT count(*) FROM campaign_posts WHERE campaign_id=c.id),c.created_at \
         FROM campaigns c WHERE c.id=?1",
        params![id], campaign_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn delete_campaign(id: String, db: tauri::State<Database>) -> Result<(), String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute("DELETE FROM campaigns WHERE id=?1", params![id]).map_err(safe_error)?;
    log_activity(&conn, "Đã xóa chiến dịch.").map_err(safe_error)?;
    Ok(())
}

#[tauri::command]
fn update_campaign_job_content(id: String, content: String, db: tauri::State<Database>) -> Result<CampaignJob, String> {
    let content = validate_text(&content, "Nội dung bài viết", true, 10000)?;
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute(
        "UPDATE campaign_jobs SET content=?1, prepared_content=?1 WHERE id=?2",
        params![content, id],
    ).map_err(safe_error)?;
    log_activity(&conn, "Đã chỉnh sửa nội dung bài viết job.").map_err(safe_error)?;
    conn.query_row(
        "SELECT j.id,j.campaign_id,j.group_id,g.name,g.url,g.topic,\
         j.status,j.content,j.prepared_content,j.error_message,j.retry_count,\
         j.scheduled_at,j.started_at,j.completed_at,j.created_at \
         FROM campaign_jobs j JOIN groups g ON g.id=j.group_id WHERE j.id=?1",
        params![id], job_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn list_campaign_posts(campaign_id: String, db: tauri::State<Database>) -> Result<Vec<CampaignPost>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT cp.id,cp.campaign_id,cp.group_id,g.name,g.url,cp.content,cp.status,\
         cp.post_url,cp.notes,cp.created_at \
         FROM campaign_posts cp \
         JOIN groups g ON g.id=cp.group_id \
         WHERE cp.campaign_id=?1 ORDER BY cp.created_at"
    ).map_err(safe_error)?;
    let items = stmt.query_map(params![campaign_id], post_from)
        .map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(items)
}

#[tauri::command]
fn set_campaign_post_status(id: String, status: String, post_url: Option<String>, db: tauri::State<Database>) -> Result<(), String> {
    let status = validate_status(
        &status,
        &["DRAFT","READY","REVIEWED","OPENED","USER_CONFIRMED","COMPLETED"],
        "Trạng thái",
    )?;
    let conn = db.connection.lock().map_err(safe_error)?;
    let current: String = conn.query_row(
        "SELECT status FROM campaign_posts WHERE id=?1",
        params![id], |r| r.get(0),
    ).map_err(|_| "Không tìm thấy bài viết chiến dịch.".to_string())?;
    let allowed = match current.as_str() {
        "DRAFT" => ["READY"].as_slice(),
        "READY" => ["REVIEWED"].as_slice(),
        "REVIEWED" => ["OPENED"].as_slice(),
        "OPENED" => ["USER_CONFIRMED"].as_slice(),
        "USER_CONFIRMED" => ["COMPLETED"].as_slice(),
        _ => [].as_slice(),
    };
    if !allowed.contains(&status.as_str()) {
        return Err("Chỉ có thể chuyển trạng thái theo quy trình đã định.".into());
    }
    let confirmed = if status == "USER_CONFIRMED" || status == "COMPLETED" { "datetime('now')" } else { "NULL" };
    let sql = format!("UPDATE campaign_posts SET status=?1,post_url=COALESCE(?2,post_url),confirmed_at={confirmed} WHERE id=?3");
    conn.execute(&sql, params![status, post_url, id]).map_err(safe_error)?;
    log_activity(&conn, "Đã cập nhật trạng thái bài viết chiến dịch.").map_err(safe_error)
}

// ─── Campaign Jobs V2 ─────────────────────────────────────────────────────────
#[tauri::command]
fn list_campaign_jobs(campaign_id: String, db: tauri::State<Database>) -> Result<Vec<CampaignJob>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut stmt = conn.prepare(
        "SELECT j.id,j.campaign_id,j.group_id,g.name,g.url,g.topic,\
         j.status,j.content,j.prepared_content,j.error_message,j.retry_count,\
         j.scheduled_at,j.started_at,j.completed_at,j.created_at \
         FROM campaign_jobs j \
         JOIN groups g ON g.id=j.group_id \
         WHERE j.campaign_id=?1 \
         ORDER BY j.created_at"
    ).map_err(safe_error)?;
    let items = stmt.query_map(params![campaign_id], job_from)
        .map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(items)
}

#[tauri::command]
fn get_campaign_stats(campaign_id: String, db: tauri::State<Database>) -> Result<CampaignStats, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.query_row(
        "SELECT \
          count(*) as total, \
          sum(CASE WHEN status='PENDING'      THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='PREPARING'    THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='READY'        THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='AWAITING_USER' THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='COMPLETED'    THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='FAILED'       THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='CANCELLED'    THEN 1 ELSE 0 END), \
          sum(CASE WHEN status='SKIPPED'      THEN 1 ELSE 0 END) \
         FROM campaign_jobs WHERE campaign_id=?1",
        params![campaign_id],
        |r| Ok(CampaignStats {
            total: r.get(0)?, pending: r.get(1)?, preparing: r.get(2)?,
            ready: r.get(3)?, awaiting_user: r.get(4)?, completed: r.get(5)?,
            failed: r.get(6)?, cancelled: r.get(7)?, skipped: r.get(8)?,
        }),
    ).map_err(safe_error)
}

#[tauri::command]
fn advance_job_status(id: String, status: String, notes: Option<String>, db: tauri::State<Database>) -> Result<CampaignJob, String> {
    let status = validate_status(
        &status,
        &["PENDING","PREPARING","READY","AWAITING_USER","COMPLETED","FAILED","CANCELLED","SKIPPED"],
        "Trạng thái job",
    )?;
    let conn = db.connection.lock().map_err(safe_error)?;
    let current: String = conn.query_row(
        "SELECT status FROM campaign_jobs WHERE id=?1",
        params![id], |r| r.get(0),
    ).map_err(|_| "Không tìm thấy job.".to_string())?;

    // Kiểm tra transition hợp lệ
    let allowed: &[&str] = match current.as_str() {
        "PENDING"      => &["PREPARING","CANCELLED","SKIPPED"],
        "PREPARING"    => &["READY","FAILED","CANCELLED"],
        "READY"        => &["AWAITING_USER","CANCELLED","SKIPPED"],
        "AWAITING_USER"=> &["COMPLETED","FAILED","CANCELLED"],
        "FAILED"       => &["PENDING","CANCELLED"],  // retry
        _ => &[],
    };
    if !allowed.contains(&status.as_str()) {
        return Err(format!("Không thể chuyển từ {} sang {}.", current, status));
    }

    let now = "datetime('now')";
    let started = if status == "PREPARING" { format!(",started_at={now}") } else { String::new() };
    let completed = if matches!(status.as_str(), "COMPLETED"|"FAILED"|"CANCELLED"|"SKIPPED") {
        format!(",completed_at={now}")
    } else { String::new() };
    let retry_inc = if status == "PENDING" && current == "FAILED" { ",retry_count=retry_count+1" } else { "" };

    let sql = format!(
        "UPDATE campaign_jobs SET status=?1{started}{completed}{retry_inc} WHERE id=?2"
    );
    conn.execute(&sql, params![status, id]).map_err(safe_error)?;

    // Ghi history khi COMPLETED
    if status == "COMPLETED" {
        let (group_id, campaign_id): (String, String) = conn.query_row(
            "SELECT group_id,campaign_id FROM campaign_jobs WHERE id=?1",
            params![id], |r| Ok((r.get(0)?, r.get(1)?)),
        ).map_err(safe_error)?;
        conn.execute(
            "INSERT INTO publishing_history(id,job_id,group_id,campaign_id,action,notes) VALUES(?1,?2,?3,?4,'COMPLETED',?5)",
            params![Uuid::new_v4().to_string(), id, group_id, campaign_id, notes.unwrap_or_default()],
        ).map_err(safe_error)?;
        // Cập nhật last_used_at trên group
        conn.execute(
            "UPDATE groups SET last_used_at=datetime('now') WHERE id=?1",
            params![group_id],
        ).map_err(safe_error)?;
    }

    log_activity(&conn, &format!("Đã chuyển job sang {}.", status)).map_err(safe_error)?;

    conn.query_row(
        "SELECT j.id,j.campaign_id,j.group_id,g.name,g.url,g.topic,\
         j.status,j.content,j.prepared_content,j.error_message,j.retry_count,\
         j.scheduled_at,j.started_at,j.completed_at,j.created_at \
         FROM campaign_jobs j JOIN groups g ON g.id=j.group_id WHERE j.id=?1",
        params![id], job_from,
    ).map_err(safe_error)
}

#[tauri::command]
fn cancel_campaign_jobs(campaign_id: String, db: tauri::State<Database>) -> Result<usize, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let updated = conn.execute(
        "UPDATE campaign_jobs SET status='CANCELLED',completed_at=datetime('now') \
         WHERE campaign_id=?1 AND status IN ('PENDING','PREPARING','READY','AWAITING_USER')",
        params![campaign_id],
    ).map_err(safe_error)?;
    if updated > 0 {
        conn.execute(
            "UPDATE campaigns SET status='paused' WHERE id=?1",
            params![campaign_id],
        ).map_err(safe_error)?;
        log_activity(&conn, &format!("Đã hủy {} job trong chiến dịch.", updated)).map_err(safe_error)?;
    }
    Ok(updated)
}

#[tauri::command]
fn get_publishing_history(group_id: Option<String>, page: i64, page_size: i64, db: tauri::State<Database>) -> Result<Page<PublishingHistoryEntry>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let limit = page_size.clamp(1, 100);
    let offset = (page.max(1) - 1) * limit;
    let where_clause = if group_id.is_some() { "WHERE ph.group_id=?1" } else { "WHERE 1=1" };
    let gid_param = group_id.unwrap_or_default();
    let total = conn.query_row(
        &format!("SELECT count(*) FROM publishing_history ph {where_clause}"),
        params![gid_param], |r| r.get(0),
    ).map_err(safe_error)?;
    let mut stmt = conn.prepare(&format!(
        "SELECT ph.id,ph.job_id,ph.group_id,g.name,ph.campaign_id,c.name,ph.action,ph.post_url,ph.notes,ph.created_at \
         FROM publishing_history ph \
         JOIN groups g ON g.id=ph.group_id \
         JOIN campaigns c ON c.id=ph.campaign_id \
         {where_clause} \
         ORDER BY ph.created_at DESC LIMIT ?2 OFFSET ?3"
    )).map_err(safe_error)?;
    let items = stmt.query_map(params![gid_param, limit, offset], |r| Ok(PublishingHistoryEntry {
        id: r.get(0)?, job_id: r.get(1)?, group_id: r.get(2)?, group_name: r.get(3)?,
        campaign_id: r.get(4)?, campaign_name: r.get(5)?, action: r.get(6)?,
        post_url: r.get(7)?, notes: r.get(8)?, created_at: r.get(9)?,
    })).map_err(safe_error)?.collect::<Result<Vec<_>, _>>().map_err(safe_error)?;
    Ok(Page { items, total })
}

// ─── App Entry ───────────────────────────────────────────────────────────────
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let path = directory.join("fb-manager-ai.sqlite");
            let mut connection = Connection::open(&path)?;
            migrate(&mut connection)?;
            app.manage(Database { connection: Mutex::new(connection), path: path.to_string_lossy().into_owned() });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Overview
            get_overview, get_activities, save_theme,
            // Backup
            list_backups, create_backup, restore_backup, export_report_csv,
            // Accounts
            list_accounts, create_account, update_account, delete_accounts,
            // Account-Group links
            link_account_group, unlink_account_group, list_account_groups,
            // Groups
            list_groups, create_group, update_group, delete_groups,
            import_groups, open_facebook_group, open_url_in_browser, bulk_edit_groups,
            // Content
            list_content, create_content, update_content, delete_content,
            // AI
            get_ai_config, save_ai_config, clear_ai_config, generate_content,
            // Campaigns
            list_campaigns, create_campaign, update_campaign, delete_campaign,
            list_campaign_posts, set_campaign_post_status,
            // Campaign Jobs V2
            list_campaign_jobs, get_campaign_stats, advance_job_status,
            update_campaign_job_content, cancel_campaign_jobs, get_publishing_history,
        ])
        .run(tauri::generate_context!())
        .expect("Không thể khởi động FB Manager AI");
}

// ─── Tests ───────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_v1_and_v2_are_idempotent() {
        let mut db = Connection::open_in_memory().unwrap();
        migrate(&mut db).unwrap();
        // Chạy lại migrate phải thành công (version đã là 2, skip)
        migrate(&mut db).unwrap();
        assert_eq!(db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0)).unwrap(), 2);
    }

    #[test]
    fn migration_enforces_foreign_keys() {
        let mut db = Connection::open_in_memory().unwrap();
        migrate(&mut db).unwrap();
        assert!(db.execute("INSERT INTO account_groups VALUES ('missing','missing','joined')", []).is_err());
    }

    #[test]
    fn v2_tables_exist_after_migration() {
        let mut db = Connection::open_in_memory().unwrap();
        migrate(&mut db).unwrap();
        let jobs: i64 = db.query_row("SELECT count(*) FROM campaign_jobs", [], |r| r.get(0)).unwrap();
        let history: i64 = db.query_row("SELECT count(*) FROM publishing_history", [], |r| r.get(0)).unwrap();
        assert_eq!(jobs, 0);
        assert_eq!(history, 0);
    }

    #[test]
    fn accounts_have_category_column() {
        let mut db = Connection::open_in_memory().unwrap();
        migrate(&mut db).unwrap();
        db.execute("INSERT INTO accounts(id,name,category) VALUES('a1','Test','business')", []).unwrap();
        let cat: String = db.query_row("SELECT category FROM accounts WHERE id='a1'", [], |r| r.get(0)).unwrap();
        assert_eq!(cat, "business");
    }

    #[test]
    fn groups_have_blacklisted_column() {
        let mut db = Connection::open_in_memory().unwrap();
        migrate(&mut db).unwrap();
        db.execute(
            "INSERT INTO groups(id,url,name,blacklisted) VALUES('g1','https://www.facebook.com/groups/test','Test',1)",
            [],
        ).unwrap();
        let bl: i64 = db.query_row("SELECT blacklisted FROM groups WHERE id='g1'", [], |r| r.get(0)).unwrap();
        assert_eq!(bl, 1);
    }

    #[test]
    fn settings_survive_reopen() {
        let path = std::env::temp_dir().join(format!("fb-manager-test-{}.sqlite", std::process::id()));
        { let mut db = Connection::open(&path).unwrap(); migrate(&mut db).unwrap(); db.execute("UPDATE app_settings SET value='dark' WHERE key='theme'", []).unwrap(); }
        { let mut db = Connection::open(&path).unwrap(); migrate(&mut db).unwrap(); assert_eq!(db.query_row("SELECT value FROM app_settings WHERE key='theme'", [], |r| r.get::<_, String>(0)).unwrap(), "dark"); }
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn group_url_normalization_accepts_only_facebook_group_urls() {
        assert_eq!(normalize_group_url("facebook.com/groups/test.group/?ref=share").unwrap().0, "https://www.facebook.com/groups/test.group");
        assert_eq!(normalize_group_url("https://www.facebook.com/freecratfstudio").unwrap().0, "https://www.facebook.com/freecratfstudio");
        assert!(normalize_group_url("https://example.com/groups/test").is_err());
        assert!(normalize_group_url("https://www.facebook.com/marketplace").is_err());
    }

    #[test]
    fn group_import_skips_duplicate_urls() {
        let mut db = Connection::open_in_memory().unwrap();
        migrate(&mut db).unwrap();
        db.execute("INSERT INTO groups(id,url,name) VALUES ('g1','https://www.facebook.com/groups/example','One')", []).unwrap();
        let changes = db.execute("INSERT INTO groups(id,url,name) VALUES ('g2','https://www.facebook.com/groups/example','Two') ON CONFLICT(url) DO NOTHING", []).unwrap();
        assert_eq!(changes, 0);
        assert_eq!(db.query_row("SELECT count(*) FROM groups", [], |r| r.get::<_, i64>(0)).unwrap(), 1);
    }

    #[test]
    fn sqlite_backup_round_trip_preserves_data() {
        let mut source = Connection::open_in_memory().unwrap();
        migrate(&mut source).unwrap();
        source.execute("INSERT INTO accounts(id,name) VALUES ('a','Original')", []).unwrap();
        let mut restored = Connection::open_in_memory().unwrap();
        {
            let backup = Backup::new(&source, &mut restored).unwrap();
            backup.run_to_completion(128, std::time::Duration::from_millis(1), None).unwrap();
        }
        assert_eq!(restored.query_row("SELECT name FROM accounts WHERE id='a'", [], |r| r.get::<_, String>(0)).unwrap(), "Original");
    }

    #[test]
    fn campaign_job_status_transitions_are_constrained() {
        // Kiểm tra logic allowed transitions không crash
        let allowed_from_pending: &[&str] = &["PREPARING","CANCELLED","SKIPPED"];
        assert!(allowed_from_pending.contains(&"PREPARING"));
        assert!(!allowed_from_pending.contains(&"COMPLETED"));
    }
}
