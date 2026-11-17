import {
  type AnyScene, type LayerHit, OVERLAY_ROLE_STROKES, type RenderLayer, shownLookup, viewToTransform, worldToScreen,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/renderer';
import { pxReach, rectPath } from '@weasel-js/geom';
import { measureDrawCommands } from './measurePainter';
import { measureEndsOf, type MeasurePoint } from './measurement';
import type { Measurements } from './measurements';
import { measureHitAt, type MeasureHit } from './measureHit';
import { MEASURE_HIT_PX } from './measureActions';

/** The registered layer's id; a press it claims routes as `layer:<id>`. */
export const MEASURE_LAYER_ID = 'weasel-measure';
/** The affordance kind a press on a measurement routes under. */
export const MEASURE_AFFORDANCE_KIND = `layer:${MEASURE_LAYER_ID}`;

const HANDLE_PX = 3.5;

/**
 * The measurements' interactive layer, under every tool: it draws the
 * measurement a measure drag is making and a handle on each end of the picked
 * one, and claims a press on a measurement so a click picks it and a drag
 * edits it rather than reaching the tool. Under the measure tool it claims
 * only the picked measurement's ends, so a drag from anywhere else measures.
 */
export function createMeasureLayer(scene: AnyScene, ms: Measurements): RenderLayer<unknown> {
  return {
    id: MEASURE_LAYER_ID,
    label: 'Measurements',
    space: 'screen',
    subscribe: (listener) => {
      const offs = [ms.picked.subscribe(listener), ms.draft.subscribe(listener), ms.measuring.subscribe(listener)];
      return () => { for (const off of offs) off(); };
    },
    draw: (_data, view) => {
      const t = viewToTransform(view);
      const toScreen = (p: MeasurePoint): MeasurePoint => {
        const [x, y] = worldToScreen(p.x, p.y, t);
        return { x, y };
      };
      const out: DrawCommand[] = [];
      const draft = ms.draft.get();
      if (draft) out.push(...measureDrawCommands(toScreen(draft.start), toScreen(draft.end), 1));
      const picked = ms.picked.get();
      const ends = picked === null ? null : measureEndsOf(shownLookup(scene).get(picked));
      if (ends && !scene.isHidden(picked!)) {
        const stroke = { ...OVERLAY_ROLE_STROKES['measure'], width: 1 };
        for (const p of [ends.start, ends.end].map(toScreen)) {
          out.push({
            kind: 'path',
            path: rectPath(p.x - HANDLE_PX, p.y - HANDLE_PX, HANDLE_PX * 2, HANDLE_PX * 2),
            fill: { paint: { color: '#ffffff' } },
            stroke,
          });
        }
      }
      return out;
    },
    hitTest: (wx, wy, _data, view): LayerHit<MeasureHit> | null => {
      const hit = measureHitAt(scene, ms, { x: wx, y: wy }, pxReach(MEASURE_HIT_PX, view.scale));
      if (!hit) return null;
      const onPickedEnd = hit.part !== 'line' && hit.id === ms.picked.get();
      if (ms.measuring.get() && !onPickedEnd) return null;
      return {
        initialScratch: hit,
        strength: 'exclusive',
        claimedKinds: ['pointer'],
        cursor: onPickedEnd ? 'crosshair' : 'move',
      };
    },
  };
}
