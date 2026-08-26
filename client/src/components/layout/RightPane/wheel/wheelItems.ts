import type { NodeMetadata, NodeStatus, NodeType, NodeTypeConfig, PlacementMode, RelationshipType } from "@independance/shared";
import type { GraphRFNode } from "../../../../state/store";
import { MAIN_STEP } from "../../../../state/layout";
import { findFreeRow } from "../nodes/QuickAddButton";
import { FilterIcon } from "../FilterMenu";
import { PlusIcon, EditIcon, DeleteIcon, ShuffleIcon } from "./icons";
import type { WheelItem } from "./CommandWheel";

interface CreateNodeInput {
  type: NodeType;
  title: string;
  description?: string;
  status?: NodeStatus;
  metadata?: NodeMetadata;
  position?: { x: number; y: number };
}

type CreateNodeFn = (input: CreateNodeInput) => Promise<GraphRFNode>;
type CreateEdgeFn = (sourceId: string, targetId: string, relationshipType?: RelationshipType) => Promise<void>;

// Fixed synthwave accents (from RETRO_COLOR_PALETTE) for the wheel's
// non-type slices, so every icon carries its own neon glow — node-type
// slices already get one from the type's own configured color.
const FILTER_COLOR = "#4cc9f0";
const TOGGLE_PLACEMENT_COLOR = "#ffd60a";
const EDIT_COLOR = "#7b2ff7";
const DELETE_COLOR = "#ff2e63";

/**
 * The canvas wheel's slices: one per current node type (create it at the
 * right-clicked point) plus Filter and a placement-mode toggle — the three
 * things named when this feature was requested. Manual mode places the new
 * tile at flowPosition; auto mode passes no position and lets arrangeGraph
 * (run by createNode) place it, matching every other create path in the app.
 */
export function buildCanvasWheelItems(
  nodeTypes: NodeTypeConfig[],
  placementMode: PlacementMode,
  flowPosition: { x: number; y: number },
  createNode: CreateNodeFn,
  setPlacementMode: (mode: PlacementMode) => Promise<void>,
  openFilterMenu: () => void
): WheelItem[] {
  const typeItems: WheelItem[] = nodeTypes.map((type) => ({
    id: `create-${type.id}`,
    label: type.label,
    color: type.color,
    icon: PlusIcon(),
    onSelect: () => {
      createNode({ type: type.id, title: "", position: placementMode === "manual" ? flowPosition : undefined });
    },
  }));
  return [
    ...typeItems,
    { id: "filter", label: "Filter", color: FILTER_COLOR, icon: FilterIcon(), onSelect: openFilterMenu },
    {
      id: "toggle-placement",
      label: placementMode === "auto" ? "Switch to Manual" : "Switch to Auto",
      color: TOGGLE_PLACEMENT_COLOR,
      icon: ShuffleIcon(),
      onSelect: () => {
        setPlacementMode(placementMode === "auto" ? "manual" : "auto");
      },
    },
  ];
}

/**
 * The tile wheel's slices: one per node type ("add connected item of type
 * X", mirroring QuickAddButton's own create+link logic and Manual-mode
 * position math exactly, but with one fixed direction — the new tile
 * blocks the right-clicked one — instead of a left/right choice) plus Edit
 * and Delete.
 */
export function buildTileWheelItems(
  nodeTypes: NodeTypeConfig[],
  nodeId: string,
  nodes: GraphRFNode[],
  placementMode: PlacementMode,
  createNode: CreateNodeFn,
  createEdge: CreateEdgeFn,
  startEditing: (id: string) => void,
  deleteNode: (id: string) => Promise<void>
): WheelItem[] {
  const typeItems: WheelItem[] = nodeTypes.map((type) => ({
    id: `add-${type.id}`,
    label: type.label,
    color: type.color,
    icon: PlusIcon(),
    onSelect: async () => {
      const anchorNode = nodes.find((n) => n.id === nodeId);
      let position: { x: number; y: number } | undefined;
      if (placementMode === "manual" && anchorNode) {
        const x = anchorNode.position.x - MAIN_STEP;
        position = { x, y: findFreeRow(nodes, x, anchorNode.position.y) };
      }
      const created = await createNode({ type: type.id, title: "", position });
      await createEdge(created.id, nodeId, "blocks");
    },
  }));
  return [
    ...typeItems,
    { id: "edit", label: "Edit", color: EDIT_COLOR, icon: EditIcon(), onSelect: () => startEditing(nodeId) },
    {
      id: "delete",
      label: "Delete",
      color: DELETE_COLOR,
      icon: DeleteIcon(),
      onSelect: () => {
        deleteNode(nodeId);
      },
    },
  ];
}
