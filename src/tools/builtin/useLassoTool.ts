import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../renderer';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { PathBuilder } from 'features/paths/builder';
import {
  useLassoSelect,
  type UseLassoSelectOptions,
} from 'interactions/gestures/lasso-select/lassoSelect';
import { selectFromLasso } from 'interactions/gestures/lasso-select/behaviors/selectFromLasso';
import type { LassoHitMode, LassoSelectAdapter } from 'core/adapters/types';

export interface UseLassoToolOptions extends Pick<UseLassoSelectOptions,
  'behaviors' | 'transient' | 'label' | 'onGestureStart' | 'onGestureEnd' |
  'minVertexSpacing' | 'debug'> {
  /** Hit mode forwarded to the default `selectFromLasso` behavior when no
   *  explicit `behaviors` array is passed. Default 'intersect'. */
  mode?: LassoHitMode;
  /** Override the default keybinding ('L'). Pass `null` to omit. */
  keybinding?: string | null;
}

const STROKE = '#a48bd4';
const LINE_WIDTH = 1.5;
const CLOSE_DASH = [4, 3];
const CLOSE_ALPHA = 0.5;

/** Free-form polygon select Tool. Drag-channel routing: pointerdown crosses
 *  threshold → onStart claims and seeds the lasso; onMove appends vertices;
 *  onEnd commits via the configured behavior (default `selectFromLasso` with
 *  `mode: 'intersect'`). Esc cancels without committing. */
export function useLassoTool(
  adapter: LassoSelectAdapter,
  options: UseLassoToolOptions = {},
): Tool<undefined> {
  const behaviors = options.behaviors ?? [selectFromLasso({ mode: options.mode ?? 'intersect' })];
  const ctl = useLassoSelect(adapter, {
    ...options,
    behaviors,
  });

  return useMemo(() => {
    const overlay: RenderLayer<unknown> = {
      id: 'lasso-overlay',
      label: 'Lasso overlay',
      space: 'screen',
      draw: (_data, view): DrawCommand[] => {
        const ov = ctl.overlay;
        if (!ov || ov.vertices.length === 0) return [];
        const t = viewToTransform(view);
        const cmds: DrawCommand[] = [];

        // Live polyline (vertices joined). PathBuilder handles the
        // PolygonPath byte-array encoding.
        if (ov.vertices.length >= 2) {
          const b = new PathBuilder();
          const [sx0, sy0] = worldToScreen(ov.vertices[0].x, ov.vertices[0].y, t);
          b.moveTo(sx0, sy0);
          for (let i = 1; i < ov.vertices.length; i++) {
            const [sx, sy] = worldToScreen(ov.vertices[i].x, ov.vertices[i].y, t);
            b.lineTo(sx, sy);
          }
          cmds.push({
            kind: 'path',
            path: b.build(),
            stroke: { paint: { color: STROKE }, width: LINE_WIDTH },
          });
        }

        // Dashed close-line: last vertex → first vertex.
        if (ov.vertices.length >= 2) {
          const last = ov.vertices[ov.vertices.length - 1];
          const first = ov.vertices[0];
          const [lx, ly] = worldToScreen(last.x, last.y, t);
          const [fx, fy] = worldToScreen(first.x, first.y, t);
          const closer = new PathBuilder().moveTo(lx, ly).lineTo(fx, fy).build();
          cmds.push({
            kind: 'path',
            path: closer,
            stroke: {
              paint: { color: STROKE },
              width: LINE_WIDTH,
              dash: CLOSE_DASH,
            },
            alpha: CLOSE_ALPHA,
          } as DrawCommand);
        }
        return cmds;
      },
    };

    return defineTool<undefined>({
      id: 'lasso',
      ...(options.keybinding === null ? {} : { keybinding: options.keybinding ?? 'L' }),
      cursor: 'crosshair',
      initScratch: () => undefined,
      overlay,

      drag: {
        onStart: (_e, c) => {
          ctl.start(c.worldX, c.worldY, c.modifiers);
          return 'claim';
        },
        onMove: (_e, c) => {
          ctl.move(c.worldX, c.worldY, c.modifiers);
          return 'claim';
        },
        onEnd: (_e, _c) => {
          ctl.end();
          return 'claim';
        },
        onCancel: () => {
          ctl.cancel();
        },
      },

      keyboard: {
        onDown: (e) => {
          if (e.key === 'Escape' && ctl.isLassoSelecting) {
            ctl.cancel();
            return 'claim';
          }
          return 'pass';
        },
      },
    });
  }, [ctl, options.keybinding]);
}
