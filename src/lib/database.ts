import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  try {
    db = await Database.load('sqlite:auraos.db');
  } catch (e) {
    console.error('Failed to load database:', e);
    throw e;
  }
  
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ai_models_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_type TEXT NOT NULL UNIQUE,
        model_name TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'ollama',
        parameters TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('Table ai_models_config may already exist:', e);
  }
  
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS skill_core_index (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        methods TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('Table skill_core_index may already exist:', e);
  }
  
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_index (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        last_opened DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('Table project_index may already exist:', e);
  }
  
  return db;
}

export async function saveModelAssignment(taskType: string, modelName: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(
    `INSERT OR REPLACE INTO ai_models_config (task_type, model_name, provider, updated_at) 
     VALUES (?, ?, 'ollama', datetime('now'))`,
    [taskType, modelName]
  );
}

export async function getModelAssignments(): Promise<Record<string, string>> {
  const database = await initDatabase();
  const result = await database.select<{ task_type: string; model_name: string }[]>(
    `SELECT task_type, model_name FROM ai_models_config`
  );
  
  const assignments: Record<string, string> = {};
  for (const row of result) {
    assignments[row.task_type] = row.model_name;
  }
  
  return assignments;
}

export async function saveProject(name: string, path: string): Promise<void> {
  const database = await initDatabase();
  const id = crypto.randomUUID();
  await database.execute(
    `INSERT OR REPLACE INTO project_index (id, name, path, last_opened) VALUES (?, ?, ?, datetime('now'))`,
    [id, name, path]
  );
}

export async function getProjects(): Promise<{ id: string; name: string; path: string; last_opened: string }[]> {
  const database = await initDatabase();
  return database.select(
    `SELECT id, name, path, last_opened FROM project_index ORDER BY last_opened DESC`
  );
}

export async function deleteProject(id: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(`DELETE FROM project_index WHERE id = ?`, [id]);
}
