-- Multi-board support: one SQLite file can now hold several independent,
-- named, switchable boards. Every pre-existing row across every table
-- backfills to one seeded board (id 'default'), so upgrading an existing
-- install loses nothing — it just becomes an install with one board.
--
-- node_types.id stays exactly what it already is (a human-chosen slug like
-- "task"/"poam"/a custom type's slug) rather than becoming an opaque
-- per-board id — client code compares node.type === "poam" literally in
-- several places (NodeCardForm, MetadataFields, PoamsTab, ItemsBlade,
-- poamImportService), and every board's own seeded types keep using those
-- same literal ids, so none of that code needs to change. Uniqueness moves
-- from "id alone" to "id within a board": node_types' primary key becomes
-- (board_id, id), and nodes.type / node_statuses.type_id's foreign keys
-- become composite to match. nodes.id/edges.id stay plain globally-unique
-- UUIDs (already collision-proof across boards) — they only need a plain
-- board_id column for scoping, though edges' source_id/target_id become
-- composite FKs into nodes(board_id, id) too, which makes "an edge can't
-- point at a node in a different board" a DB-enforced invariant for free.
--
-- theme moves out of app_settings into a new global_settings table — it's
-- a pure cross-board UI preference, not board data — while app_settings
-- itself (tileFields, placementMode) becomes board-scoped, since both are
-- meaningfully per-board (tileFields is keyed by per-board type ids;
-- placementMode describes how *that board's* map is arranged).
--
-- Same rebuild pattern as 002_dynamic_types.sql for the same reason: SQLite
-- has no ALTER TABLE for dropping/changing a PRIMARY KEY or adding a
-- foreign key to an existing table, and PRAGMA foreign_keys must be off for
-- the duration (only takes effect outside an active transaction), so this
-- whole migration brackets its own BEGIN/COMMIT rather than relying on
-- migrate.ts's per-migration wrapper.

CREATE TABLE boards (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO boards (id, name, sort_order) VALUES ('default', 'My Board', 0);

CREATE TABLE global_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO global_settings (key, value)
  SELECT key, value FROM app_settings WHERE key = 'theme';

PRAGMA foreign_keys = OFF;
BEGIN;

-- node_types: board_id + composite primary key.
CREATE TABLE node_types_new (
  board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (board_id, id)
);
INSERT INTO node_types_new (board_id, id, label, color, sort_order, created_at, updated_at)
  SELECT 'default', id, label, color, sort_order, created_at, updated_at FROM node_types;
DROP TABLE node_types;
ALTER TABLE node_types_new RENAME TO node_types;

-- node_statuses: board_id + composite FK into node_types, unique constraint
-- widened to include board_id. id itself stays a plain unique PK (statuses
-- already use randomUUID(), never slugs, so no cross-board collision risk).
CREATE TABLE node_statuses_new (
  board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  id         TEXT PRIMARY KEY,
  type_id    TEXT NOT NULL,
  value      TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(board_id, type_id, value),
  FOREIGN KEY (board_id, type_id) REFERENCES node_types(board_id, id) ON DELETE CASCADE
);
INSERT INTO node_statuses_new (board_id, id, type_id, value, label, sort_order, is_default, created_at)
  SELECT 'default', id, type_id, value, label, sort_order, is_default, created_at FROM node_statuses;
DROP TABLE node_statuses;
ALTER TABLE node_statuses_new RENAME TO node_statuses;
CREATE INDEX idx_node_statuses_board_type ON node_statuses(board_id, type_id);

-- nodes: board_id + composite FK for type.
CREATE TABLE nodes_new (
  board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'not_started',
  metadata    TEXT NOT NULL DEFAULT '{}',
  pos_x       REAL NOT NULL DEFAULT 0,
  pos_y       REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  -- id alone is already globally unique (client-generated UUID), but a
  -- composite FK target requires an index matching its exact column set —
  -- this is what lets edges below reference nodes(board_id, id) so an edge
  -- can never point at a node in a different board.
  UNIQUE (board_id, id),
  FOREIGN KEY (board_id, type) REFERENCES node_types(board_id, id)
);
INSERT INTO nodes_new (board_id, id, type, title, description, status, metadata, pos_x, pos_y, created_at, updated_at)
  SELECT 'default', id, type, title, description, status, metadata, pos_x, pos_y, created_at, updated_at FROM nodes;
DROP TABLE nodes;
ALTER TABLE nodes_new RENAME TO nodes;
CREATE INDEX idx_nodes_board_type ON nodes(board_id, type);

-- edges: board_id + composite FKs into nodes for both endpoints, so an edge
-- can never point at a node in a different board (DB-enforced, not just an
-- application-layer assumption).
CREATE TABLE edges_new (
  board_id          TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  id                TEXT PRIMARY KEY,
  source_id         TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'depends_on',
  label             TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (board_id, source_id) REFERENCES nodes(board_id, id) ON DELETE CASCADE,
  FOREIGN KEY (board_id, target_id) REFERENCES nodes(board_id, id) ON DELETE CASCADE
);
INSERT INTO edges_new (board_id, id, source_id, target_id, relationship_type, label, created_at, updated_at)
  SELECT 'default', id, source_id, target_id, relationship_type, label, created_at, updated_at FROM edges;
DROP TABLE edges;
ALTER TABLE edges_new RENAME TO edges;
CREATE INDEX idx_edges_board_source ON edges(board_id, source_id);
CREATE INDEX idx_edges_board_target ON edges(board_id, target_id);
CREATE UNIQUE INDEX uq_edges_link ON edges(board_id, source_id, target_id, relationship_type);

-- app_settings: board_id + composite primary key; the 'theme' row moved to
-- global_settings above rather than carrying over here.
CREATE TABLE app_settings_new (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (board_id, key)
);
INSERT INTO app_settings_new (board_id, key, value)
  SELECT 'default', key, value FROM app_settings WHERE key != 'theme';
DROP TABLE app_settings;
ALTER TABLE app_settings_new RENAME TO app_settings;

COMMIT;
PRAGMA foreign_keys = ON;
