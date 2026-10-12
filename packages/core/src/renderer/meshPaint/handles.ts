/**
 * The draggable points of a mesh paint, as pure geometry — what an on-canvas
 * editor lists, and what moving one of them does to the paint.
 *
 * Nothing here knows a frame: the handles are in whatever space the mesh's
 * points are, so a caller resolves a `'bounds'` mesh onto its box first
 * (`fillInPoseFrame`) and normalizes the result back (`fillToBoundsFrame`).
 */

import type { MeshGradientFill } from './meshPaint';
import { isTensorPatch, isValidPatch, type MeshPatch, type MeshPoint } from './surface';

/** What a handle moves: a patch corner, one of the two controls of an edge,
 *  or one of a tensor patch's four interior points. */
export type MeshHandleKind = 'corner' | 'control' | 'interior';

/** One stored point: `patches[patch].points[index]`. */
export interface MeshPointRef {
  patch: number;
  index: number;
}

/**
 * One draggable point.
 *
 * Patches store their points in full rather than sharing edges, so two
 * patches that meet each carry a copy of the corner and controls they meet
 * at. Those copies are one handle, with a `ref` per copy — dragging one of
 * them alone would tear the surface open along the seam.
 */
export interface MeshHandle {
  /** Stable while the handle moves: its first ref, as `"patch:index"`. */
  id: string;
  kind: MeshHandleKind;
  at: MeshPoint;
  refs: readonly MeshPointRef[];
}

/** Corner `k`'s interior neighbor in the tensor net. PDF's trailing four walk
 *  the net as (1,1) (1,2) (2,2) (2,1), which puts corner 1's at index 15 and
 *  corner 3's at 13 — the transpose of the obvious reading. */
const INTERIOR_OF_CORNER = [12, 15, 14, 13] as const;

function kindOf(index: number): MeshHandleKind {
  if (index >= 12) return 'interior';
  return index % 3 === 0 ? 'corner' : 'control';
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function same(a: MeshPoint, b: MeshPoint): boolean {
  return near(a.x, b.x) && near(a.y, b.y);
}

/**
 * Every draggable point of `mesh`, in walk order: each patch's corners and
 * edge controls, then a tensor patch's interior. Coincident points of one
 * kind merge into one handle. A patch that cannot be evaluated has none.
 */
export function meshHandles(mesh: MeshGradientFill): MeshHandle[] {
  const handles: { id: string; kind: MeshHandleKind; at: MeshPoint; refs: MeshPointRef[] }[] = [];
  mesh.patches.forEach((patch, p) => {
    if (!isValidPatch(patch)) return;
    patch.points.forEach((at, index) => {
      const kind = kindOf(index);
      const twin = handles.find((h) => h.kind === kind && same(h.at, at));
      if (twin) twin.refs.push({ patch: p, index });
      else handles.push({ id: `${p}:${index}`, kind, at, refs: [{ patch: p, index }] });
    });
  });
  return handles;
}

/** The points a corner carries: the controls of the two edges it joins, and
 *  its interior neighbor when the patch has one. */
function carriedBy(patch: MeshPatch, corner: number): number[] {
  const k = corner / 3;
  const carried = [corner + 1, (corner + 11) % 12];
  if (isTensorPatch(patch)) carried.push(INTERIOR_OF_CORNER[k]);
  return carried;
}

/**
 * `mesh` with `handle` moved to `to`. A corner carries its edge controls
 * and interior neighbor along by the same offset, the way a path editor's
 * anchor carries its handles; a control or interior point moves alone.
 * Returns a new paint; `mesh` is not modified.
 */
export function moveMeshHandle(
  mesh: MeshGradientFill, handle: MeshHandle, to: MeshPoint,
): MeshGradientFill {
  const dx = to.x - handle.at.x;
  const dy = to.y - handle.at.y;
  const placed = new Map<string, MeshPoint>();
  for (const { patch, index } of handle.refs) {
    placed.set(`${patch}:${index}`, to);
  }
  if (handle.kind === 'corner') {
    for (const { patch, index } of handle.refs) {
      for (const carried of carriedBy(mesh.patches[patch], index)) {
        const key = `${patch}:${carried}`;
        if (placed.has(key)) continue;
        const from = mesh.patches[patch].points[carried];
        placed.set(key, { x: from.x + dx, y: from.y + dy });
      }
    }
  }
  return {
    ...mesh,
    patches: mesh.patches.map((patch, p) => ({
      ...patch,
      points: patch.points.map((point, i) => placed.get(`${p}:${i}`) ?? point),
    })),
  };
}

/** The lines an editor draws under the handles, as control polygons. */
export interface MeshGuides {
  /** Every patch edge as its four cubic control points, from the corner it
   *  leaves to the corner it reaches. */
  edges: [MeshPoint, MeshPoint, MeshPoint, MeshPoint][];
  /** Corner to each point it carries — an edge control or interior point. */
  arms: [MeshPoint, MeshPoint][];
}

/** The guides for `mesh`'s valid patches. Shared edges appear once per patch. */
export function meshGuides(mesh: MeshGradientFill): MeshGuides {
  const edges: MeshGuides['edges'] = [];
  const arms: MeshGuides['arms'] = [];
  for (const patch of mesh.patches) {
    if (!isValidPatch(patch)) continue;
    const p = patch.points;
    for (let k = 0; k < 4; k++) {
      const corner = k * 3;
      edges.push([p[corner], p[corner + 1], p[corner + 2], p[(corner + 3) % 12]]);
      for (const carried of carriedBy(patch, corner)) arms.push([p[corner], p[carried]]);
    }
  }
  return { edges, arms };
}
