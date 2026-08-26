import { useEffect, useRef, useState } from "react";
import { MAX_BULK_IMPORT_ROWS, type BulkImportPoamsResult, type RawPoamCsvRow } from "@independance/shared";
import { nodesApi } from "../../../api/nodes";
import { useGraphStore } from "../../../state/store";
import { buildPoamCsvTemplate, mapCsvRowsToPoamRows } from "../../../utils/poamCsvImport";
import styles from "./ImportPoamsModal.module.css";

type Step = "upload" | "preview" | "result";

function downloadTemplate() {
  const blob = new Blob([buildPoamCsvTemplate()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "poam-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// papaparse is a CJS package — Vite's dep pre-bundling normally synthesizes
// a `default` export for it, but falling back to the module namespace
// itself covers the case where it doesn't.
async function parseCsv(text: string): Promise<Record<string, string>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("papaparse");
  const Papa = mod.default ?? mod;
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message || "Could not parse this CSV file.");
  }
  return result.data as Record<string, string>[];
}

interface ImportPoamsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportPoamsModal({ open, onClose }: ImportPoamsModalProps) {
  const importPoamNodes = useGraphStore((s) => s.importPoamNodes);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RawPoamCsvRow[]>([]);
  const [preview, setPreview] = useState<BulkImportPoamsResult | null>(null);
  const [result, setResult] = useState<BulkImportPoamsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName(null);
    setRows([]);
    setPreview(null);
    setResult(null);
    setBusy(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const csvRows = await parseCsv(text);
      const mapped = mapCsvRowsToPoamRows(csvRows);
      if (mapped.length === 0) {
        throw new Error("No data rows found in this file.");
      }
      if (mapped.length > MAX_BULK_IMPORT_ROWS) {
        throw new Error(`This file has ${mapped.length} rows — the limit is ${MAX_BULK_IMPORT_ROWS} per import.`);
      }
      const dryRunResult = await nodesApi.bulkImportPoams({ rows: mapped, dryRun: true });
      setRows(mapped);
      setPreview(dryRunResult);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read this CSV file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const commitResult = await nodesApi.bulkImportPoams({ rows, dryRun: false });
      setResult(commitResult);
      const createdNodes = commitResult.rows.filter((r) => r.outcome === "created" && r.node).map((r) => r.node!);
      await importPoamNodes(createdNodes);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const shown = step === "result" ? result : preview;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Import POA&amp;Ms from CSV</h2>
          <button type="button" className={styles.closeButton} onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.content}>
          {step === "upload" && (
            <>
              <p className={styles.hint}>
                Columns should match the POA&amp;M fields: Title, Description, Status, Control, Inherent Risk,
                Residual Risk, POC, Next Milestone Date. Only Title is required — everything else is best-effort.
              </p>
              <button type="button" className={styles.linkButton} onClick={downloadTemplate}>
                Download CSV template
              </button>
              <div className={styles.uploadRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={busy}
                  className={styles.fileInput}
                  id="poam-csv-file"
                />
                <label htmlFor="poam-csv-file" className={styles.fileButton}>
                  {busy ? "Reading…" : "Choose CSV file"}
                </label>
                {fileName && !busy && <span className={styles.fileName}>{fileName}</span>}
              </div>
              {error && <div className={styles.error}>{error}</div>}
            </>
          )}

          {(step === "preview" || step === "result") && shown && (
            <>
              <div className={styles.summary}>
                {step === "preview"
                  ? `${shown.createdCount} row${shown.createdCount === 1 ? "" : "s"} will be imported, ${shown.skippedCount} will be skipped.`
                  : `${shown.createdCount} row${shown.createdCount === 1 ? "" : "s"} imported, ${shown.skippedCount} skipped.`}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Result</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.rows.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.title || <span className={styles.muted}>—</span>}</td>
                        <td>
                          {r.outcome === "created" ? (
                            <span className={styles.badgeOk}>{step === "preview" ? "Will import" : "Imported"}</span>
                          ) : (
                            <span className={styles.badgeSkip}>{step === "preview" ? "Will skip" : "Skipped"}</span>
                          )}
                        </td>
                        <td>
                          {r.notes.length === 0 ? (
                            <span className={styles.muted}>—</span>
                          ) : (
                            <ul className={styles.notes}>
                              {r.notes.map((n, i) => (
                                <li key={i}>{n.message}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <div className={styles.error}>{error}</div>}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {step === "upload" && (
            <button type="button" className={styles.secondaryButton} onClick={handleClose}>
              Cancel
            </button>
          )}
          {step === "preview" && (
            <>
              <button type="button" className={styles.secondaryButton} onClick={handleClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleImport} disabled={busy}>
                {busy ? "Importing…" : `Import ${preview?.createdCount ?? 0} row${preview?.createdCount === 1 ? "" : "s"}`}
              </button>
            </>
          )}
          {step === "result" && (
            <button type="button" className={styles.primaryButton} onClick={handleClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
