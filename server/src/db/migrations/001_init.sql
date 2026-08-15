PRAGMA foreign_keys = ON;

CREATE TABLE nodes (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('task','project','poam')),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'not_started',
  metadata    TEXT NOT NULL DEFAULT '{}',
  pos_x       REAL NOT NULL DEFAULT 0,
  pos_y       REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_nodes_type ON nodes(type);

CREATE TABLE edges (
  id                TEXT PRIMARY KEY,
  source_id         TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id         TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'depends_on',
  label             TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE UNIQUE INDEX uq_edges_link ON edges(source_id, target_id, relationship_type);
