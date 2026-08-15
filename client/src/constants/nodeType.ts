import type { NodeType } from "@independance/shared";

export const NODE_TYPES: NodeType[] = ["task", "project", "poam"];

export const TYPE_LABEL: Record<NodeType, string> = {
  task: "Task",
  project: "Project",
  poam: "POA&M",
};

export const DEFAULT_TITLE: Record<NodeType, string> = {
  task: "New Task",
  project: "New Project",
  poam: "New POA&M",
};
