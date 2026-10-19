use rusqlite::{Connection, params};
use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;
struct Database { connection: Mutex<Connection>, path: String }
fn migrate(connection: &mut Connection) -> rusqlite::Result<()> {
    connection.pragma_update(None, "foreign_keys", "ON")?;
    connection.busy_timeout(std::time::Duration::from_secs(5))?;
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > 1 { return Err(rusqlite::Error::InvalidQuery); }
    if version == 0 {
        let tx = connection.transaction()?;
        tx.execute_batch(include_str!("../migrations/001_initial.sql"))?;
        tx.pragma_update(None, "user_version", 1)?;
        tx.commit()?;
    }
    Ok(())
}
#[derive(Serialize)]
struct Overview { accounts: i64, groups: i64, campaigns: i64, contents: i64, confirmed: i64, database_path: String, schema_version: i64, theme: String }
#[derive(Serialize)]
struct Activity { id: i64, action: String, created_at: String }
fn safe_error(_: impl std::fmt::Display) -> String { "Không thể truy cập dữ liệu cục bộ.".into() }
#[tauri::command]
fn get_overview(db: tauri::State<Database>) -> Result<Overview, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.query_row("SELECT (SELECT count(*) FROM accounts), (SELECT count(*) FROM groups), (SELECT count(*) FROM campaigns), (SELECT count(*) FROM content_templates), (SELECT count(*) FROM campaign_posts WHERE status IN ('USER_CONFIRMED','COMPLETED')), (SELECT value FROM app_settings WHERE key='theme')", [], |r| Ok(Overview { accounts: r.get(0)?, groups: r.get(1)?, campaigns: r.get(2)?, contents: r.get(3)?, confirmed: r.get(4)?, database_path: db.path.clone(), schema_version: 1, theme: r.get(5)? })).map_err(safe_error)
}
#[tauri::command]
fn get_activities(db: tauri::State<Database>) -> Result<Vec<Activity>, String> {
    let conn = db.connection.lock().map_err(safe_error)?;
    let mut stmt = conn.prepare("SELECT id, action, created_at FROM activity_logs ORDER BY id DESC LIMIT 50").map_err(safe_error)?;
    let rows = stmt.query_map([], |r| Ok(Activity { id: r.get(0)?, action: r.get(1)?, created_at: r.get(2)? })).map_err(safe_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(safe_error)
}
#[tauri::command]
fn save_theme(theme: String, db: tauri::State<Database>) -> Result<(), String> {
    if theme != "light" && theme != "dark" { return Err("Giao diện không hợp lệ.".into()); }
    let conn = db.connection.lock().map_err(safe_error)?;
    conn.execute("INSERT INTO app_settings(key,value) VALUES ('theme',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![theme]).map_err(safe_error)?;
    Ok(())
}
pub fn run() {
    tauri::Builder::default().setup(|app| {
        let directory = app.path().app_data_dir()?;
        std::fs::create_dir_all(&directory)?;
        let path = directory.join("fb-manager-ai.sqlite");
        let mut connection = Connection::open(&path)?;
        migrate(&mut connection)?;
        app.manage(Database { connection: Mutex::new(connection), path: path.to_string_lossy().into_owned() });
        Ok(())
    }).invoke_handler(tauri::generate_handler![get_overview, get_activities, save_theme])
    .run(tauri::generate_context!()).expect("Không thể khởi động FB Manager AI");
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migration_is_repeatable_and_enforces_foreign_keys() {
        let mut db = Connection::open_in_memory().unwrap(); migrate(&mut db).unwrap(); migrate(&mut db).unwrap();
        assert_eq!(db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0)).unwrap(), 1);
        assert!(db.execute("INSERT INTO account_groups VALUES ('missing','missing','joined')", []).is_err());
    }
    #[test]
    fn settings_survive_reopen() {
        let path = std::env::temp_dir().join(format!("fb-manager-test-{}.sqlite", std::process::id()));
        { let mut db = Connection::open(&path).unwrap(); migrate(&mut db).unwrap(); db.execute("UPDATE app_settings SET value='dark' WHERE key='theme'", []).unwrap(); }
        { let mut db = Connection::open(&path).unwrap(); migrate(&mut db).unwrap(); assert_eq!(db.query_row("SELECT value FROM app_settings WHERE key='theme'", [], |r| r.get::<_, String>(0)).unwrap(), "dark"); }
        std::fs::remove_file(path).unwrap();
    }
}
