import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, Background, Controls, Handle, MiniMap, Position, addEdge, type Connection, type Edge, type Node, type NodeProps, useEdgesState, useNodesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { desktop, type Column, type DbTable, type Schema, type Dialect, type FlowNode, type FlowEdge } from './lib/desktop'

type TableData = { table: DbTable; selected?: boolean }
type Plan = 'free' | 'quantic' | 'goliaf'
type View = 'schema' | 'sql-editor'

const table = (name: string, columns: Column[]): DbTable => ({ name, columns })
const initialNodes: Node<TableData>[] = [
  { id: 'users', type: 'table', position: { x: 70, y: 145 }, data: { table: table('users', [{ name: 'id', data_type: 'uuid', primary_key: true, nullable: false }, { name: 'email', data_type: 'varchar(255)', primary_key: false, nullable: false }, { name: 'full_name', data_type: 'varchar(160)', primary_key: false, nullable: false }, { name: 'created_at', data_type: 'timestamptz', primary_key: false, nullable: false }]) } },
  { id: 'orders', type: 'table', position: { x: 420, y: 85 }, data: { table: table('orders', [{ name: 'id', data_type: 'uuid', primary_key: true, nullable: false }, { name: 'user_id', data_type: 'uuid', primary_key: false, nullable: false, references: { table: 'users', column: 'id' } }, { name: 'status', data_type: 'varchar(50)', primary_key: false, nullable: false }, { name: 'total', data_type: 'numeric(10,2)', primary_key: false, nullable: false }, { name: 'created_at', data_type: 'timestamptz', primary_key: false, nullable: false }]) } },
  { id: 'items', type: 'table', position: { x: 455, y: 378 }, data: { table: table('order_items', [{ name: 'id', data_type: 'uuid', primary_key: true, nullable: false }, { name: 'order_id', data_type: 'uuid', primary_key: false, nullable: false, references: { table: 'orders', column: 'id' } }, { name: 'quantity', data_type: 'integer', primary_key: false, nullable: false }, { name: 'price', data_type: 'numeric(10,2)', primary_key: false, nullable: false }]) } },
]
const initialEdges: Edge[] = [{ id: 'users-orders', source: 'users', target: 'orders', animated: true }, { id: 'orders-items', source: 'orders', target: 'items', animated: true }]
const databases: { name: string; dialect: Dialect; logo: string; color: string; capability: string }[] = [
  { name: 'PostgreSQL', dialect: 'Postgres', logo: '/assets/db/postgresql.svg', color: '#336791', capability: 'DDL + diff' },
  { name: 'MySQL', dialect: 'MySql', logo: '/assets/db/mysql.svg', color: '#4479A1', capability: 'DDL + diff' },
  { name: 'SQLite', dialect: 'Sqlite', logo: '/assets/db/sqlite.svg', color: '#003B57', capability: 'DDL + diff' },
  { name: 'MariaDB', dialect: 'MariaDb', logo: '/assets/db/mariadb.svg', color: '#003545', capability: 'DDL + diff' },
  { name: 'CockroachDB', dialect: 'Postgres', logo: '/assets/db/cockroachdb.svg', color: '#6b5dd3', capability: 'Postgres mode' },
]

function Mark() { return <img className="app-mark" src="/assets/novadb-mark.svg" alt="NovaDB" /> }
function TableNode({ data }: NodeProps<Node<TableData>>) {
  const { table: t, selected } = data
  return (
    <div className={`flow-table ${selected ? 'flow-table-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-table-head"><span>▦</span><b>{t.name}</b><i>{t.columns.length}</i></div>
      {t.columns.map(c => (
        <div className="flow-field" key={c.name}>
          <span className={c.primary_key ? 'key' : ''}>{c.primary_key ? '⌁' : '○'}</span>
          <b>{c.name}</b><em>{c.data_type}</em>
        </div>
      ))}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { table: TableNode }

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selected, setSelected] = useState('users')
  const [sql, setSql] = useState('')
  const [editorSql, setEditorSql] = useState('')
  const [sqlManual, setSqlManual] = useState(false)
  const [tab, setTab] = useState<'sql' | 'fake' | 'diff' | 'ai'>('sql')
  const [view, setView] = useState<View>('schema')
  const [fakeRows, setFakeRows] = useState<Record<string, string>[]>([])
  const [fakeCount, setFakeCount] = useState(100)
  const [prompt, setPrompt] = useState('Show the top 10 users who made purchases last week')
  const [aiSql, setAiSql] = useState('')
  const [aiTip, setAiTip] = useState('')
  const [notice, setNotice] = useState('')
  const [saved, setSaved] = useState(true)
  const [database, setDatabase] = useState(databases[0])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<string[]>(['Northstar'])
  const [currentWorkspace, setCurrentWorkspace] = useState('Northstar')
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [plan, setPlan] = useState<Plan>('goliaf')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  const getMaxWorkspaces = () => {
    switch (plan) {
      case 'free': return 3
      case 'quantic': return 10
      case 'goliaf': return Infinity
      default: return 3
    }
  }

  const schema: Schema = useMemo(() => ({ tables: nodes.map(node => node.data.table) }), [nodes])
  const active = nodes.find(n => n.id === selected)?.data.table ?? nodes[0].data.table
  const flash = (text: string) => { setNotice(text); setTimeout(() => setNotice(''), 2600) }

  const applyWorkspaceData = (nodesJson: string, edgesJson: string, dialect: string, wsPlan: string) => {
    try {
      const parsedNodes = JSON.parse(nodesJson) as FlowNode[]
      const parsedEdges = JSON.parse(edgesJson) as FlowEdge[]
      if (parsedNodes.length > 0) setNodes(parsedNodes as Node<TableData>[])
      if (parsedEdges.length >= 0) setEdges(parsedEdges)
      const db = databases.find(d => d.dialect === dialect) ?? databases[0]
      setDatabase(db)
      if (wsPlan === 'free' || wsPlan === 'quantic' || wsPlan === 'goliaf') setPlan(wsPlan)
    } catch { /* keep defaults */ }
  }

  const persistWorkspace = useCallback(async () => {
    const data = {
      name: currentWorkspace,
      nodes_json: JSON.stringify(nodes),
      edges_json: JSON.stringify(edges),
      dialect: database.dialect,
      plan,
    }
    await desktop.saveWorkspace(data)
    setSaved(true)
  }, [currentWorkspace, nodes, edges, database.dialect, plan])

  useEffect(() => {
    desktop.listWorkspaces().then(list => {
      if (list.length > 0) setWorkspaces(list)
      return desktop.loadWorkspace(currentWorkspace)
    }).then(data => {
      if (data) applyWorkspaceData(data.nodes_json, data.edges_json, data.dialect, data.plan)
      loaded.current = true
    }).catch(() => { loaded.current = true })
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { persistWorkspace() }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [nodes, edges, database, plan, currentWorkspace, persistWorkspace])

  useEffect(() => {
    desktop.ddl(schema, database.dialect).then(generated => {
      setSql(generated)
      if (!sqlManual) setEditorSql(generated)
    }).catch(() => setSql('-- Unable to generate DDL'))
  }, [schema, database, sqlManual])

  useEffect(() => {
    if (!desktop.isTauri() || plan !== 'goliaf') return
    const interval = setInterval(async () => {
      if (Math.random() > 0.35) return
      try {
        const tip = await desktop.geminiTip(schema, `User is editing workspace "${currentWorkspace}"`)
        setAiTip(tip)
        setTimeout(() => setAiTip(''), 8000)
      } catch { /* Gemini not configured */ }
    }, 45000)
    return () => clearInterval(interval)
  }, [schema, currentWorkspace, plan])

  const onConnect = useCallback((connection: Connection) => setEdges(eds => addEdge({ ...connection, animated: true }, eds)), [setEdges])
  const addTable = () => {
    const id = `table_${nodes.length + 1}`
    setNodes(ns => [...ns, {
      id, type: 'table', position: { x: 170 + ns.length * 40, y: 230 + ns.length * 25 },
      data: { table: table(`new_table_${ns.length + 1}`, [{ name: 'id', data_type: 'uuid', primary_key: true, nullable: false }, { name: 'created_at', data_type: 'timestamptz', primary_key: false, nullable: false }]), selected: true },
    }])
    setSelected(id)
    flash('Table added — drag it anywhere on the canvas')
  }
  const updateActive = (fn: (current: DbTable) => DbTable) => setNodes(ns => ns.map(n => n.id === selected ? { ...n, data: { ...n.data, table: fn(n.data.table) } } : n))
  const addColumn = () => updateActive(current => ({ ...current, columns: [...current.columns, { name: `field_${current.columns.length + 1}`, data_type: 'varchar(255)', primary_key: false, nullable: true }] }))
  const createFake = async () => { setFakeRows(await desktop.fakeData(active, fakeCount)); setTab('fake'); flash(`${fakeCount.toLocaleString()} records generated`) }
  const createDiff = async () => {
    const target: Schema = { tables: schema.tables.map(t => t.name === active.name ? { ...t, columns: [...t.columns, { name: 'updated_at', data_type: 'timestamptz', primary_key: false, nullable: true }] } : t) }
    const statements = await desktop.diff(schema, target)
    setSql(statements.join('\n\n'))
    setTab('diff')
    flash('Migration diff generated')
  }
  const askAi = async () => {
    try { setAiSql(await desktop.aiSql(prompt, schema)) }
    catch { setAiSql('-- Set GEMINI_API_KEY or start Ollama locally.\n-- Example: ollama pull qwen2.5-coder:7b') }
    setTab('ai')
  }
  const askAiIntoEditor = async () => {
    try {
      const generated = await desktop.aiSql(prompt, schema)
      setAiSql(generated)
      setEditorSql(generated)
      setSqlManual(true)
      flash('AI SQL inserted into the editor')
    } catch {
      const fallback = '-- Set GEMINI_API_KEY or start Ollama locally.\n-- Example: ollama pull qwen2.5-coder:7b'
      setAiSql(fallback)
      setEditorSql(fallback)
      setSqlManual(true)
      flash('AI generation unavailable')
    }
  }
  const copy = async (text: string) => { await navigator.clipboard?.writeText(text); flash('SQL copied to clipboard') }
  const syncEditorFromBlocks = () => { setSqlManual(false); flash('SQL synced from canvas blocks') }
  const sendToVscode = async () => {
    try {
      const path = await desktop.openInVscode(editorSql, `${currentWorkspace}_schema`)
      flash(`Opened in VS Code: ${path.split(/[/\\]/).pop()}`)
    } catch {
      await copy(editorSql)
      flash('VS Code not found — SQL copied to clipboard instead')
    }
  }

  const addWorkspace = () => {
    if (workspaces.length >= getMaxWorkspaces()) { flash(`Maximum workspaces reached for ${plan} plan`); return }
    if (!newWorkspaceName.trim()) { flash('Please enter a workspace name'); return }
    if (workspaces.includes(newWorkspaceName)) { flash('Workspace name already exists'); return }
    setWorkspaces([...workspaces, newWorkspaceName])
    switchWorkspace(newWorkspaceName)
    setNewWorkspaceName('')
    setWorkspaceOpen(false)
  }

  const switchWorkspace = async (name: string) => {
    if (name === currentWorkspace) { setWorkspaceOpen(false); return }
    await persistWorkspace()
    setCurrentWorkspace(name)
    setWorkspaceOpen(false)
    const data = await desktop.loadWorkspace(name)
    if (data) applyWorkspaceData(data.nodes_json, data.edges_json, data.dialect, data.plan)
    else { setNodes(initialNodes); setEdges(initialEdges) }
    flash(`Switched to workspace: ${name}`)
  }

  const navigateToSqlEditor = () => { setView('sql-editor'); setSqlManual(false) }
  const navigateToSchema = () => setView('schema')
  const navigateToMigrations = () => { setView('schema'); setTab('diff'); flash('Viewing migrations') }
  const shareSchema = () => { copy(editorSql); flash('Schema SQL copied — ready to share') }

  return (
    <main className="mvp">
      <aside className="mvp-sidebar">
        <div className="mvp-brand"><Mark /><b>nova<span>db</span></b></div>
        <div className="workspace-switch" onClick={() => setWorkspaceOpen(!workspaceOpen)}>
          <strong>{currentWorkspace.charAt(0).toUpperCase()}</strong>
          <div><b>{currentWorkspace}</b><small>{workspaces.length} workspaces</small></div>
          <span>⌄</span>
          {workspaceOpen && (
            <div className="workspace-dropdown">
              <div className="workspace-list">
                {workspaces.map(ws => (
                  <button key={ws} onClick={e => { e.stopPropagation(); switchWorkspace(ws) }} className={currentWorkspace === ws ? 'active' : ''}>
                    {currentWorkspace === ws && <span>▦</span>}<span>{ws}</span>
                  </button>
                ))}
              </div>
              {workspaces.length < getMaxWorkspaces() && (
                <div className="workspace-add">
                  <input type="text" placeholder="New workspace name..." value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} onClick={e => e.stopPropagation()} />
                  <button onClick={e => { e.stopPropagation(); addWorkspace() }}>Add</button>
                </div>
              )}
            </div>
          )}
        </div>
        <nav>
          <p>WORKSPACE</p>
          <button className={view === 'schema' ? 'active' : ''} onClick={navigateToSchema}>▦ <span>Schema</span></button>
          <button className={view === 'sql-editor' ? 'active' : ''} onClick={navigateToSqlEditor}>⌘ <span>SQL editor</span></button>
          <button onClick={navigateToMigrations}>◷ <span>Migrations</span><i>3</i></button>
          <p>MANAGE</p>
          <button onClick={() => setSettingsOpen(true)}>⚙ <span>Settings</span></button>
        </nav>
        <div className="core-ready">
          <span>✦</span>
          <b>{desktop.isTauri() ? 'SQLite + Gemini ready' : 'Browser preview mode'}</b>
          <small>{desktop.isTauri() ? 'Blocks saved locally' : 'Use localStorage fallback'}</small>
        </div>
      </aside>

      <section className="mvp-main">
        <header>
          <div className="crumb">{currentWorkspace} <span>›</span> <b>Retail database</b><em>{saved ? '● Saved' : '○ Saving…'}</em></div>
          <div>
            <button className="top-plain" onClick={shareSchema}>Share</button>
            {view === 'sql-editor' && (
              <button className="top-plain vscode-btn" onClick={sendToVscode}>
                <img src="/assets/Visual_Studio_Code_1.35_icon.svg" alt="VS Code" />
                <span>Open in VS Code</span>
              </button>
            )}
            <button className="deploy" onClick={createDiff}>▶ Deploy</button>
          </div>
        </header>

        {view === 'sql-editor' ? (
          <div className="sql-editor-view">
            <div className="sql-editor-sidebar">
              <small>BLOCKS · {nodes.length} tables</small>
              <h2>Canvas blocks</h2>
              <p>Changes on the schema canvas update SQL here in real time.</p>
              {nodes.map(n => (
                <div key={n.id} className={`sql-block-card ${n.id === selected ? 'selected' : ''}`} onClick={() => { setSelected(n.id); setView('schema') }}>
                  <span>▦</span>
                  <div><b>{n.data.table.name}</b><small>{n.data.table.columns.length} columns</small></div>
                </div>
              ))}
              <button className="add-column" onClick={() => { setView('schema'); addTable() }}>＋ Add table on canvas</button>
            </div>
            <div className="sql-editor-main">
              <div className="sql-editor-toolbar">
                <span>{database.name} · {sqlManual ? 'Manual edit mode' : 'Live from blocks'}</span>
                <div>
                  <button onClick={syncEditorFromBlocks}>↻ Sync from blocks</button>
                  <button onClick={() => copy(editorSql)}>Copy SQL</button>
                  <button className="deploy vscode-btn" onClick={sendToVscode}>
                    <img src="/assets/Visual_Studio_Code_1.35_icon.svg" alt="VS Code" />
                    <span>Open in VS Code</span>
                  </button>
                </div>
              </div>
              <textarea
                className="sql-editor-textarea"
                value={editorSql}
                onChange={e => { setEditorSql(e.target.value); setSqlManual(true) }}
                spellCheck={false}
              />
              <div className="sql-editor-ai">
                <label>Ask AI for SQL</label>
                <div className="sql-editor-ai-row">
                  <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Generate a query from the current schema…" />
                  <button className="deploy" onClick={askAiIntoEditor}>Generate</button>
                </div>
                <pre>{aiSql || 'Gemini/ Ollama can draft SQL for the current blocks.'}</pre>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mvp-title">
              <div>
                <small>DATABASE DESIGN</small>
                <h1>Retail database <em>v2.4</em></h1>
                <p>Drag tables, connect relation handles, then generate production SQL.</p>
              </div>
              <div>
                <select className="db-select" value={database.name} onChange={e => { const next = databases.find(x => x.name === e.target.value)!; setDatabase(next); flash(`${next.name} selected`) }}>
                  {databases.map(x => <option key={x.name} value={x.name}>{x.name} — {x.capability}</option>)}
                </select>
                <button onClick={createDiff}>⇄ Migration diff</button>
                <button onClick={addTable}>＋ Add table</button>
              </div>
            </div>
            <div className="editor">
              <section className="flow-wrap">
                <ReactFlow
                  nodes={nodes.map(n => ({ ...n, data: { ...n.data, selected: n.id === selected } }))}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => setSelected(node.id)}
                  nodeTypes={nodeTypes}
                  fitView
                >
                  <Background gap={20} size={1} />
                  <Controls />
                  <MiniMap zoomable pannable />
                </ReactFlow>
                <div className="flow-hint">✦ Drag nodes · connect handles to define relations</div>
              </section>
              <aside className="properties">
                <div className="properties-head"><span>▦</span><h2>{active.name}</h2></div>
                <label>TABLE NAME<input value={active.name} onChange={e => updateActive(t => ({ ...t, name: e.target.value.replace(/\W/g, '_') }))} /></label>
                <div className="properties-caption"><b>Columns</b><span>{active.columns.length}</span></div>
                {active.columns.map((column, index) => (
                  <div className="prop-column" key={`${column.name}-${index}`}>
                    <span>{column.primary_key ? '⌁' : '○'}</span>
                    <input value={column.name} onChange={e => updateActive(t => ({ ...t, columns: t.columns.map((c, i) => i === index ? { ...c, name: e.target.value } : c) }))} />
                    <select value={column.data_type} onChange={e => updateActive(t => ({ ...t, columns: t.columns.map((c, i) => i === index ? { ...c, data_type: e.target.value } : c) }))}>
                      <option>uuid</option><option>varchar(255)</option><option>integer</option><option>numeric(10,2)</option><option>timestamptz</option><option>boolean</option>
                    </select>
                  </div>
                ))}
                <button className="add-column" onClick={addColumn}>＋ Add column</button>
                <hr />
                <div className="relation-title">RELATIONSHIPS</div>
                <p className="relation-copy">Drag from a table handle to create a visual relationship.</p>
              </aside>
            </div>
            <section className="workbench">
              <div className="work-tabs">
                <button className={tab === 'sql' ? 'chosen' : ''} onClick={() => setTab('sql')}>⌘ Generated SQL</button>
                <button className={tab === 'fake' ? 'chosen' : ''} onClick={() => setTab('fake')}>✦ Fake data</button>
                <button className={tab === 'diff' ? 'chosen' : ''} onClick={() => setTab('diff')}>⇄ Migration Diff</button>
                <button className={tab === 'ai' ? 'chosen' : ''} onClick={() => setTab('ai')}>✧ Gemini AI</button>
              </div>
              {tab === 'sql' && (
                <div className="result">
                  <div className="result-actions"><span>{database.name} · Auto-updates from canvas</span><button onClick={() => copy(sql)}>Copy SQL</button></div>
                  <pre>{sql}</pre>
                </div>
              )}
              {tab === 'fake' && (
                <div className="fake-panel">
                  <div><b>Generate test records for <code>{active.name}</code></b><p>Runs locally in Rust and is ready for batch insertion.</p></div>
                  <label>Rows<input type="number" min="1" max="100000" value={fakeCount} onChange={e => setFakeCount(Number(e.target.value))} /></label>
                  <button className="deploy" onClick={createFake}>Generate</button>
                  {fakeRows.length > 0 && <pre>{JSON.stringify(fakeRows.slice(0, 3), null, 2)}</pre>}
                </div>
              )}
              {tab === 'diff' && (
                <div className="result">
                  <div className="result-actions"><span>Additive diff preview — creates a safe `updated_at` migration</span><button onClick={createDiff}>Refresh</button></div>
                  <pre>{sql}</pre>
                </div>
              )}
              {tab === 'ai' && (
                <div className="ai-panel">
                  <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask for a SQL query…" />
                  <button className="deploy" onClick={askAi}>Generate SQL</button>
                  <pre>{aiSql || 'Uses Gemini API (set GEMINI_API_KEY) or local Ollama as fallback.'}</pre>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {settingsOpen && (
        <div className="settings-overlay">
          <div className="settings-card">
            <button className="settings-close" onClick={() => setSettingsOpen(false)}>×</button>
            <small>NOVA BETA</small>
            <h2>Settings & database targets</h2>
            <p>All beta users have Nova Goliaf premium access for free.</p>
            <div className="db-list">
              {databases.map(x => (
                <button key={x.name} onClick={() => { setDatabase(x); setSettingsOpen(false); flash(`${x.name} selected`) }}>
                  <img src={x.logo} alt={x.name} className="db-logo" />
                  <span><strong>{x.name}</strong><small>{x.capability}</small></span>
                </button>
              ))}
            </div>
            <div className="plans">
              <article>
                <b>Nova Free</b>
                <strong>$0 <small>/month</small></strong>
                <p>Basic schema design with up to 3 workspaces.</p>
                <button onClick={() => { setPlan('free'); flash('Switched to Free plan - max 3 workspaces') }}>Current</button>
              </article>
              <article>
                <b>Nova Quantic</b>
                <strong>$2 <small>/month</small></strong>
                <p>Expanded presets, all SQL dialects and up to 10 workspaces.</p>
                <button onClick={() => { setPlan('quantic'); flash('Switched to Quantic plan - max 10 workspaces') }}>Upgrade</button>
              </article>
              <article>
                <b>✦ Nova Goliaf</b>
                <strong>$5 <small>/month</small></strong>
                <p>Everything in Quantic plus Gemini AI and unlimited workspaces.</p>
                <button onClick={() => { setPlan('goliaf'); flash('Switched to Goliaf plan - unlimited workspaces') }}>Upgrade</button>
              </article>
            </div>
            <div className="plan-info">
              <p>Current plan: <strong>{plan === 'free' ? 'Free' : plan === 'quantic' ? 'Quantic' : 'Goliaf'}</strong> | Workspaces: {workspaces.length}/{getMaxWorkspaces() === Infinity ? '∞' : getMaxWorkspaces()}</p>
            </div>
            <em className="brand-note">Set GEMINI_API_KEY env var for AI features.</em>
          </div>
        </div>
      )}

      {aiTip && <div className="ai-tip-banner"><span>✧</span>{aiTip}</div>}
      {notice && <div className="toast"><b>✓</b>{notice}</div>}
    </main>
  )
}

export default App
