/**
 * Screen-space debug overlay rendering the kit's hit-test "slops" — the
 * forgiveness regions around each affordance (corner resize handles,
 * rotation handle, anchor / control-handle markers). Off by default;
 * gated by SceneCanvas's `debug.slops` prop.
 *
 * Each slop is drawn as a translucent filled circle in the same world
 * position the affordance hit-test would accept. Lets developers see
 * exactly how forgiving the click targets are without instrumenting
 * the affordance pipeline.
 */

import type { DrawCommand } from '../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { Path, PolygonPath } from 'features/paths/types';
import { circlePath } from 'features/paths/markers';
import { enumerateAnchors } from 'interactions/actions/edit-anchors/geometry';
import { HANDLE_HIT_RADIUS, ANCHOR_HIT_RADIUS } from './affordanceAt';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from 'interactions/actions/rotate/handle';
import { meanScale } from 'core/viewport/meanScale';

interface View { x: number; y: number; scale: { x: number; y: number } }

export interface CreateSlopsDebugLayerOptions {
  /** Live selection. Slops are computed only for selected ids. */
  selectionRef: React.RefObject<SelectionApi>;
  /** AABB lookup for selected ids (same source the affordance pipeline uses). */
  boundsOf: (id: string) => Bounds | null;
  /** Returns the active editing-id for path-edit chrome, or null. When set
   *  to a polygon id, also renders anchor / control-handle slops. */
  getEditingId: () => string | null;
  /** Returns the pose for a given id — used to pull the polygon path when
   *  the editing target is a polygon-pose node. */
  getPose: (id: string) => Path | null;
}

function w2s(wx: number, wy: number, view: View): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

const SLOP_FILL = 'rgba(255, 80, 140, 0.18)';
const SLOP_STROKE = 'rgba(255, 80, 140, 0.55)';

export function createSlopsDebugLayer(
  opts: CreateSlopsDebugLayerOptions,
): RenderLayer<unknown> {
  return {
    id: 'slops-debug',
    label: 'Slops (debug)',
    space: 'screen',
    draw: (_data, view) => {
      const out: DrawCommand[] = [];
      const sel = opts.selectionRef.current?.current ?? [];

      // Affordance regions declare their hit radii in screen pixels and
      // `hitAffordanceRegions` converts, so this screen-space layer draws
      // them as-is. Scaling here would inflate the halo past the real hit
      // zone at zoom > 1 — the debug overlay's one job is not to lie.
      const r = HANDLE_HIT_RADIUS;

      // Corner resize handles + rotation handle, per selected id.
      // Affordance pipeline only fires rotation when selection.length === 1;
      // mirror that here so the slop overlay matches reality.
      for (const id of sel) {
        const b = opts.boundsOf(id);
        if (!b) continue;
        const corners: [number, number][] = [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ];
        for (const [wx, wy] of corners) {
          const [sx, sy] = w2s(wx, wy, view);
          out.push({
            kind: 'path',
            path: circlePath(sx, sy, r),
            fill: { fill: 'solid', color: SLOP_FILL },
            stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
          });
        }
      }
      if (sel.length === 1) {
        const id = sel[0] as string;
        const b = opts.boundsOf(id);
        if (b) {
          // Rotation handle: top-center, offset upward by rotateDistance
          // (DEFAULT_ROTATION_HANDLE_DISTANCE is in world units in the
          // hit-test; converting back via meanScale gives the same screen
          // position the visible handle uses).
          const cx = b.x + b.width / 2;
          const cy = b.y - DEFAULT_ROTATION_HANDLE_DISTANCE / meanScale(view.scale);
          const [sx, sy] = w2s(cx, cy, view);
          out.push({
            kind: 'path',
            path: circlePath(sx, sy, r),
            fill: { fill: 'solid', color: SLOP_FILL },
            stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
          });
        }
      }

      // Anchor / control-handle slops, when an editing target is active.
      const editingId = opts.getEditingId();
      if (editingId) {
        const anchorR = ANCHOR_HIT_RADIUS;
        const pose = opts.getPose(editingId);
        if (pose && pose.kind === 'polygon') {
          const anchors = enumerateAnchors(pose as PolygonPath);
          for (const a of anchors) {
            const [sx, sy] = w2s(a.x, a.y, view);
            out.push({
              kind: 'path',
              path: circlePath(sx, sy, anchorR),
              fill: { fill: 'solid', color: SLOP_FILL },
              stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
            });
            if (a.controlIn) {
              const [csx, csy] = w2s(a.controlIn.x, a.controlIn.y, view);
              out.push({
                kind: 'path',
                path: circlePath(csx, csy, anchorR),
                fill: { fill: 'solid', color: SLOP_FILL },
                stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
              });
            }
            if (a.controlOut) {
              const [csx, csy] = w2s(a.controlOut.x, a.controlOut.y, view);
              out.push({
                kind: 'path',
                path: circlePath(csx, csy, anchorR),
                fill: { fill: 'solid', color: SLOP_FILL },
                stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
              });
            }
          }
        }
      }

      return out;
    },
  };
}
