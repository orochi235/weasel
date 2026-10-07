import { useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Action, ActionDeps, InvocationCtx, ToolKeybinding } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import { sliceAction } from 'interactions/actions/defaults/slice';
import { withinPxRadius } from 'core/viewport/pxExtent';
import { worldToScreen } from 'core/viewport/viewTransform';
import { viewToTransform } from 'core/viewport/view';
import { ellipsePath, polylineFromPoints } from '@weasel-js/geom';
import { OVERLAY_ROLE_STROKES } from 'canvas/overlayRoleStrokes';

/** Options for `useSliceTool`. */
export interface UseSliceToolOptions {
  /** Override the default keybinding (`{ key: 'K' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen-px radius around the first point within which a click closes the
   *  cut into a loop and commits it. Default `8`. */
  closeHitRadius?: number;
}

/** The click-by-click cut in progress, in world coords. */
export interface SliceScratch {
  points: { x: number; y: number }[];
}

const VERTEX_RADIUS_PX = 3;

/**
 * Knife tool. A drag cuts along a straight line, and an Alt-drag along its
 * freehand trail, through `sliceAction`. Clicks place a cut one point at a
 * time: Enter or a double-click commits it, Escape discards it, Backspace
 * takes back the last point, and a click on the first point closes it into a
 * loop and commits. While points are placed, a drag places one more where it
 * is released instead of cutting on its own.
 *
 * Every cut goes to the `slice` dep, which decides what it does to the scene.
 * `<SceneCanvas>` publishes one that cuts every path the cut crosses. The pending cut paints through
 * `Tool.overlay`, trailing to the pointer when the host publishes one.
 */
export function useSliceTool(options: UseSliceToolOptions = {}): Tool<null> {
  const scratchRef = useRef<SliceScratch>({ points: [] });
  const optsRef = useLatest({ closeHitRadius: options.closeHitRadius ?? 8 });

  // What the overlay layer's `subscribe` hears: a change to the points, and,
  // while any are placed, every move of the pointer the rubber band follows.
  const live = useMemo(() => {
    const listeners = new Set<() => void>();
    let pointer: PointerContextValue | null = null;
    let offPointer: (() => void) | null = null;
    const notify = (): void => { for (const fn of [...listeners]) fn(); };
    return {
      notify,
      listen(fn: () => void): () => void {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
      },
      pointer: () => pointer,
      follow(next: PointerContextValue | undefined): void {
        if (!next || next === pointer) return;
        offPointer?.();
        pointer = next;
        offPointer = next.subscribe(notify);
      },
      unfollow(): void {
        offPointer?.();
        offPointer = null;
        pointer = null;
      },
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
      if (pts.length >= 3 && withinPxRadius(x - first.x, y - first.y, optsRef.current.closeHitRadius, scale)) {
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
          start: () => ({
            onMove: () => {},
            onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
              if (reason === 'cancel' || points().length === 0) return;
              const at = endCtx.drag?.current ?? endCtx.world;
              place(endCtx.deps, at.x, at.y);
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
  }, [live, optsRef]);

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
      if (at) run.push(toScreen({ x: at.worldX, y: at.worldY }));
      const stroke = OVERLAY_ROLE_STROKES['cut'];
      const out: DrawCommand[] = [];
      if (run.length >= 2) out.push({ kind: 'path', path: polylineFromPoints(run), stroke });
      for (const p of pts.map(toScreen)) {
        out.push({
          kind: 'path',
          path: ellipsePath({
            x: p.x - VERTEX_RADIUS_PX,
            y: p.y - VERTEX_RADIUS_PX,
            width: VERTEX_RADIUS_PX * 2,
            height: VERTEX_RADIUS_PX * 2,
          }),
          fill: stroke.paint,
        });
      }
      return out;
    },
  }), [live]);

  const { keybinding } = options;
  return useMemo(() => defineTool<null>({
    id: 'slice',
    capabilities: ['edits-page'],
    hookName: 'useSliceTool',
    cursor: 'crosshair',
    presentation: { label: 'Slice', group: 'shape' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'K' } }),
    actions,
    overlay,
    onDeactivate: () => {
      scratchRef.current.points = [];
      live.unfollow();
      live.notify();
    },
    bindings: [
      { spec: { kind: 'click', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'slice.addPoint' },
      {
        spec: { kind: 'doubleClick', mods: { shift: 'optional', alt: 'optional' } },
        actionId: 'slice.finish',
        opts: { params: { viaDoubleClick: true } },
      },
      // Ahead of the cutting drags: it declines unless points are placed.
      { spec: { kind: 'drag', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'slice.dragPoint' },
      { spec: { kind: 'drag' }, actionId: 'slice' },
      { spec: { kind: 'drag', mods: { alt: true } }, actionId: 'slice', opts: { params: { cut: 'freehand' } } },
      { spec: { kind: 'key', key: 'Enter' }, actionId: 'slice.finish' },
      { spec: { kind: 'key', key: 'Escape' }, actionId: 'slice.cancel' },
      { spec: { kind: 'key', key: 'Backspace' }, actionId: 'slice.dropPoint' },
    ],
  }), [actions, overlay, keybinding, live]);
}
