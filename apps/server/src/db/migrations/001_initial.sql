-- T-016 初期スキーマ（ENT-001/002/003、ENT-004 は migration runner が別途作成）
-- データ設計書 §3 / §4 に対応。OPEN-04: 日付は ISO 8601 文字列（YYYY-MM-DD）で保持。

CREATE TABLE IF NOT EXISTS projects (
  project_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  parent_task_id INTEGER,
  name TEXT NOT NULL,
  assignee TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(task_id) ON DELETE SET NULL,
  CHECK (progress >= 0 AND progress <= 100),
  CHECK (start_date <= due_date)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS dependencies (
  dependency_id INTEGER PRIMARY KEY AUTOINCREMENT,
  predecessor_task_id INTEGER NOT NULL,
  successor_task_id INTEGER NOT NULL,
  FOREIGN KEY (predecessor_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  FOREIGN KEY (successor_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  UNIQUE (predecessor_task_id, successor_task_id),
  CHECK (predecessor_task_id <> successor_task_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_predecessor ON dependencies(predecessor_task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_successor ON dependencies(successor_task_id);
