use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceData {
    pub name: String,
    pub nodes_json: String,
    pub edges_json: String,
    pub dialect: String,
    pub plan: String,
}