use rusqlite::{params, Connection};

use crate::db::{DbResult, WorkspaceData};

pub struct WorkspaceRepository;

impl WorkspaceRepository {
    pub fn save(conn: &Connection, workspace: &WorkspaceData) -> DbResult<()> {
        conn.execute(
            r#"
            INSERT INTO workspaces (
                name,
                nodes_json,
                edges_json,
                dialect,
                plan,
                created_at,
                updated_at
            )
            VALUES (
                ?1,
                ?2,
                ?3,
                ?4,
                ?5,
                strftime('%s','now'),
                strftime('%s','now')
            )
            ON CONFLICT(name)
            DO UPDATE SET
                nodes_json = excluded.nodes_json,
                edges_json = excluded.edges_json,
                dialect = excluded.dialect,
                plan = excluded.plan,
                updated_at = strftime('%s','now')
            "#,
            params![
                workspace.name,
                workspace.nodes_json,
                workspace.edges_json,
                workspace.dialect,
                workspace.plan,
            ],
        )?;

        Ok(())
    }

    pub fn get(conn: &Connection, name: &str) -> DbResult<Option<WorkspaceData>> {
        let mut stmt = conn.prepare(
            r#"
            SELECT
                name,
                nodes_json,
                edges_json,
                dialect,
                plan
            FROM workspaces
            WHERE name = ?1
            "#,
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

    pub fn list(conn: &Connection) -> DbResult<Vec<String>> {
        let mut stmt = conn.prepare("SELECT name FROM workspaces ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| row.get(0))?;

        let mut workspaces = Vec::new();
        for row in rows {
            workspaces.push(row?);
        }

        Ok(workspaces)
    }

    pub fn delete(conn: &Connection, name: &str) -> DbResult<()> {
        conn.execute("DELETE FROM workspaces WHERE name = ?1", params![name])?;
        Ok(())
    }

    pub fn rename(conn: &Connection, old_name: &str, new_name: &str) -> DbResult<()> {
        conn.execute("UPDATE workspaces SET name = ?1 WHERE name = ?2", params![new_name, old_name])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn workspace_round_trip_works() {
        let mut temp = PathBuf::from(std::env::temp_dir());
        temp.push(format!("novadb-test-{}-{}.sqlite", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let conn = Connection::open(&temp).unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (name TEXT PRIMARY KEY, nodes_json TEXT NOT NULL, edges_json TEXT NOT NULL, dialect TEXT NOT NULL, plan TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);"
        ).unwrap();

        let workspace = WorkspaceData {
            name: "demo".into(),
            nodes_json: "[]".into(),
            edges_json: "[]".into(),
            dialect: "Postgres".into(),
            plan: "goliaf".into(),
        };

        WorkspaceRepository::save(&conn, &workspace).unwrap();
        let loaded = WorkspaceRepository::get(&conn, "demo").unwrap().unwrap();

        assert_eq!(loaded.name, "demo");
        assert_eq!(loaded.plan, "goliaf");

        let _ = fs::remove_file(temp);
    }
}