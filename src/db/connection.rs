use std::fs;
use std::path::PathBuf;

use rusqlite::Connection;

use crate::db::{DbResult};

fn database_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("novadb");
    path.push("novadb.sqlite");
    path
}

pub fn open_database() -> DbResult<Connection> {
    let db_path = database_path();

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(db_path)?;

    migrate(&conn)?;

    Ok(conn)
}

fn migrate(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
        );

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
        "#
    )?;

    Ok(())
}