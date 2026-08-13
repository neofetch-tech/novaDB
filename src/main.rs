#![windows_subsystem = "windows"]

mod db;
mod db_old;

use db::{DbState, WorkspaceData};
use novadb_core::{
    diff_schemas as core_diff_schemas, generate_ddl as core_generate_ddl, generate_fake_rows,
    Schema, SqlDialect, Table,
};
use serde_json::json;
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
fn generate_ddl(schema: Schema, dialect: SqlDialect) -> String {
    core_generate_ddl(&schema, dialect)
}

#[tauri::command]
fn generate_fake_data(table: Table, count: usize) -> Vec<serde_json::Value> {
    generate_fake_rows(&table, count.min(100_000))
        .into_iter()
        .map(|row| {
            serde_json::Value::Object(
                row.0
                    .into_iter()
                    .map(|(key, value)| (key, serde_json::Value::String(value)))
                    .collect(),
            )
        })
        .collect()
}

#[tauri::command]
fn diff_schemas(current: Schema, target: Schema, dialect: SqlDialect) -> Vec<String> {
    core_diff_schemas(&current, &target, dialect).statements
}

#[tauri::command]
async fn build_sql(prompt: String, schema: Schema) -> Result<String, String> {
    if let Ok(result) = gemini_sql(prompt.clone(), schema.clone()).await {
        return Ok(result);
    }
    let ddl = core_generate_ddl(&schema, SqlDialect::Postgres);
    let instruction = format!(
        "You are a PostgreSQL assistant. Return only SQL, no markdown.\nSchema:\n{ddl}\n\nRequest: {prompt}"
    );
    let response = reqwest::Client::new()
        .post("http://127.0.0.1:11434/api/generate")
        .timeout(std::time::Duration::from_secs(20))
        .json(&json!({
            "model": "qwen2.5-coder:7b",
            "prompt": instruction,
            "stream": false,
            "options": { "temperature": 0.1 }
        }))
        .send()
        .await
        .map_err(|_| {
            "AI unavailable. Set GEMINI_API_KEY or run `ollama serve` with qwen2.5-coder:7b."
                .to_string()
        })?;
    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    payload
        .get("response")
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .ok_or_else(|| "Ollama returned an empty response.".to_string())
}

#[tauri::command]
async fn gemini_sql(prompt: String, schema: Schema) -> Result<String, String> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set. Add it to your environment.".to_string())?;
    let ddl = core_generate_ddl(&schema, SqlDialect::Postgres);
    let body = json!({
        "contents": [{
            "parts": [{
                "text": format!(
                    "You are a PostgreSQL SQL assistant. Return ONLY raw SQL, no markdown fences, no explanation.\n\nSchema DDL:\n{ddl}\n\nUser request: {prompt}"
                )
            }]
        }],
        "generationConfig": { "temperature": 0.15, "maxOutputTokens": 2048 }
    });
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    );
    let response = reqwest::Client::new()
        .post(&url)
        .timeout(std::time::Duration::from_secs(30))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;
    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error: {err}"));
    }
    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let text = payload["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("Gemini returned empty response")?
        .trim()
        .trim_start_matches("```sql")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .to_string();
    Ok(text)
}

#[tauri::command]
async fn gemini_tip(schema: Schema, context: String) -> Result<String, String> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set.".to_string())?;
    let ddl = core_generate_ddl(&schema, SqlDialect::Postgres);
    let body = json!({
        "contents": [{
            "parts": [{
                "text": format!(
                    "You are a friendly database design assistant. Give ONE short helpful tip (max 2 sentences) about this schema. Be practical.\n\nSchema:\n{ddl}\n\nContext: {context}"
                )
            }]
        }],
        "generationConfig": { "temperature": 0.7, "maxOutputTokens": 256 }
    });
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    );
    let response = reqwest::Client::new()
        .post(&url)
        .timeout(std::time::Duration::from_secs(15))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;
    if !response.status().is_success() {
        return Err("Gemini API unavailable".to_string());
    }
    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(payload["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("Consider adding indexes on foreign key columns for faster joins.")
        .to_string())
}

#[tauri::command]
fn open_in_vscode(sql: String, filename: String) -> Result<String, String> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("novadb")
        .join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_name = filename
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>();
    let path = dir.join(format!("{safe_name}.sql"));
    std::fs::write(&path, &sql).map_err(|e| e.to_string())?;
    let path_str = path.to_string_lossy().to_string();
    let opened = Command::new("code")
        .arg(&path_str)
        .spawn()
        .map(|_| ())
        .or_else(|_| {
            Command::new("cmd")
                .args(["/C", "code", &path_str])
                .spawn()
                .map(|_| ())
        });
    match opened {
        Ok(()) => Ok(path_str),
        Err(_) => Ok(path_str),
    }
}

#[tauri::command]
fn save_workspace(state: State<DbState>, data: WorkspaceData) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::save_workspace(&conn, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_workspace(state: State<DbState>, name: String) -> Result<Option<WorkspaceData>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::load_workspace(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_workspaces(state: State<DbState>) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_workspaces(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_workspace_cmd(state: State<DbState>, name: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_workspace(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

fn main() {
    let conn = db::init_db().expect("Failed to initialize SQLite database");
    tauri::Builder::default()
        .manage(DbState {
            conn: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            generate_ddl,
            generate_fake_data,
            diff_schemas,
            build_sql,
            gemini_sql,
            gemini_tip,
            open_in_vscode,
            save_workspace,
            load_workspace,
            list_workspaces,
            delete_workspace_cmd,
            get_setting,
            set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NovaDB");
}
