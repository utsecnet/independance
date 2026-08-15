import { useEffect, useRef, useState } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useGraphStore, type GraphRFEdge, type GraphRFNode } from "../../../state/store";
import { graphNodeTypes } from "./nodes/GraphNodeCard";
import { useGestures } from "./gestures/useGestures";
import styles from "./GraphCanvas.module.css";

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
  const onNodeDragStop = useGraphStore((s) => s.onNodeDragStop);
  const selectNode = useGraphStore((s) => s.selectNode);

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

  if (status === "loading" || status === "idle") {
    return <div className={styles.pane}>Loading graph…</div>;
  }

  return (
    <div className={styles.pane} ref={paneRef}>
      {nodes.length === 0 && (
        <div className={styles.empty}>
          <div>
            <div className={styles.emptyTitle}>No dependency map yet</div>
            <div>Add your first task, project, or POA&amp;M from the left to start mapping.</div>
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
        onNodeDragStop={(_, node) => onNodeDragStop(node.id, node.position)}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        nodeTypes={graphNodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
