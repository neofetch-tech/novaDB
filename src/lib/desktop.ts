import { invoke } from '@tauri-apps/api/core'

export type Column = { name: string; data_type: string; primary_key: boolean; nullable: boolean; references?: { table: string; column: string } | null }
export type DbTable = { name: string; columns: Column[] }
export type Schema = { tables: DbTable[] }
export type Dialect = 'Postgres' | 'MySql' | 'MariaDb' | 'Sqlite' | 'DynamoDb' | 'MongoDb'

export type FlowNode = { id: string; type: string; position: { x: number; y: number }; data: { table: DbTable; selected?: boolean } }
export type FlowEdge = { id: string; source: string; target: string; animated?: boolean }

export type WorkspaceData = {
  name: string
  nodes_json: string
  edges_json: string
  dialect: string
  plan: string
}

const isTauri = () => '__TAURI_INTERNALS__' in windowconst useDjangoBackend = import.meta.env.VITE_USE_DJANGO === 'true'
const API_BASE = 'http://127.0.0.1:8000/api'

async function apiFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || response.statusText)
  }
  return response.json()
}

async function apiPost(path: string, payload: unknown) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(payload) })
}

async function apiGet(path: string) {
  return apiFetch(path)
}
const quote = (name: string) => `"${name}"`
const LS_PREFIX = 'novadb_ws_'
const LS_WORKSPACES = 'novadb_workspaces'

function localDdl(schema: Schema) {
  return schema.tables.map(table => `CREATE TABLE ${quote(table.name)} (\n${table.columns.map(c => `  ${quote(c.name)} ${c.data_type.toUpperCase()}${c.primary_key ? ' PRIMARY KEY' : ''}${c.nullable ? '' : ' NOT NULL'}${c.references ? ` REFERENCES ${quote(c.references.table)}(${quote(c.references.column)})` : ''}`).join(',\n')}\n);`).join('\n\n')
}

function localRows(table: DbTable, count: number) {
  const first = ['Mia', 'Noah', 'Olivia', 'Liam', 'Emma', 'Lucas']
  const last = ['Williams', 'Taylor', 'Brown', 'Wilson', 'Miller', 'Davis']
  return Array.from({ length: count }, (_, index) => Object.fromEntries(table.columns.map(column => {
    const n = index + 1, type = column.data_type.toLowerCase()
    let value = `sample_${n}`
    if (column.name === 'email') value = `${first[index % first.length].toLowerCase()}.${last[index % last.length].toLowerCase()}${n}@example.dev`
    else if (column.name.includes('name')) value = `${first[index % first.length]} ${last[index % last.length]}`
    else if (type.includes('int') || type.includes('numeric')) value = String(n)
    else if (type.includes('date') || type.includes('time')) value = `2026-0${(n % 9) + 1}-1${n % 9}T10:00:00Z`
    else if (type === 'uuid') value = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
    return [column.name, value]
  })))
}

function localSaveWorkspace(data: WorkspaceData) {
  localStorage.setItem(`${LS_PREFIX}${data.name}`, JSON.stringify(data))
  const list = JSON.parse(localStorage.getItem(LS_WORKSPACES) || '["Northstar"]') as string[]
  if (!list.includes(data.name)) {
    localStorage.setItem(LS_WORKSPACES, JSON.stringify([...list, data.name]))
  }
}

function localLoadWorkspace(name: string): WorkspaceData | null {
  const raw = localStorage.getItem(`${LS_PREFIX}${name}`)
  return raw ? JSON.parse(raw) : null
}

function localListWorkspaces(): string[] {
  return JSON.parse(localStorage.getItem(LS_WORKSPACES) || '["Northstar"]')
}

export const desktop = {
  async ddl(schema: Schema, dialect: Dialect = 'Postgres') {
    if (useDjangoBackend && !isTauri()) {
      const result = await apiPost('/ddl/', { schema, dialect })
      return result.ddl as string
    }
    return isTauri() ? invoke<string>('generate_ddl', { schema, dialect }) : localDdl(schema)
  },
  async fakeData(table: DbTable, count: number) { return isTauri() ? invoke<Record<string, string>[]>('generate_fake_data', { table, count }) : localRows(table, count) },
  async diff(current: Schema, target: Schema, dialect: Dialect = 'Postgres') { return isTauri() ? invoke<string[]>('diff_schemas', { current, target, dialect }) : [localDdl(target)] },
  async aiSql(prompt: string, schema: Schema) { return invoke<string>('build_sql', { prompt, schema }) },
  async geminiTip(schema: Schema, context: string) { return invoke<string>('gemini_tip', { schema, context }) },
  async openInVscode(sql: string, filename: string) { return invoke<string>('open_in_vscode', { sql, filename }) },
  async saveWorkspace(data: WorkspaceData) {
    if (isTauri()) return invoke<void>('save_workspace', { data })
    localSaveWorkspace(data)
  },
  async loadWorkspace(name: string) {
    if (isTauri()) return invoke<WorkspaceData | null>('load_workspace', { name })
    return localLoadWorkspace(name)
  },
  async listWorkspaces() {
    if (isTauri()) return invoke<string[]>('list_workspaces')
    return localListWorkspaces()
  },
  isTauri,
}
