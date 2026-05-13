import type { PenScratch } from '../useUserPenTool';
import type { View } from 'core/viewport/view';

const ANCHOR_HIT_RADIUS_PX = 10;
const HANDLE_HIT_RADIUS_PX = 8;
const SEGMENT_HIT_RADIUS_PX = 4;

export interface PenEditHitOverrideCtx {
  worldX: number;
  worldY: number;
  scratch: PenScratch;
  view: View;
  modifiers: unknown;
}

/**
 * Pen tool's hit-test override. Active only in edit mode.
 * Tests anchors first (all visible), then handles (only of selected anchors —
 * handles aren't drawn for unselected anchors, so they shouldn't hit either).
 */
export function penEditHitOverride(
  ctx: PenEditHitOverrideCtx,
): { target: string; extra?: unknown } | null {
  const { scratch, worldX, worldY, view } = ctx;
  if (scratch.mode !== 'edit' || !scratch.edit) return null;

  const anchorR = ANCHOR_HIT_RADIUS_PX / view.scale;
  const handleR = HANDLE_HIT_RADIUS_PX / view.scale;
  const anchorR2 = anchorR * anchorR;
  const handleR2 = handleR * handleR;

  // Anchor hits (any anchor, selected or not).
  for (let s = 0; s < scratch.edit.anchors.length; s++) {
    const sub = scratch.edit.anchors[s];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i];
      const dx = a.x - worldX, dy = a.y - worldY;
      if (dx * dx + dy * dy <= anchorR2) {
        return { target: 'anchor', extra: { sub: s, idx: i } };
      }
    }
  }

  // Handle hits (only for selected anchors).
  for (const key of scratch.edit.selectedAnchors) {
    const [s, i] = key.split(':').map(Number);
    const a = scratch.edit.anchors[s]?.[i];
    if (!a) continue;
    if (a.inHandle) {
      const dx = a.inHandle.x - worldX, dy = a.inHandle.y - worldY;
      if (dx * dx + dy * dy <= handleR2) {
        return { target: 'handle', extra: { sub: s, idx: i, side: 'in' } };
      }
    }
    if (a.outHandle) {
      const dx = a.outHandle.x - worldX, dy = a.outHandle.y - worldY;
      if (dx * dx + dy * dy <= handleR2) {
        return { target: 'handle', extra: { sub: s, idx: i, side: 'out' } };
      }
    }
  }

  const segmentR = SEGMENT_HIT_RADIUS_PX / view.scale;

  // Segment hits — sample each segment at 12 evenly-spaced t and pick the
  // closest. Cheap; the tessellation samples used for rendering are similar
  // granularity and the kit's segment-pick UX has been fine with that.
  const SAMPLES = 12;
  for (let s = 0; s < scratch.edit.anchors.length; s++) {
    const sub = scratch.edit.anchors[s];
    for (let i = 0; i + 1 < sub.length; i++) {
      const a = sub[i], b = sub[i + 1];
      const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
      let bestD2 = Infinity, bestT = 0;
      for (let k = 1; k < SAMPLES; k++) {
        const t = k / SAMPLES;
        const u = 1 - t;
        const px = u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x;
        const py = u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y;
        const dx = px - worldX, dy = py - worldY;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; bestT = t; }
      }
      if (bestD2 <= segmentR * segmentR) {
        return { target: 'segment', extra: { sub: s, segIdx: i, t: bestT } };
      }
    }
  }

  return null;
}
