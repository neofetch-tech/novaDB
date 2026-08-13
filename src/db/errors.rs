#[derive(Debug)]
pub enum DbError {
    Sqlite(rusqlite::Error),
    Io(std::io::Error),
    Serde(serde_json::Error),
}

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Sqlite(err) => write!(f, "SQLite error: {err}"),
            Self::Io(err) => write!(f, "IO error: {err}"),
            Self::Serde(err) => write!(f, "Serde error: {err}"),
        }
    }
}

impl std::error::Error for DbError {}

impl From<rusqlite::Error> for DbError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sqlite(value)
    }
}

impl From<std::io::Error> for DbError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for DbError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value)
    }
}

pub type DbResult<T> = Result<T, DbError>;