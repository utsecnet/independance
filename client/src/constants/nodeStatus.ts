import type { NodeStatus, NodeType, PoamStatus, TaskProjectStatus } from "@independance/shared";

export const TASK_PROJECT_STATUSES: TaskProjectStatus[] = ["not_started", "in_progress", "blocked", "complete"];

export const POAM_STATUSES: PoamStatus[] = [
  "drafting",
  "assessment",
  "planning",
  "isso_review",
  "issm_review",
  "complete",
];

export const STATUS_LABELS: Record<NodeStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  complete: "Complete",
  drafting: "Drafting",
  assessment: "Assessment",
  planning: "Planning",
  isso_review: "ISSO Review",
  issm_review: "ISSM Review",
};

export function statusOptionsForType(type: NodeType): NodeStatus[] {
  return type === "poam" ? POAM_STATUSES : TASK_PROJECT_STATUSES;
}

export function defaultStatusForType(type: NodeType): NodeStatus {
  return type === "poam" ? "drafting" : "not_started";
}
