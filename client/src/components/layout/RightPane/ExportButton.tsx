import { useState } from "react";
import { getViewportForBounds, type ReactFlowInstance } from "@xyflow/react";
import type { GraphRFEdge, GraphRFNode } from "../../../state/store";
import styles from "./ExportButton.module.css";

const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 1200;

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

/**
 * Exports are meant for printing, so they should never carry the dark
 * synthwave theme onto paper. Forces `data-theme="light"` on the root for
 * the duration of `fn`, then restores whatever theme was active. The cover
 * div is appended and the theme flipped in the same synchronous tick (no
 * `await` between them) specifically so the browser can't paint an
 * intermediate frame of the live app switching theme — it goes straight
 * from "current theme" to "covered" with nothing visible in between.
 */
async function withPrintTheme<T>(fn: () => Promise<T>): Promise<T> {
  const cover = document.createElement("div");
  Object.assign(cover.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#14121c",
    color: "#f2effa",
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
  } satisfies Partial<CSSStyleDeclaration>);
  cover.textContent = "Preparing export…";
  document.body.appendChild(cover);

  const root = document.documentElement;
  const priorTheme = root.dataset.theme;
  root.dataset.theme = "light";

  try {
    return await fn();
  } finally {
    if (priorTheme) root.dataset.theme = priorTheme;
    else delete root.dataset.theme;
    cover.remove();
  }
}

async function captureGraphPng(rfInstance: ReactFlowInstance<GraphRFNode, GraphRFEdge>): Promise<string> {
  // html-to-image is only ever needed once someone actually exports, which
  // is a rare action compared to just using the map — loading it on demand
  // instead of bundling it into the app's main chunk keeps it off the
  // critical path for every other page load.
  const { toPng } = await import("html-to-image");

  const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl) throw new Error("Nothing to export yet");

  const bounds = rfInstance.getNodesBounds(rfInstance.getNodes());
  const viewport = getViewportForBounds(bounds, EXPORT_WIDTH, EXPORT_HEIGHT, 0.1, 2, 0.1);
  const background = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#ffffff";

  // html-to-image clones the DOM and re-applies computed styles, but for SVG
  // elements it doesn't reliably carry over CSS-class-driven `stroke` values
  // (React Flow's edge paths are styled via `var(--xy-edge-stroke-default)`
  // in an external stylesheet) — the edge lines silently vanish from the
  // exported image even though handles and node borders (styled via inline
  // `style` attributes) come through fine. Pinning each path's already-
  // resolved stroke as a literal inline style before capture sidesteps that,
  // then it's reverted so on-screen rendering is unaffected.
  const edgePaths = Array.from(viewportEl.querySelectorAll<SVGPathElement>(".react-flow__edge-path"));
  const priorStyles = edgePaths.map((path) => ({ stroke: path.style.stroke, strokeWidth: path.style.strokeWidth }));
  edgePaths.forEach((path) => {
    const computed = getComputedStyle(path);
    path.style.stroke = computed.stroke;
    path.style.strokeWidth = computed.strokeWidth;
  });

  try {
    return await toPng(viewportEl, {
      backgroundColor: background,
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      style: {
        width: `${EXPORT_WIDTH}px`,
        height: `${EXPORT_HEIGHT}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
  } finally {
    edgePaths.forEach((path, i) => {
      path.style.stroke = priorStyles[i].stroke;
      path.style.strokeWidth = priorStyles[i].strokeWidth;
    });
  }
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

interface ExportButtonProps {
  rfInstance: ReactFlowInstance<GraphRFNode, GraphRFEdge> | null;
}

export function ExportButton({ rfInstance }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExportPng() {
    if (!rfInstance) return;
    setOpen(false);
    setExporting(true);
    setError(null);
    try {
      const dataUrl = await withPrintTheme(() => captureGraphPng(rfInstance));
      triggerDownload(dataUrl, "dependency-map.png");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export image");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    if (!rfInstance) return;
    setOpen(false);
    setExporting(true);
    setError(null);
    try {
      // Same rationale as html-to-image above — jsPDF is only needed for
      // this one action, so it's loaded on demand rather than eagerly.
      const { jsPDF } = await import("jspdf");
      const dataUrl = await withPrintTheme(() => captureGraphPng(rfInstance));
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [EXPORT_WIDTH, EXPORT_HEIGHT],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
      pdf.save("dependency-map.pdf");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        disabled={exporting}
        aria-label="Export graph"
        title="Export graph"
      >
        <ExportIcon />
      </button>
      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            <button type="button" className={styles.menuItem} onClick={handleExportPng}>
              Export as PNG
            </button>
            <button type="button" className={styles.menuItem} onClick={handleExportPdf}>
              Export as PDF
            </button>
          </div>
        </>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
