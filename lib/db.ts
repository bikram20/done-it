import Database from 'better-sqlite3';
import { Pool } from 'pg';

// Database types
export type User = {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
};

export type Todo = {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  priority: 'high' | 'medium' | 'low';
  category: string | null;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

// Check if we're using PostgreSQL (production) or SQLite (development)
const isProduction = !!process.env.DATABASE_URL;

let sqliteDb: Database.Database | null = null;
let pgPool: Pool | null = null;

if (isProduction) {
  // PostgreSQL for production
  const sslEnabled = process.env.DB_POSTGRESDB_SSL_ENABLED === 'true';
  const rejectUnauthorized = process.env.DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED !== 'false';

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslEnabled ? {
      rejectUnauthorized: rejectUnauthorized
    } : false
  });
} else {
  // SQLite for local development
  sqliteDb = new Database('./data.db');
  sqliteDb.pragma('journal_mode = WAL');
}

// Initialize database schema
export async function initDb() {
  if (isProduction && pgPool) {
    // PostgreSQL schema
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        category VARCHAR(100),
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for better query performance
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
    `);
  } else if (sqliteDb) {
    // SQLite schema
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        category TEXT,
        completed INTEGER DEFAULT 0,
        completed_at TEXT,
        due_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    sqliteDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
    `);
  }
}

// User operations
export async function createUser(username: string, passwordHash: string): Promise<User | null> {
  try {
    if (isProduction && pgPool) {
      const result = await pgPool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
        [username, passwordHash]
      );
      return result.rows[0] as User;
    } else if (sqliteDb) {
      const stmt = sqliteDb.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return getUserById(Number(result.lastInsertRowid));
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
  return null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  if (isProduction && pgPool) {
    const result = await pgPool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] as User || null;
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User || null;
  }
  return null;
}

export async function getUserById(id: number): Promise<User | null> {
  if (isProduction && pgPool) {
    const result = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] as User || null;
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User || null;
  }
  return null;
}

// Todo operations
export async function createTodo(
  userId: number,
  title: string,
  description: string | null,
  priority: 'high' | 'medium' | 'low',
  category: string | null,
  dueDate: string | null
): Promise<Todo | null> {
  try {
    if (isProduction && pgPool) {
      const result = await pgPool.query(
        `INSERT INTO todos (user_id, title, description, priority, category, due_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, title, description, priority, category, dueDate]
      );
      return result.rows[0] as Todo;
    } else if (sqliteDb) {
      const stmt = sqliteDb.prepare(
        'INSERT INTO todos (user_id, title, description, priority, category, due_date) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const result = stmt.run(userId, title, description, priority, category, dueDate);
      return getTodoById(Number(result.lastInsertRowid));
    }
  } catch (error) {
    console.error('Error creating todo:', error);
    return null;
  }
  return null;
}

export async function getTodosByUserId(userId: number): Promise<Todo[]> {
  if (isProduction && pgPool) {
    const result = await pgPool.query(
      'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows as Todo[];
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as Todo[];
  }
  return [];
}

export async function getTodoById(id: number): Promise<Todo | null> {
  if (isProduction && pgPool) {
    const result = await pgPool.query('SELECT * FROM todos WHERE id = $1', [id]);
    return result.rows[0] as Todo || null;
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare('SELECT * FROM todos WHERE id = ?');
    return stmt.get(id) as Todo || null;
  }
  return null;
}

export async function updateTodo(
  id: number,
  updates: Partial<Omit<Todo, 'id' | 'user_id' | 'created_at'>>
): Promise<Todo | null> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (isProduction) {
        fields.push(`${key} = $${paramIndex}`);
      } else {
        fields.push(`${key} = ?`);
      }
      values.push(value);
      paramIndex++;
    });

    if (fields.length === 0) return getTodoById(id);

    if (isProduction) {
      fields.push(`updated_at = $${paramIndex}`);
    } else {
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
    }

    if (isProduction && pgPool) {
      values.push(new Date().toISOString());
      values.push(id);
      const result = await pgPool.query(
        `UPDATE todos SET ${fields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`,
        values
      );
      return result.rows[0] as Todo || null;
    } else if (sqliteDb) {
      values.push(id);
      const stmt = sqliteDb.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
      return getTodoById(id);
    }
  } catch (error) {
    console.error('Error updating todo:', error);
    return null;
  }
  return null;
}

export async function deleteTodo(id: number): Promise<boolean> {
  try {
    if (isProduction && pgPool) {
      const result = await pgPool.query('DELETE FROM todos WHERE id = $1', [id]);
      return result.rowCount ? result.rowCount > 0 : false;
    } else if (sqliteDb) {
      const stmt = sqliteDb.prepare('DELETE FROM todos WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    }
  } catch (error) {
    console.error('Error deleting todo:', error);
    return false;
  }
  return false;
}

export async function getCompletedTodoStats(userId: number): Promise<{
  total: number;
  completed: number;
  completionRate: number;
}> {
  if (isProduction && pgPool) {
    const result = await pgPool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as completed
       FROM todos WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(result.rows[0].total) || 0;
    const completed = parseInt(result.rows[0].completed) || 0;
    return {
      total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
      FROM todos WHERE user_id = ?
    `);
    const result = stmt.get(userId) as any;
    const total = result.total || 0;
    const completed = result.completed || 0;
    return {
      total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }
  return { total: 0, completed: 0, completionRate: 0 };
}
