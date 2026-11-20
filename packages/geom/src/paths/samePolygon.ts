import type { PolygonPath } from '../path';
import type { CornerSpec } from './cornerSpec';
import { originOf } from './pathOrigin';

function sameCorners(a: PolygonPath['corners'], b: PolygonPath['corners']): boolean {
  if (a === b) return true;
  const n = Math.max(a?.length ?? 0, b?.length ?? 0);
  for (let i = 0; i < n; i++) {
    const ca: CornerSpec | null = a?.[i] ?? null;
    const cb: CornerSpec | null = b?.[i] ?? null;
    if (ca === cb) continue;
    if (!ca || !cb || ca.shape !== cb.shape || ca.radius !== cb.radius) return false;
  }
  return true;
}

/** Whether `a` and `b` are the same polygon: every field that is part of the shape, the stored coords compared exactly. */
export function samePolygon(a: PolygonPath, b: PolygonPath): boolean {
  if (a === b) return true;
  if (a.fillRule !== b.fillRule || a.openFill !== b.openFill) return false;
  if (!sameCorners(a.corners, b.corners)) return false;
  const oa = originOf(a), ob = originOf(b);
  if (oa.x !== ob.x || oa.y !== ob.y) return false;
  if (a.commands.length !== b.commands.length || a.coords.length !== b.coords.length) return false;
  for (let i = 0; i < a.commands.length; i++) if (a.commands[i] !== b.commands[i]) return false;
  for (let i = 0; i < a.coords.length; i++) if (a.coords[i] !== b.coords[i]) return false;
  return true;
}
