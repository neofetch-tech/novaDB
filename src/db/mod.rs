use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub mod connection;
pub mod errors;
pub mod models;
pub mod settings;
pub mod workspace;

pub use connection::*;
pub use errors::*;
pub use models::*;
pub use settings::*;
pub use workspace::*;

fn database_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("novadb");
    path.push("novadb.sqlite");
    path
}

pub fn init_db() -> DbResult<Connection> {
    let db_path = database_path();
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(&db_path)?;
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            nodes_json TEXT NOT NULL,
            edges_json TEXT NOT NULL,
            dialect TEXT NOT NULL,
            plan TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )?;

    Ok(conn)
}

pub fn save_workspace(conn: &Connection, data: &WorkspaceData) -> DbResult<()> {
    conn.execute(
        r#"
        INSERT INTO workspaces (name, nodes_json, edges_json, dialect, plan, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, strftime('%s','now'), strftime('%s','now'))
        ON CONFLICT(name) DO UPDATE SET
            nodes_json = excluded.nodes_json,
            edges_json = excluded.edges_json,
            dialect = excluded.dialect,
            plan = excluded.plan,
            updated_at = strftime('%s','now')
        "#,
        params![data.name, data.nodes_json, data.edges_json, data.dialect, data.plan],
    )?;
    Ok(())
}

pub fn load_workspace(conn: &Connection, name: &str) -> DbResult<Option<WorkspaceData>> {
    let mut stmt = conn.prepare(
        "SELECT name, nodes_json, edges_json, dialect, plan FROM workspaces WHERE name = ?1",
    )?;
    let mut rows = stmt.query(params![name])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(WorkspaceData {
            name: row.get(0)?,
            nodes_json: row.get(1)?,
            edges_json: row.get(2)?,
            dialect: row.get(3)?,
            plan: row.get(4)?,
        }));
    }
    Ok(None)
}

pub fn list_workspaces(conn: &Connection) -> DbResult<Vec<String>> {
    let mut stmt = conn.prepare("SELECT name FROM workspaces ORDER BY updated_at DESC")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut workspaces = Vec::new();
    for row in rows {
        workspaces.push(row?);
    }
    Ok(workspaces)
}

pub fn delete_workspace(conn: &Connection, name: &str) -> DbResult<()> {
    conn.execute("DELETE FROM workspaces WHERE name = ?1", params![name])?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> DbResult<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(row.get(0)?));
    }
    Ok(None)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> DbResult<()> {
    conn.execute(
        r#"
        INSERT INTO settings(key, value)
        VALUES(?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
        params![key, value],
    )?;
    Ok(())
}