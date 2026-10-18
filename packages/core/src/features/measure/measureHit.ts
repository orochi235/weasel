import type { NodeId, Scene } from 'core/scene/types';
import { measureEndsOf, type MeasureEnd, type MeasurePoint } from './measurement';
import { measureIds, type Measurements } from './measurements';
import { nodeGates } from 'core/scene/nodeGates';
import type { SnapSource } from 'features/snap/types';

/** Which part of which measurement lies under a point. */
export interface MeasureHit {
  id: NodeId;
  part: MeasureEnd | 'line';
}


function distanceToSegment(p: MeasurePoint, a: MeasurePoint, b: MeasurePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The measurement under `p`, newest first: an end within `tolerance` world
 * units of it, else a line within the same distance. A hidden or locked
 * measurement (`nodeGates`) is passed over.
 */
export function measureAt(
  scene: Pick<Scene<unknown, string, unknown>, 'renderOrderNodes' | 'get' | 'layers'>,
  ms: Pick<Measurements, 'layer'>,
  p: MeasurePoint,
  tolerance: number,
): MeasureHit | null {
  const gates = nodeGates(scene);
  const ids = measureIds(scene, ms).reverse().filter((id) => !gates.hidden(id) && !gates.locked(id));
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

/** Options for `measureEndSource`. */
export interface MeasureEndSourceOptions {
  /** Overrides the canvas's reach for measurement ends, in screen px. */
  reachPx?: number;
}

/** The ends of every shown measurement as snap targets for a pointer probe. */
export function measureEndSource(opts: MeasureEndSourceOptions = {}): SnapSource {
  return {
    id: 'measure-ends',
    roles: ['pointer'],
    ...(opts.reachPx !== undefined ? { reachPx: opts.reachPx } : {}),
    *collect(q) {
      if (!q.scene) return;
      const gates = nodeGates(q.scene);
      const skip = new Set(q.exclude);
      const reach = q.reachWorld(q.reachPx);
      for (const node of q.scene.renderOrderNodes()) {
        const ends = measureEndsOf(node);
        if (!ends || skip.has(node.id) || gates.hidden(node.id)) continue;
        for (const end of [ends.start, ends.end]) {
          const at = { x: end.x, y: end.y };
          for (const p of q.probes) {
            if (Math.hypot(at.x - p.at.x, at.y - p.at.y) > reach) continue;
            yield { probe: p.id, locus: { at, dirs: [] }, mark: { kind: 'point', at, glyph: 'center' } };
          }
        }
      }
    },
  };
}
