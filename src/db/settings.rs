use rusqlite::{params, Connection};

use crate::db::DbResult;

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn get(conn: &Connection, key: &str) -> DbResult<Option<String>> {
        let mut stmt =
            conn.prepare("SELECT value FROM settings WHERE key = ?1")?;

        let mut rows = stmt.query(params![key])?;

        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }

        Ok(None)
    }

    pub fn set(
        conn: &Connection,
        key: &str,
        value: &str,
    ) -> DbResult<()> {
        conn.execute(
            r#"
            INSERT INTO settings(key, value)

            VALUES(?1, ?2)

            ON CONFLICT(key)

            DO UPDATE SET

            value = excluded.value
            "#,
            params![key, value],
        )?;

        Ok(())
    }

    pub fn remove(
        conn: &Connection,
        key: &str,
    ) -> DbResult<()> {
        conn.execute(
            "DELETE FROM settings WHERE key = ?1",
            params![key],
        )?;

        Ok(())
    }

    pub fn list(conn: &Connection) -> DbResult<Vec<(String, String)>> {
        let mut stmt =
            conn.prepare("SELECT key, value FROM settings")?;

        let rows = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;

        let mut settings = Vec::new();

        for row in rows {
            settings.push(row?);
        }

        Ok(settings)
    }
}