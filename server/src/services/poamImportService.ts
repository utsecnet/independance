import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  SEVERITY_LEVELS,
  type BulkImportPoamRowResult,
  type BulkImportPoamsResult,
  type BulkImportRowNote,
  type RawPoamCsvRow,
} from "@independance/shared";
import * as nodeQueries from "../db/queries/nodes.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import * as statusQueries from "../db/queries/statuses.js";
import { resolveStatusForType } from "./statusService.js";
import { HttpError } from "../middleware/errorHandler.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const US_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function matchSeverity(
  raw: string | undefined,
  notes: BulkImportRowNote[],
  columnLabel: string,
  field: string
): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const match = SEVERITY_LEVELS.find(
    (l) => l.value.toLowerCase() === trimmed.toLowerCase() || l.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (match) return match.value;
  notes.push({ field, message: `${columnLabel} "${trimmed}" not recognized — left blank.` });
  return undefined;
}

function normalizeDateCell(raw: string | undefined, notes: BulkImportRowNote[]): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (ISO_DATE_RE.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) return trimmed;
  const us = trimmed.match(US_DATE_RE);
  if (us) {
    const iso = `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    if (!Number.isNaN(Date.parse(iso))) return iso;
  }
  notes.push({ field: "nextMilestoneDate", message: `Next Milestone Date "${trimmed}" could not be parsed — left blank.` });
  return undefined;
}

function importRow(
  db: DatabaseSync,
  boardId: string,
  row: RawPoamCsvRow,
  rowNumber: number,
  poamStatuses: ReturnType<typeof statusQueries.listStatuses>,
  dryRun: boolean
): BulkImportPoamRowResult {
  const notes: BulkImportRowNote[] = [];
  const title = row.title?.trim() ?? "";
  // The only hard requirement — mirrors NodeCardForm's own client-side rule
  // (`if (!title.trim()) return;`) that a titleless tile never gets saved.
  if (!title) {
    return { row: rowNumber, outcome: "skipped", notes: [{ field: "title", message: "No title — row skipped." }] };
  }

  const description = row.description?.trim() || undefined;

  // resolveStatusForType throws on a defined-but-unrecognized status rather
  // than falling back — coerce an unmatched value to undefined ourselves so
  // it falls back to the type's default status instead of failing the row.
  let status: string | undefined;
  const rawStatus = row.status?.trim();
  if (rawStatus) {
    const match = poamStatuses.find(
      (s) => s.value.toLowerCase() === rawStatus.toLowerCase() || s.label.toLowerCase() === rawStatus.toLowerCase()
    );
    if (match) status = match.value;
    else notes.push({ field: "status", message: `Status "${rawStatus}" not recognized — used the default status instead.` });
  }
  const resolvedStatus = resolveStatusForType(db, boardId, "poam", status);

  const metadata: Record<string, unknown> = {};
  if (row.control?.trim()) metadata.control = row.control.trim();
  if (row.poc?.trim()) metadata.poc = row.poc.trim();
  const severity = matchSeverity(row.severity, notes, "Inherent Risk", "severity");
  if (severity) metadata.severity = severity;
  const residualRisk = matchSeverity(row.residualRisk, notes, "Residual Risk", "residualRisk");
  if (residualRisk) metadata.residualRisk = residualRisk;
  const nextMilestoneDate = normalizeDateCell(row.nextMilestoneDate, notes);
  if (nextMilestoneDate) metadata.nextMilestoneDate = nextMilestoneDate;

  if (dryRun) return { row: rowNumber, outcome: "created", title, notes };

  try {
    const node = nodeQueries.insertNode(db, boardId, {
      id: randomUUID(),
      type: "poam",
      title,
      description,
      status: resolvedStatus,
      metadata,
      // Client re-lays-out the whole map (arrangeGraph) once after the
      // batch lands — no point computing a real position per row here.
      position: { x: 0, y: 0 },
    });
    return { row: rowNumber, outcome: "created", title, nodeId: node.id, node, notes };
  } catch (err) {
    return {
      row: rowNumber,
      outcome: "skipped",
      title,
      notes: [{ field: "title", message: `Could not be created: ${err instanceof Error ? err.message : "unknown error"}` }],
    };
  }
}

export function importPoams(
  db: DatabaseSync,
  boardId: string,
  rows: RawPoamCsvRow[],
  options: { dryRun: boolean }
): BulkImportPoamsResult {
  if (!nodeTypeQueries.getNodeType(db, boardId, "poam")) {
    throw new HttpError(404, "not_found", 'Unknown node type "poam"');
  }
  const poamStatuses = statusQueries.listStatuses(db, boardId, "poam");

  // BEGIN/COMMIT wraps the whole batch purely for write performance (one
  // transaction instead of one autocommit per row for a batch of dozens or
  // hundreds of rows) — it is not the correctness mechanism for best-effort
  // semantics. Each row's own try/catch inside importRow is what turns an
  // unexpected single-row failure into outcome:"skipped" without aborting
  // the rest of the batch; an outer ROLLBACK only fires for something
  // outside that loop (e.g. COMMIT itself failing).
  if (!options.dryRun) db.exec("BEGIN");
  const rowResults: BulkImportPoamRowResult[] = [];
  try {
    rows.forEach((row, i) => rowResults.push(importRow(db, boardId, row, i + 1, poamStatuses, options.dryRun)));
    if (!options.dryRun) db.exec("COMMIT");
  } catch (err) {
    if (!options.dryRun) db.exec("ROLLBACK");
    throw err;
  }

  const createdCount = rowResults.filter((r) => r.outcome === "created").length;
  return {
    dryRun: options.dryRun,
    createdCount,
    skippedCount: rowResults.length - createdCount,
    rows: rowResults,
  };
}
