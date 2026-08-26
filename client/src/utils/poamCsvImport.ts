import { POAM_CSV_COLUMNS, type RawPoamCsvRow } from "@independance/shared";

/**
 * Maps CSV rows already parsed with header:true (each row keyed by its CSV
 * header text) onto RawPoamCsvRow's internal field ids via POAM_CSV_COLUMNS
 * — the single source of truth for which header means which field. A CSV
 * column not in POAM_CSV_COLUMNS is ignored; a POAM_CSV_COLUMNS field with
 * no matching header (or a blank cell) comes back undefined rather than "",
 * matching bulkImportPoamRowSchema's all-optional shape.
 */
export function mapCsvRowsToPoamRows(csvRows: Record<string, string>[]): RawPoamCsvRow[] {
  return csvRows.map((raw) => {
    const row: RawPoamCsvRow = {};
    for (const { header, field } of POAM_CSV_COLUMNS) {
      const value = raw[header]?.trim();
      if (value) (row as Record<string, string>)[field] = value;
    }
    return row;
  });
}

/** A blank CSV with just the header row, offered as a starting point for a
 * POA&M import file. */
export function buildPoamCsvTemplate(): string {
  return POAM_CSV_COLUMNS.map((c) => c.header).join(",") + "\n";
}
