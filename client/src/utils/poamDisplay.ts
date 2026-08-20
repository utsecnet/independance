/**
 * A POA&M's row/list label leads with its 800-53 control id (e.g.
 * "AC-2(4)") ahead of its title — "AC-2(4) POAM NAME" — so scanning a list
 * of POA&Ms (the left rail's item list, a Task/Project's POA&Ms tab) surfaces
 * the control first, matching how a paper POA&M log is usually scanned.
 * Falls back to the plain title when no control has been set yet.
 */
export function poamListLabel(title: string, metadata: Record<string, unknown>): string {
  const control = typeof metadata.control === "string" ? metadata.control.trim() : "";
  return control ? `${control} ${title}` : title;
}
