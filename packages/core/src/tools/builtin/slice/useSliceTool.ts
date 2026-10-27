import { useMemo, useRef } from 'react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '@weasel-js/renderer';
import type { Action, ActionDeps, InvocationCtx, ToolKeybinding } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { createPointerFollower } from '../shared/pointerFollower';
import { sliceAction } from 'interactions/actions/defaults/slice';
import { withinPxRadius } from '@weasel-js/geom';
import { worldToScreen } from 'core/viewport/viewTransform';
import { viewToTransform } from 'core/viewport/view';
import { ellipsePath, polylineFromPoints } from '@weasel-js/geom';
import { OVERLAY_ROLE_STROKES } from 'canvas/overlayRoleStrokes';
import { createEmitter } from '@weasel-js/registry';
import { icon } from '../../../icons.gen';

/** Options for `useSliceTool`. */
export interface UseSliceToolOptions {
  /** Override the default keybinding (`{ key: 'K' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen-px radius around the first point within which a click closes the
   *  cut into a loop and commits it. Default the `targets.sliceCloseHitPx` kit setting, else `8`. */
  closeHitRadius?: number;
}

/** The click-by-click cut in progress, in world coords. */
export interface SliceScratch {
  points: { x: number; y: number }[];
}

export const VERTEX_RADIUS_PX = 3;
/** How near the first point, in screen px, a click closes the cut. */
export const SLICE_CLOSE_HIT_PX = 8;

/**
 * Knife tool. A drag cuts along a straight line, and an Alt-drag along its
 * freehand trail, through `sliceAction`. Clicks place a cut one point at a
 * time: Enter or a double-click commits it, Escape discards it, Backspace
 * takes back the last point, and a click on the first point closes it into a
 * loop and commits. While points are placed, a drag places one more where it
 * is released instead of cutting on its own.
 *
 * Every cut goes to the `slice` dep, which decides what it does to the scene.
 * `<SceneCanvas>` publishes one that cuts every path the cut crosses.
 */
export function useSliceTool(options: UseSliceToolOptions = {}): Tool {
  const scratchRef = useRef<SliceScratch>({ points: [] });
  const closeHitRef = useLatest(options.closeHitRadius);
  const kitSettings = useKitSettings();

  // What the overlay layer's `subscribe` hears: a change to the points, and,
  // while any are placed, every move of the pointer the rubber band follows.
  const live = useMemo(() => {
    const changed = createEmitter();
    return {
      notify: changed.emit,
      listen: changed.subscribe,
      ...createPointerFollower(changed.emit),
    };
  }, []);

  const actions = useMemo<Action[]>(() => {
    const points = () => scratchRef.current.points;
    const pending = () => (points().length > 0 ? true : ActionDisabledReason.NotApplicable);

    const reset = (): void => {
      scratchRef.current.points = [];
      live.unfollow();
      live.notify();
    };
    const commit = (deps: ActionDeps): void => {
      const cut = points().slice();
      reset();
      if (cut.length >= 2) deps.slice?.commit(cut);
    };
    const place = (deps: ActionDeps, x: number, y: number): void => {
      const pts = points();
      const first = pts[0];
      const scale = deps.view?.get().scale ?? { x: 1, y: 1 };
      if (pts.length >= 3 && withinPxRadius(x - first.x, y - first.y, closeHitRef.current ?? kitSettings.get('targets.sliceCloseHitPx') ?? SLICE_CLOSE_HIT_PX, scale)) {
        pts.push({ x: first.x, y: first.y });
        commit(deps);
        return;
      }
      pts.push({ x, y });
      live.follow(deps.pointer);
      live.notify();
    };

    const eligible = { capability: 'edits-page' } as const;
    return [
      sliceAction,
      {
        id: 'slice.addPoint',
        label: 'Slice — place point',
        eligible,
        requires: ['slice', 'view', 'pointer'],
        enabled: (deps) => (deps?.['slice'] ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate',
          run: (deps, params) => {
            const p = params as { pressX?: number; pressY?: number } | undefined;
            if (p?.pressX === undefined || p.pressY === undefined) return;
            place(deps, p.pressX, p.pressY);
          },
        },
      },
      {
        id: 'slice.dragPoint',
        label: 'Slice — drag out a point',
        eligible,
        requires: ['slice', 'view', 'pointer'],
        enabled: pending,
        invoker: {
          timing: 'ongoing',
          // The dispatcher hands `onEnd` a context with empty deps.
          start: ({ deps }: InvocationCtx) => ({
            onMove: () => {},
            onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
              if (reason === 'cancel' || points().length === 0) return;
              const at = endCtx.drag?.current ?? endCtx.world;
              place(deps, at.x, at.y);
            },
          }),
        },
      },
      {
        id: 'slice.finish',
        label: 'Slice — cut along the points',
        eligible,
        requires: ['slice'],
        enabled: pending,
        invoker: {
          timing: 'immediate',
          run: (deps, params) => {
            // A double click arrives after both of its clicks, so the second
            // has already placed a point on top of the first.
            if ((params as { viaDoubleClick?: boolean } | undefined)?.viaDoubleClick) points().pop();
            commit(deps);
          },
        },
      },
      {
        id: 'slice.dropPoint',
        label: 'Slice — take back the last point',
        eligible,
        enabled: pending,
        invoker: {
          timing: 'immediate',
          run: () => {
            points().pop();
            if (points().length === 0) reset();
            else live.notify();
          },
        },
      },
      {
        id: 'slice.cancel',
        label: 'Slice — discard the points',
        eligible,
        // Declining with nothing placed leaves Escape to the ambient `escape`.
        enabled: pending,
        invoker: { timing: 'immediate', run: () => reset() },
      },
    ];
  }, [live, closeHitRef, kitSettings]);

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: 'slice-pending-cut',
    label: 'Slice — pending cut',
    space: 'screen',
    subscribe: live.listen,
    draw: (_data, view) => {
      const pts = scratchRef.current.points;
      if (pts.length === 0) return [];
      const t = viewToTransform(view);
      const toScreen = (p: { x: number; y: number }) => {
        const [x, y] = worldToScreen(p.x, p.y, t);
        return { x, y };
      };
      const run = pts.map(toScreen);
      const at = live.pointer()?.get();
      if (at) run.push(toScreen(at.world));
      const stroke = OVERLAY_ROLE_STROKES['cut'];
      const r = kitSettings.get('targets.sliceVertexRadiusPx') ?? VERTEX_RADIUS_PX;
      const out: DrawCommand[] = [];
      if (run.length >= 2) out.push({ kind: 'path', path: polylineFromPoints(run), stroke });
      for (const p of pts.map(toScreen)) {
        out.push({
          kind: 'path',
          path: ellipsePath({ x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 }),
          fill: { paint: stroke.paint },
        });
      }
      return out;
    },
  }), [live, kitSettings]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'slice',
    capabilities: ['edits-page'],
    hookName: 'useSliceTool',
    cursor: 'crosshair',
    presentation: { label: 'Slice', icon: icon('slice'), group: 'page' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'K' } }),
    actions,
    overlay,
    onDeactivate: () => {
      scratchRef.current.points = [];
      live.unfollow();
      live.notify();
    },
    bindings: [
      { spec: { kind: 'click', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'slice.addPoint', opts: { id: 'slice.click' } },
      {
        spec: { kind: 'doubleClick', mods: { shift: 'optional', alt: 'optional' } },
        actionId: 'slice.finish',
        opts: { id: 'slice.doubleClick', params: { viaDoubleClick: true } },
      },
      // Ahead of the cutting drags: it declines unless points are placed.
      { spec: { kind: 'drag', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'slice.dragPoint', opts: { id: 'slice.dragPoint', yields: true } },
      { spec: { kind: 'drag' }, actionId: 'slice', opts: { id: 'slice.drag' } },
      { spec: { kind: 'drag', mods: { alt: true } }, actionId: 'slice', opts: { id: 'slice.freehand', params: { cut: 'freehand' } } },
      { spec: { kind: 'key', key: 'Enter' }, actionId: 'slice.finish', opts: { id: 'slice.finish' } },
      { spec: { kind: 'key', key: 'Escape' }, actionId: 'slice.cancel', opts: { id: 'slice.cancel' } },
      { spec: { kind: 'key', key: 'Backspace' }, actionId: 'slice.dropPoint', opts: { id: 'slice.dropPoint' } },
    ],
  }), [actions, overlay, keybinding, live]);
}
