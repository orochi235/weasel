/**
 * Screen-space debug overlay rendering the kit's hit-test "slops" — the
 * forgiveness regions around each point affordance (corner resize handles,
 * the rotate badge, anchor / control-handle markers). Off by default; gated
 * by SceneCanvas's `debug.slops` prop.
 *
 * It walks the same affordances the hit-test does, and draws each point
 * region's square from the same frame the hit-test reads, so a halo shows
 * exactly the pixels that grab.
 */

import type { DrawCommand } from '../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { Affordance } from 'affordances/types';
import { pointRegionScreenQuad, transformOf } from 'affordances/hitAffordanceRegions';
import { PATH_L, PATH_M, PATH_Z } from 'features/paths/types';
import { chromeStateFrom, isVisibleFrom } from './drawEnvelope';

export interface CreateSlopsDebugLayerOptions {
  /** The affordances the canvas hit-tests — `chromeAffordances`, the same
   *  list handed to `buildAffordanceAt`. */
  getAffordances: () => readonly Affordance[];
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
    draw: (data, view) => {
      // Selection, bounds and visibility come off the envelope: the halos
      // have to sit on the chrome the drawing view actually painted.
      const chrome = chromeStateFrom(data);
      if (!chrome) return [];
      const isVisible = isVisibleFrom(data);
      const toScreen = (x: number, y: number): [number, number] =>
        [(x - view.x) * view.scale.x, (y - view.y) * view.scale.y];
      const out: DrawCommand[] = [];
      for (const a of opts.getAffordances()) {
        if (isVisible && !isVisible(a.id)) continue;
        for (const region of a.regions(chrome)) {
          if (region.shape.kind !== 'point') continue;
          const q = pointRegionScreenQuad(
            region.shape, transformOf(chrome, region.targetId), view, toScreen,
          );
          out.push({
            kind: 'path',
            path: {
              kind: 'polygon',
              commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
              coords: new Float32Array([q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y]),
              fillRule: 'nonzero',
            },
            fill: { fill: 'solid', color: SLOP_FILL },
            stroke: { paint: { fill: 'solid', color: SLOP_STROKE }, width: 1 },
          });
        }
      }
      return out;
    },
  };
}
