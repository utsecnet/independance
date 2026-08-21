CREATE TABLE node_types (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE node_statuses (
  id         TEXT PRIMARY KEY,
  type_id    TEXT NOT NULL REFERENCES node_types(id) ON DELETE CASCADE,
  value      TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(type_id, value)
);
CREATE INDEX idx_node_statuses_type ON node_statuses(type_id);

-- Seed the 3 existing types with their new default colors. Existing nodes'
-- `type` values (task/project/poam) are untouched by this migration, so
-- they resolve against these rows with no data change needed.
INSERT INTO node_types (id, label, color, sort_order) VALUES
  ('task', 'Task', '#3b82f6', 0),
  ('project', 'Project', '#9a6bde', 1),
  ('poam', 'POA&M', '#dc4444', 2);

-- Existing nodes' `status` values are untouched too — these slugs match
-- exactly what was already hardcoded in the client/server before this
-- migration, so no existing node ends up with an unresolvable status.
INSERT INTO node_statuses (id, type_id, value, label, sort_order, is_default) VALUES
  ('task__not_started', 'task', 'not_started', 'Not Started', 0, 1),
  ('task__in_progress', 'task', 'in_progress', 'In Progress', 1, 0),
  ('task__blocked', 'task', 'blocked', 'Blocked', 2, 0),
  ('task__complete', 'task', 'complete', 'Complete', 3, 0),
  ('project__not_started', 'project', 'not_started', 'Not Started', 0, 1),
  ('project__in_progress', 'project', 'in_progress', 'In Progress', 1, 0),
  ('project__blocked', 'project', 'blocked', 'Blocked', 2, 0),
  ('project__complete', 'project', 'complete', 'Complete', 3, 0),
  ('poam__drafting', 'poam', 'drafting', 'Drafting', 0, 1),
  ('poam__assessment', 'poam', 'assessment', 'Assessment', 1, 0),
  ('poam__planning', 'poam', 'planning', 'Planning', 2, 0),
  ('poam__isso_review', 'poam', 'isso_review', 'ISSO Review', 3, 0),
  ('poam__issm_review', 'poam', 'issm_review', 'ISSM Review', 4, 0),
  ('poam__complete', 'poam', 'complete', 'Complete', 5, 0);

-- SQLite has no ALTER TABLE ... DROP CONSTRAINT, so rebuild `nodes` without
-- the old hardcoded CHECK (type IN ('task','project','poam')). A foreign
-- key to node_types replaces it: PRAGMA foreign_keys=ON is already set in
-- connection.ts, so this both validates `type` against real rows AND
-- blocks deleting a node_types row that's still referenced (default FK
-- behavior with no ON DELETE clause is RESTRICT).
--
-- Rebuilding `nodes` while `edges` still holds live foreign keys into it
-- fails ("FOREIGN KEY constraint failed") unless foreign_keys is off for
-- the duration — and that PRAGMA only takes effect outside an active
-- transaction, so it has to bracket this migration's own BEGIN/COMMIT
-- rather than living inside migrate.ts's (removed) wrapper. Verified this
-- exact sequence against a live node:sqlite DB before relying on it.
PRAGMA foreign_keys = OFF;
BEGIN;

CREATE TABLE nodes_new (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL REFERENCES node_types(id),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'not_started',
  metadata    TEXT NOT NULL DEFAULT '{}',
  pos_x       REAL NOT NULL DEFAULT 0,
  pos_y       REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO nodes_new SELECT * FROM nodes;
DROP TABLE nodes;
ALTER TABLE nodes_new RENAME TO nodes;
CREATE INDEX idx_nodes_type ON nodes(type);

COMMIT;
PRAGMA foreign_keys = ON;
