/**
 * Where the Nth of `total` wheel items sits, `radius` px out from the
 * wheel's center — 12 o'clock, clockwise. Pulled out of CommandWheel's
 * render so the angle math has a single, independently-testable home, same
 * as GraphCanvas's own snapToCenterGrid/avoidRowCollision.
 */
export function wheelItemPosition(index: number, total: number, radius: number): { x: number; y: number } {
  const angle = ((360 / total) * index - 90) * (Math.PI / 180);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/**
 * How far a slice's own footprint can extend from the wheel's anchor point
 * in any direction, regardless of item count — CommandWheel's RADIUS (64)
 * plus roughly half an item's own box (its 52px-wide label wrapper; its
 * ~50px-tall icon+gap+label stack). Doesn't scale with the number of items
 * since they're always arranged around the same fixed-radius ring. Used to
 * keep the wheel from opening so close to the window edge that some slices
 * render off-screen — nothing clips or scrolls to bring them back into
 * view, so an off-screen slice is simply unreachable.
 */
export const WHEEL_EDGE_MARGIN = 100;

/**
 * Nudges a raw viewport point inward so a box of `margin` px around it
 * (in every direction) fits within a `viewportWidth` x `viewportHeight`
 * window. Falls back to centering (viewport/2) rather than clamping past
 * itself when the viewport is smaller than 2*margin, so a tiny window still
 * gets a sane, on-screen anchor instead of min/max fighting to a negative
 * range.
 */
export function clampToViewport(
  point: { x: number; y: number },
  margin: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const clampAxis = (value: number, size: number) =>
    size <= margin * 2 ? size / 2 : Math.min(Math.max(value, margin), size - margin);
  return {
    x: clampAxis(point.x, viewportWidth),
    y: clampAxis(point.y, viewportHeight),
  };
}
