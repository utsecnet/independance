import type { DatabaseSync } from "node:sqlite";
import type { FullBackup, fullBackupSchema } from "@independance/shared";
import type { z } from "zod";
import * as nodeQueries from "../db/queries/nodes.js";
import * as edgeQueries from "../db/queries/edges.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import * as statusQueries from "../db/queries/statuses.js";
import * as settingsQueries from "../db/queries/appSettings.js";
import * as boardQueries from "../db/queries/boards.js";
import { getSettings } from "./appSettingsService.js";
import { HttpError } from "../middleware/errorHandler.js";

export function exportBackup(db: DatabaseSync, boardId: string): FullBackup {
  const board = boardQueries.getBoard(db, boardId);
  if (!board) throw new HttpError(404, "not_found", `Board ${boardId} not found`);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    boardId: board.id,
    boardName: board.name,
    nodeTypes: nodeTypeQueries.listNodeTypes(db, boardId),
    statuses: statusQueries.listStatuses(db, boardId),
    nodes: nodeQueries.listNodes(db, boardId),
    edges: edgeQueries.listEdges(db, boardId),
    appSettings: getSettings(db, boardId),
  };
}

export interface RestoreResult {
  nodeTypeCount: number;
  statusCount: number;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Full replace, scoped to `boardId`: wipes every node/edge/type/status/
 * setting currently in *that one board* and reloads exactly what's in
 * `backup`. `backup.boardId`/`boardName` are purely descriptive (the file's
 * own record of where it came from) — restoring never has to target the
 * same board it was exported from, so exporting board A then restoring
 * into a freshly-created board B is a valid way to duplicate a board.
 *
 * Everything below runs inside one transaction — any failure (most likely
 * a FK violation from a hand-edited backup referencing a node type it
 * doesn't itself define) rolls back the whole thing, so a bad restore
 * attempt never leaves the board half-wiped.
 *
 * Goes through db/queries directly rather than nodeService/edgeService's
 * business rules (e.g. edgeService's cycle-detection) — same reasoning as
 * poamImportService: this is reloading an already-valid previously-exported
 * graph, not validating brand-new user input.
 */
export function restoreBackup(
  db: DatabaseSync,
  boardId: string,
  backup: z.infer<typeof fullBackupSchema>
): RestoreResult {
  db.exec("BEGIN");
  try {
    // nodes cascades edges; node_types cascades node_statuses — see
    // 002_dynamic_types.sql's FK definitions. Scoped to this board only —
    // every other board's data is untouched.
    db.prepare("DELETE FROM nodes WHERE board_id = ?").run(boardId);
    db.prepare("DELETE FROM node_types WHERE board_id = ?").run(boardId);
    db.prepare("DELETE FROM app_settings WHERE board_id = ?").run(boardId);

    for (const type of backup.nodeTypes) {
      db.prepare(
        `INSERT INTO node_types (board_id, id, label, color, sort_order) VALUES (@boardId, @id, @label, @color, @sortOrder)`
      ).run({ boardId, id: type.id, label: type.label, color: type.color, sortOrder: type.sortOrder });
    }

    for (const status of backup.statuses) {
      db.prepare(
        `INSERT INTO node_statuses (board_id, id, type_id, value, label, sort_order, is_default)
         VALUES (@boardId, @id, @typeId, @value, @label, @sortOrder, @isDefault)`
      ).run({
        boardId,
        id: status.id,
        typeId: status.typeId,
        value: status.value,
        label: status.label,
        sortOrder: status.sortOrder,
        isDefault: status.isDefault ? 1 : 0,
      });
    }

    for (const node of backup.nodes) {
      nodeQueries.insertNode(db, boardId, {
        id: node.id,
        type: node.type,
        title: node.title,
        description: node.description,
        status: node.status,
        metadata: node.metadata,
        position: node.position,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      });
    }

    for (const edge of backup.edges) {
      edgeQueries.insertEdge(db, boardId, {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        relationshipType: edge.relationshipType,
        label: edge.label,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
      });
    }

    if (backup.appSettings.tileFields !== undefined)
      settingsQueries.setBoardSetting(db, boardId, "tileFields", backup.appSettings.tileFields);
    if (backup.appSettings.theme !== undefined) settingsQueries.setGlobalSetting(db, "theme", backup.appSettings.theme);
    if (backup.appSettings.placementMode !== undefined)
      settingsQueries.setBoardSetting(db, boardId, "placementMode", backup.appSettings.placementMode);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    nodeTypeCount: backup.nodeTypes.length,
    statusCount: backup.statuses.length,
    nodeCount: backup.nodes.length,
    edgeCount: backup.edges.length,
  };
}
