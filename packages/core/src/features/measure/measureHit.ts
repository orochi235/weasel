import type { NodeId, Scene } from 'core/scene/types';
import { measureEndsOf, type MeasureEnd, type MeasurePoint } from './measurement';
import { measureIds, type Measurements } from './measurements';

/** Which part of which measurement lies under a point. */
export interface MeasureHit {
  id: NodeId;
  part: MeasureEnd | 'line';
}

type AnyScene = Scene<unknown, string, unknown>;

function distanceToSegment(p: MeasurePoint, a: MeasurePoint, b: MeasurePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The measurement under `p`, newest first: an end within `tolerance` world
 * units of it, else a line within the same distance. Nothing on a hidden
 * measurement layer is hit.
 */
export function measureAt(
  scene: Pick<AnyScene, 'renderOrderNodes' | 'get' | 'layers'>,
  ms: Pick<Measurements, 'layer'>,
  p: MeasurePoint,
  tolerance: number,
): MeasureHit | null {
  if (scene.layers.find((l) => l.id === ms.layer)?.visible === false) return null;
  const ids = measureIds(scene, ms).reverse();
  for (const id of ids) {
    const ends = measureEndsOf(scene.get(id));
    if (!ends) continue;
    for (const part of ['end', 'start'] as const) {
      if (Math.hypot(p.x - ends[part].x, p.y - ends[part].y) <= tolerance) return { id, part };
    }
  }
  for (const id of ids) {
    const ends = measureEndsOf(scene.get(id));
    if (ends && distanceToSegment(p, ends.start, ends.end) <= tolerance) return { id, part: 'line' };
  }
  return null;
}

/**
 * The measurement end nearest `p` within `tolerance` world units, or null —
 * what a snap rule offers other tools so they can start or end on one.
 * Hand it to `<SceneCanvas toolOptions={{ snapTargets }}>`, where the drawing
 * tools, a move and an anchor drag all reach it.
 */
export function nearestMeasureEnd(
  scene: Pick<AnyScene, 'renderOrderNodes' | 'get' | 'layers'>,
  ms: Pick<Measurements, 'layer'>,
  p: MeasurePoint,
  tolerance: number,
): MeasurePoint | null {
  if (scene.layers.find((l) => l.id === ms.layer)?.visible === false) return null;
  let best: MeasurePoint | null = null;
  let bestD = tolerance;
  for (const id of measureIds(scene, ms)) {
    const ends = measureEndsOf(scene.get(id));
    if (!ends) continue;
    for (const end of [ends.start, ends.end]) {
      const d = Math.hypot(p.x - end.x, p.y - end.y);
      if (d <= bestD) {
        bestD = d;
        best = { x: end.x, y: end.y };
      }
    }
  }
  return best;
}
