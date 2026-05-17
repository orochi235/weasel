import { useMemo, createElement } from 'react';
import { useIsDispatcherMounted } from 'interactions/dispatcher/dispatcherPresence';
import { defineTool, claim, begin, none } from '../../routing';
import { LassoIcon } from '../../../icons';
import type { Tool } from '../../types';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { PathBuilder } from 'features/paths/builder';
import {
  useLassoSelect,
  type UseLassoSelectOptions,
} from 'interactions/actions/lasso-select/lassoSelect';
import { selectFromLasso } from 'interactions/actions/lasso-select/behaviors/selectFromLasso';
import type { LassoHitMode, LassoSelectAdapter } from 'core/adapters/types';
import type { KeyBinding } from 'interactions/actions/useKeybinding';

export interface UseLassoToolOptions extends Pick<UseLassoSelectOptions,
  'behaviors' | 'transient' | 'label' | 'onGestureStart' | 'onGestureEnd' |
  'minVertexSpacing' | 'debug'> {
  /** Hit mode forwarded to the default `selectFromLasso` behavior when no
   *  explicit `behaviors` array is passed. Default 'intersect'. */
  mode?: LassoHitMode;
  /** Override the default keybinding (`{ key: 'L' }`). Pass `null` to omit. */
  keybinding?: KeyBinding | null;
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

  // When the new gesture dispatcher is mounted (inside a SceneCanvas or other
  // DispatcherPresenceProvider), the drag bindings take over from the old
  // route-table drag entries. When it's absent (legacy Canvas, tests that
  // don't use SceneCanvas), the flag stays false and the old path fires as
  // before — no double-application risk, no silent no-ops.
  const gestureDispatcherMounted = useIsDispatcherMounted();

  return useMemo(() => {
    const overlay: RenderLayer<unknown> = {
      id: 'lasso-overlay',
      label: 'Lasso overlay',
      space: 'screen',
      draw: (_data, view): DrawCommand[] => {
        // Closure-read controller.overlay each draw — same pattern as the
        // imperative tool. No ctx is needed here; `view` arrives from the
        // overlay layer's draw call.
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
      ...(options.keybinding === null ? {} : { keybinding: options.keybinding ?? { key: 'L' } }),
      cursor: 'crosshair',
      presentation: {
        label: 'Lasso',
        icon: createElement(LassoIcon),
        group: 'select',
      },
      // Phase 14d: declarative drag bindings for the new gesture dispatcher.
      // These replace the `drag: { ... }` route table entry above (which is
      // kept as dead code for Phase 14e cleanup). `bindingsOverrideDrag: true`
      // suppresses the old dispatcher's drag channel so only the new dispatcher
      // handles drag gestures.
      bindings: [
        { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: 'lassoSelect' },
      ],
      bindingsOverrideDrag: gestureDispatcherMounted,
      initial: {
        overlay: () => overlay,
        drag: (ctx, _e) => {
          ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
          return begin({
            scratch: undefined,
            onMove: (c) => {
              ctl.move(c.worldX, c.worldY, c.modifiers);
              return claim();
            },
            onRelease: () => {
              ctl.end();
              return claim();
            },
            onCancel: () => {
              ctl.cancel();
            },
          });
        },
        keyDown: {
          Escape: () => {
            if (!ctl.isLassoSelecting) return none();
            ctl.cancel();
            return claim();
          },
        },
      },
    });
  }, [ctl, options.keybinding, gestureDispatcherMounted]);
}
