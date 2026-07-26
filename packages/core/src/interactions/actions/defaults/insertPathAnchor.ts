/**
 * `insertPathAnchorAction` — alt-click on a path body (while in
 * path-edit mode) inserts a new anchor at the nearest point on the
 * curve. Companion to enter/exitPathEdit; mirrors the Figma /
 * Illustrator convention.
 *
 * Trigger: `{ kind: 'click', mods: { alt: true } }`. Runtime gates:
 *   - `editingId` must be set (a polygon must be in edit mode).
 *   - The clicked node id must equal `editingId` — alt-clicking some
 *     other selected polygon doesn't insert into the active one.
 *   - The polygon's nearest point to the click must be within an
 *     insertion-slop radius (default 16px in world units).
 *
 * When all gates pass, the cubic segment under the click is split via
 * de Casteljau at the parameter `t`. The new path is committed with
 * `createTransformOp` so it goes through the standard undo stack.
 *
 * Limitations: works only for nodes where `pose.kind === 'polygon'`
 * (the same constraint editAnchorsAction has today). Nodes that store
 * the polygon on `data.path` will be supported when the editAnchors
 * dep gains an editable-path abstraction.
 */

import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';
import type { PolygonPath } from 'features/paths/types';
import { pathToAnchors, anchorsToPath, nearestSegmentT } from 'features/paths/anchors';
import { splitCubicAtT } from 'features/paths/cubicMath';

// World-unit slop. If the click is farther than this from the nearest
// curve point, the action no-ops — the user probably wasn't trying to
// insert on this path.
const INSERT_SLOP_PX = 16;

export const insertPathAnchorAction: Action & { requires: string[] } = {
  id: 'insertPathAnchor',
  label: 'Insert anchor',
  defaultBinding: { kind: 'click', mods: { alt: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const dep = deps.editAnchors as EditAnchorsDep | undefined;
      if (!dep) return;
      const editingId = dep.editingId;
      if (!editingId) return;
      const wx = params?.worldX as number | undefined;
      const wy = params?.worldY as number | undefined;
      if (typeof wx !== 'number' || typeof wy !== 'number') return;

      const worldPath = dep.getEditablePath(editingId) as PolygonPath | undefined;
      if (!worldPath || worldPath.kind !== 'polygon') return;
      const polygon = worldPath;

      const decoded = pathToAnchors(polygon);
      const hit = nearestSegmentT(decoded.anchors, wx, wy);
      if (!hit) return;

      // Slop check against the actual closest curve point at `t`.
      const sub = decoded.anchors[hit.sub];
      const a = sub[hit.segIdx];
      const b = sub[hit.segIdx + 1];
      const p0 = a;
      const p1 = a.outHandle ?? a;
      const p2 = b.inHandle ?? b;
      const p3 = b;
      const t = hit.t;
      const u = 1 - t;
      const px = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
      const py = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
      const dx = wx - px;
      const dy = wy - py;
      if (dx * dx + dy * dy > INSERT_SLOP_PX * INSERT_SLOP_PX) return;

      // Split the cubic at `t`. The two new control quartets give us
      // updated handles for the existing anchors and a fresh anchor with
      // its own in/out handles.
      const { left, right } = splitCubicAtT(p0, p1, p2, p3, t);
      a.outHandle = { x: left[1].x, y: left[1].y };
      b.inHandle = { x: right[2].x, y: right[2].y };
      sub.splice(hit.segIdx + 1, 0, {
        x: left[3].x,
        y: left[3].y,
        inHandle: { x: left[2].x, y: left[2].y },
        outHandle: { x: right[1].x, y: right[1].y },
      });

      const newPath = anchorsToPath(decoded.anchors, decoded.closed);
      dep.applyEdit(editingId, newPath, 'Insert anchor');
    },
  } as ImmediateInvoker,
  enabled: () => true,
};
