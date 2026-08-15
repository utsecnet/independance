import { useEffect, useRef, useState } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeType } from "@independance/shared";
import { useGraphStore, type GraphRFEdge, type GraphRFNode } from "../../../state/store";
import { DEFAULT_TITLE } from "../../../constants/nodeType";
import { defaultStatusForType } from "../../../constants/nodeStatus";
import { graphNodeTypes } from "./nodes/GraphNodeCard";
import { useGestures } from "./gestures/useGestures";
import { CreateNodeButton } from "./CreateNodeButton";
import styles from "./GraphCanvas.module.css";

const NEW_NODE_OFFSET = { x: -90, y: -50 };

export function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const status = useGraphStore((s) => s.status);
  const selectedId = useGraphStore((s) => s.selectedId);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const onNodesDelete = useGraphStore((s) => s.onNodesDelete);
  const onEdgesDelete = useGraphStore((s) => s.onEdgesDelete);
  const onNodeDragStart = useGraphStore((s) => s.onNodeDragStart);
  const onNodeDrag = useGraphStore((s) => s.onNodeDrag);
  const onNodeDragStop = useGraphStore((s) => s.onNodeDragStop);
  const selectNode = useGraphStore((s) => s.selectNode);
  const createNode = useGraphStore((s) => s.createNode);

  const paneRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<GraphRFNode, GraphRFEdge> | null>(null);

  useGestures(paneRef.current, rfInstance);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!rfInstance || !selectedId) return;
    rfInstance.fitView({ nodes: [{ id: selectedId }], duration: 400, maxZoom: 1.2 });
  }, [rfInstance, selectedId]);

  // React Flow's deleteKeyCode only removes nodes it considers internally
  // "selected" (node.selected), which requires a selection NodeChange to
  // have gone through onNodesChange — but our nodes never get that flag set
  // (clicking a tile drives its own selectedId/expand state directly via
  // onNodeClick, never a real RF selection change), so Delete silently did
  // nothing for tiles even though it already worked for edges via RF's own
  // mechanism. Handling it ourselves off the same selectedId that already
  // drives which tile is expanded keeps this in sync by construction. Uses
  // deleteNode (not onNodesDelete) since onNodesDelete only makes the API
  // call and expects RF's own remove-NodeChange dispatch to strip the node
  // from local state — a step that only happens inside RF's internal
  // delete flow, not when called directly like this.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete") return;
      const active = document.activeElement;
      const isEditableFocused =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable);
      if (isEditableFocused) return;

      const state = useGraphStore.getState();
      if (state.selectedId) {
        state.deleteNode(state.selectedId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Plain scroll still zooms (React Flow's default). Shift+scroll pans
  // horizontally and Ctrl+scroll pans vertically instead — neither has a
  // matching built-in React Flow prop (panOnScroll only supports a single
  // modifier that toggles pan vs. zoom), so both are handled here directly,
  // capturing the wheel event before it reaches React Flow's own handler.
  useEffect(() => {
    const paneEl = paneRef.current;
    const instance = rfInstance;
    if (!paneEl || !instance) return;

    function handleWheel(event: WheelEvent) {
      if (!event.shiftKey && !event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const { x, y, zoom } = instance!.getViewport();
      if (event.shiftKey) {
        instance!.setViewport({ x: x - event.deltaY, y, zoom }, { duration: 0 });
      } else {
        instance!.setViewport({ x, y: y - event.deltaY, zoom }, { duration: 0 });
      }
    }

    paneEl.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => paneEl.removeEventListener("wheel", handleWheel, { capture: true });
  }, [rfInstance]);

  function handleCreate(type: NodeType) {
    const paneEl = paneRef.current;
    let position = { x: 0, y: 0 };
    if (rfInstance && paneEl) {
      const rect = paneEl.getBoundingClientRect();
      const center = rfInstance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      position = { x: center.x + NEW_NODE_OFFSET.x, y: center.y + NEW_NODE_OFFSET.y };
    }
    createNode({ type, title: DEFAULT_TITLE[type], status: defaultStatusForType(type), position });
  }

  if (status === "loading" || status === "idle") {
    return <div className={styles.pane}>Loading graph…</div>;
  }

  return (
    <div className={styles.pane} ref={paneRef}>
      <CreateNodeButton onCreate={handleCreate} />
      {nodes.length === 0 && (
        <div className={styles.empty}>
          <div>
            <div className={styles.emptyTitle}>No dependency map yet</div>
            <div>Click the + button in the top-left to start mapping.</div>
          </div>
        </div>
      )}
      <ReactFlow<GraphRFNode, GraphRFEdge>
        nodes={nodes}
        edges={edges}
        onInit={setRfInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStart={(_, node) => onNodeDragStart(node.id, node.position)}
        onNodeDrag={(_, node) => onNodeDrag(node.id, node.position)}
        onNodeDragStop={(_, node) => onNodeDragStop(node.id, node.position)}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        nodeTypes={graphNodeTypes}
        deleteKeyCode="Delete"
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          bgColor="var(--surface)"
          maskColor="rgba(0, 0, 0, 0.3)"
          nodeColor="var(--text-dim)"
          nodeStrokeColor="var(--accent-cyan)"
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}
