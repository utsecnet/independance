import { useEffect } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useGraphStore } from "../../../state/store";
import { graphNodeTypes } from "./nodes/GraphNodeCard";
import styles from "./GraphCanvas.module.css";

export function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const status = useGraphStore((s) => s.status);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const onNodesDelete = useGraphStore((s) => s.onNodesDelete);
  const onEdgesDelete = useGraphStore((s) => s.onEdgesDelete);
  const selectNode = useGraphStore((s) => s.selectNode);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  if (status === "loading" || status === "idle") {
    return <div className={styles.pane}>Loading graph…</div>;
  }

  return (
    <div className={styles.pane}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
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
