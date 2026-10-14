/**
 * What the width tool reads and writes: the stroke under a point, the stop a
 * press takes hold of, and the profile a drag leaves behind.
 */
import type { PolygonPath } from '@weasel-js/geom';
import {
  normalizeWidthProfile, removeWidthStop, setWidthStop, widthProfileAt,
  type Stroke, type WidthProfile, type WidthStop,
} from '@weasel-js/paint';
import { nearestStrokeSite, resolveStrokeWidth, strokeSitesAt, type StrokeSite } from '@weasel-js/stroke';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { resolveEditablePathOf } from 'features/paths/editablePath';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

/** A stroked path node, its centerline in world space, and its stroke's
 *  width there. */
export interface WidthTarget {
  id: NodeId;
  node: AnyNode;
  path: PolygonPath;
  stroke: Stroke;
  /** `stroke.width` in world units, the unit a profile's widths multiply. */
  base: number;
}

/** The stroke a press at `(x, y)` lands on, and where on it. */
export interface WidthHit {
  target: WidthTarget;
  site: StrokeSite;
}

/** The node's stroke, when it paints one along an editable path. */
function targetOf(scene: AnyScene, node: AnyNode, scale: number): WidthTarget | null {
  if (node.kind !== 'leaf' || node.derivePath || node.derivePose || scene.isLocked(node.id)) return null;
  const stroke = (node.data as { stroke?: Stroke | null } | null)?.stroke;
  if (!stroke?.paint) return null;
  const base = resolveStrokeWidth(stroke.width ?? 1, scale);
  if (!(base > 0)) return null;
  const path = resolveEditablePathOf(node);
  return path ? { id: node.id, node, path, stroke, base } : null;
}

/**
 * The topmost stroke whose ink is within `reach` of `(x, y)`, with the point
 * on its centerline nearest there. `scale` resolves a `{ px }` width.
 */
export function widthHitAt(scene: AnyScene, x: number, y: number, scale: number, reach: number): WidthHit | null {
  const nodes = scene.renderOrderNodes();
  for (let i = nodes.length - 1; i >= 0; i--) {
    const target = targetOf(scene, nodes[i], scale);
    if (!target) continue;
    const site = nearestStrokeSite(target.path, x, y);
    if (!site) continue;
    const half = (target.base * widthProfileAt(target.stroke.widthProfile ?? [], site.t)) / 2;
    if (site.distance <= half + reach) return { target, site };
  }
  return null;
}

/** The `t` of the stop within `reach` of `site` along its subpath, or
 *  `site.t` for a new one. */
export function grabbedT(profile: WidthProfile, site: StrokeSite, reach: number): number {
  let best = site.t;
  let bestGap = site.length > 0 ? reach / site.length : 0;
  for (const s of profile) {
    const gap = Math.abs(s.t - site.t);
    if (gap <= bestGap) { bestGap = gap; best = s.t; }
  }
  return best;
}

/** The index of the stop within `reach` of `site`, or -1. */
export function stopIndexNear(profile: WidthProfile, site: StrokeSite, reach: number): number {
  const t = grabbedT(profile, site, reach);
  return profile.findIndex((s) => s.t === t);
}

/**
 * `profile` with the stop at `t` set so the stroke there is as wide as
 * `pointer` is far from the centerline either side. An empty profile first
 * gets level stops at both ends, so a drag swells the stroke where it is
 * rather than everywhere.
 */
export function profileDraggedTo(
  target: WidthTarget, subpath: number, t: number, pointer: { x: number; y: number },
): WidthStop[] {
  const at = strokeSitesAt(target.path, t)[subpath];
  if (!at) return [...(target.stroke.widthProfile ?? [])];
  const width = (2 * Math.hypot(pointer.x - at.x, pointer.y - at.y)) / target.base;
  const start = target.stroke.widthProfile?.length
    ? target.stroke.widthProfile
    : [{ t: 0, width: 1 }, { t: 1, width: 1 }];
  return setWidthStop(start, t, width, 1e-9);
}

/** `profile` without the stop at `index`, or `undefined` when none is left. */
export function profileWithout(profile: WidthProfile, index: number): WidthStop[] | undefined {
  const rest = normalizeWidthProfile(removeWidthStop(profile, index));
  return rest.length > 0 ? rest : undefined;
}

/** `target`'s node data with its stroke's profile replaced. */
export function dataWithProfile(target: WidthTarget, profile: WidthProfile | undefined): unknown {
  const { widthProfile: _old, ...rest } = target.stroke;
  void _old;
  const stroke: Stroke = profile ? { ...rest, widthProfile: profile } : rest;
  return { ...(target.node.data as object), stroke };
}
