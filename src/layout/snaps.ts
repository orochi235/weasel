import type { DropTarget, LayoutSnap } from './types';

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function nearestOf<TPose>(
  targets: DropTarget<TPose>[],
  pointer: { x: number; y: number },
): DropTarget<TPose> | null {
  if (targets.length === 0) return null;
  let best = targets[0];
  let bestD = dist2(best.origin, pointer);
  for (let i = 1; i < targets.length; i++) {
    const d = dist2(targets[i].origin, pointer);
    if (d < bestD) {
      bestD = d;
      best = targets[i];
    }
  }
  return best;
}

export function none<TPose>(): LayoutSnap<TPose> {
  return { pickTarget: () => null };
}

export function nearest<TPose>(): LayoutSnap<TPose> {
  return { pickTarget: (targets, pointer) => nearestOf(targets, pointer) };
}

export function nearestWithin<TPose>(opts: { tolerance: number }): LayoutSnap<TPose> {
  const tol2 = opts.tolerance * opts.tolerance;
  return {
    pickTarget(targets, pointer) {
      const got = nearestOf(targets, pointer);
      if (got === null) return null;
      return dist2(got.origin, pointer) <= tol2 ? got : null;
    },
  };
}

interface CellMeta {
  cellRect: { x: number; y: number; width: number; height: number };
}

function isCellMeta(m: unknown): m is CellMeta {
  return (
    typeof m === 'object' &&
    m !== null &&
    'cellRect' in m &&
    typeof (m as { cellRect: unknown }).cellRect === 'object'
  );
}

export function cellAt<TPose>(): LayoutSnap<TPose> {
  return {
    pickTarget(targets, pointer) {
      for (const t of targets) {
        if (!isCellMeta(t.meta)) continue;
        const r = t.meta.cellRect;
        if (
          pointer.x >= r.x &&
          pointer.x < r.x + r.width &&
          pointer.y >= r.y &&
          pointer.y < r.y + r.height
        ) {
          return t;
        }
      }
      return nearestOf(targets, pointer);
    },
  };
}
