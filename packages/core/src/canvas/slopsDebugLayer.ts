/**
 * Screen-space debug overlay rendering the kit's hit-test "slops" — the
 * forgiveness regions around each affordance (corner resize handles,
 * rotation handle, anchor / control-handle markers). Off by default;
 * gated by SceneCanvas's `debug.slops` prop.
 *
 * Each slop is drawn as a translucent screen-axis square in the same world
 * position the affordance hit-test would accept. Lets developers see
 * exactly how forgiving the click targets are without instrumenting
 * the affordance pipeline.
 */

import type { DrawCommand } from '../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { Path, PolygonPath } from 'features/paths/types';
import type { GesturePreviewSource } from './gestureBounds';
import { chromeStateFrom, previewSourcesFrom } from './drawEnvelope';
import { rectCorners, rotatePoint } from 'interactions/actions/rotate/geometry';
import { enumerateAnchors } from 'interactions/actions/edit-anchors/geometry';
import { targetSizesPx } from 'core/device/targets';
import { rotationHandle } from 'interactions/actions/rotate/handle';

interface View { x: number; y: number; scale: { x: number; y: number } }

export interface CreateSlopsDebugLayerOptions {
  /** Returns the active editing-id for path-edit chrome, or null. When set
   *  to a polygon id, also renders anchor / control-handle slops. */
  getEditingId: () => string | null;
  /** Returns the pose for a given id — used to pull the polygon path when
   *  the editing target is a polygon-pose node. `previews` are the drawing
   *  view's in-flight preview surfaces. */
  getPose: (id: string, previews: readonly GesturePreviewSource[]) => Path | null;
  /** Pointer-size multiplier from the live `DeviceProfile`. Resolves the same
   *  sizes `buildAffordanceAt` hit-tests with. Default 1. */
  targetScale?: number;
  /** The rotate badge the selection overlay paints (`rotationBadgeOf`), which
   *  is grabbable where it is drawn. Omitted or null, there is no badge and no
   *  halo for one. */
  rotationBadge?: { distancePx: number; sizePx: number } | null;
}

function w2s(wx: number, wy: number, view: View): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

const SLOP_FILL = 'rgba(255, 80, 140, 0.18)';
const SLOP_STROKE = 'rgba(255, 80, 140, 0.55)';

/** A halo for a point region: a screen-axis square of half-extent `r`, which
 *  is the shape `hitAffordanceRegions` tests. */
function slop(sx: number, sy: number, r: number): DrawCommand {
  return {
    kind: 'path',
    path: { kind: 'rect', x: sx - r, y: sy - r, width: 2 * r, height: 2 * r },
    fill: { fill: 'solid', color: SLOP_FILL },
    stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
  };
}

export function createSlopsDebugLayer(
  opts: CreateSlopsDebugLayerOptions,
): RenderLayer<unknown> {
  return {
    id: 'slops-debug',
    label: 'Slops (debug)',
    space: 'screen',
    draw: (data, view) => {
      const out: DrawCommand[] = [];
      // Selection and bounds come off the envelope: the halos have to sit on
      // the chrome the drawing view actually painted, and a debug overlay's
      // one job is not to lie.
      const chrome = chromeStateFrom(data);
      const sel = chrome?.selection ?? [];
      const boundsOf = (id: string) => chrome?.boundsOf(id) ?? null;

      // Affordance regions declare their hit radii in screen pixels and
      // `hitAffordanceRegions` converts, so this screen-space layer draws
      // them as-is. Scaling by the *view* here would inflate the halo past
      // the real hit zone at zoom > 1 — the debug overlay's one job is not
      // to lie.
      const sizes = targetSizesPx(opts.targetScale);
      const r = sizes.handle;

      // Corner resize handles, per selected id, at the corners as the target's
      // rotation puts them.
      for (const id of sel) {
        const b = boundsOf(id);
        if (!b) continue;
        const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        for (const c of rectCorners(b)) {
          const w = rotatePoint(c.x, c.y, cx, cy, b.rotation ?? 0);
          const [sx, sy] = w2s(w.x, w.y, view);
          out.push(slop(sx, sy, r));
        }
      }
      const badge = opts.rotationBadge;
      if (badge && sel.length === 1) {
        const b = boundsOf(sel[0] as string);
        if (b) {
          // Square, and placed by the same function the painted badge and its
          // grab region are.
          const h = rotationHandle(b, badge.distancePx, view.scale);
          const [sx, sy] = w2s(h.cx, h.cy, view);
          out.push(slop(sx, sy, badge.sizePx));
        }
      }

      // Anchor / control-handle slops, when an editing target is active.
      const editingId = opts.getEditingId();
      if (editingId) {
        const anchorR = sizes.anchor;
        const pose = opts.getPose(editingId, previewSourcesFrom(data));
        if (pose && pose.kind === 'polygon') {
          const anchors = enumerateAnchors(pose as PolygonPath);
          for (const a of anchors) {
            const [sx, sy] = w2s(a.x, a.y, view);
            out.push(slop(sx, sy, anchorR));
            if (a.controlIn) {
              const [csx, csy] = w2s(a.controlIn.x, a.controlIn.y, view);
              out.push(slop(csx, csy, anchorR));
            }
            if (a.controlOut) {
              const [csx, csy] = w2s(a.controlOut.x, a.controlOut.y, view);
              out.push(slop(csx, csy, anchorR));
            }
          }
        }
      }

      return out;
    },
  };
}
