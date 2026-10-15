import { createElement, useMemo, useReducer, useRef, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { boundsOfPath, isSpiroKind, spiroToPath, withinPxRadius, type SpiroKind, type SpiroPoint } from '@weasel-js/geom';
import { defineTool, type Tool } from '../../overlayBinding';
import { SpiroIcon } from '../../../icons';
import { createSpiroPreviewLayer, type SpiroPreviewState } from 'features/paths/spiroPreviewLayer';
import { createPointerFollower } from '../shared/pointerFollower';

/** Options for {@link useSpiroTool}. */
export interface UseSpiroToolOptions {
  /** Select the new curve once it commits. Default `true`. */
  autoSelect?: boolean;
  /** Screen-px radius of "click the first point to close". Default `8`. */
  closeHitRadius?: number;
  /** Snap every point placed, and the cursor the preview follows. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
}

/** The spiro tool's state between gestures: the points placed so far. */
interface SpiroScratch extends SpiroPreviewState {
  points: SpiroPoint[];
}

const fresh = (): SpiroScratch => ({ points: [], cursor: null, closeHint: false });


/**
 * Active-slot Tool that draws a spiro curve (`solveSpiro`) by placing its
 * on-curve points: each click places one, of the kind `params.kind` of the
 * `spiro.placePoint` action (default `'smooth'`; Alt-click places a corner),
 * and the preview solves the curve through the points and the cursor as it
 * moves. Clicking the first point of three or more closes the curve; Enter,
 * a double-click or Mod-click finishes it open; Backspace takes back the last
 * point and Escape discards them all, as does switching tools.
 *
 * The curve is inserted through the `insert` dep as kind `'spiro'`, so a
 * consumer shapes the node by overriding that dep. Path edit then edits its
 * points (`spiroShape`).
 */
export function useSpiroTool(options: UseSpiroToolOptions = {}): Tool {
  const { autoSelect = true, closeHitRadius = 8, snapPoint } = options;
  const opts = useLatest({ autoSelect, closeHitRadius, snapPoint });
  const scratchRef = useRef<SpiroScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = fresh();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const [overlay] = useState(() => createSpiroPreviewLayer({ state: () => scratchRef.current! }));

  const actions = useMemo<Action[]>(() => {
    const s = () => scratchRef.current!;
    const snap = (x: number, y: number) => opts.current.snapPoint?.({ x, y }) ?? { x, y };
    let view: ActionDeps['view'];
    const nearFirst = (x: number, y: number): boolean => {
      const { points } = s();
      if (points.length < 3) return false;
      return withinPxRadius(points[0].x - x, points[0].y - y, opts.current.closeHitRadius, view?.get().scale ?? { x: 1, y: 1 });
    };
    // The cursor the preview solves through, following the pointer while points are placed.
    const follower = createPointerFollower(() => track());
    const track = (): void => {
      const scratch = s();
      if (scratch.points.length === 0) follower.unfollow();
      const at = scratch.points.length > 0 ? follower.pointer()?.get() ?? null : null;
      const p = at ? snap(at.worldX, at.worldY) : null;
      scratch.cursor = p ? { ...p, kind: 'smooth' } : null;
      scratch.closeHint = p !== null && nearFirst(p.x, p.y);
      forceRender();
    };
    const commit = (deps: ActionDeps, closed: boolean): void => {
      const { points } = s();
      if (points.length >= 2) {
        const { path } = spiroToPath([{ points, closed }]);
        const id = deps.insert?.commit(boundsOfPath(path), { kind: 'spiro', points: [...points], closed }) ?? null;
        if (id !== null && opts.current.autoSelect) deps.selection?.set([id]);
      }
      scratchRef.current = fresh();
      track();
    };
    const placing = () => (s().points.length > 0 ? true : ActionDisabledReason.NotApplicable);

    return [
      {
        id: 'spiro.placePoint',
        label: 'Spiro — place point',
        eligible: { capability: 'creates-paths' },
        requires: ['view', 'pointer', 'insert', 'selection'],
        invoker: {
          timing: 'immediate',
          run: (deps, params) => {
            const p = params as { pressX?: number; pressY?: number; kind?: unknown } | undefined;
            if (p?.pressX === undefined || p.pressY === undefined) return;
            view = deps.view;
            follower.follow(deps.pointer);
            const at = snap(p.pressX, p.pressY);
            if (nearFirst(at.x, at.y)) return commit(deps, true);
            const kind: SpiroKind = isSpiroKind(p.kind) ? p.kind : 'smooth';
            s().points.push({ x: at.x, y: at.y, kind });
            track();
          },
        },
      },
      {
        id: 'spiro.finish',
        label: 'Spiro — finish open curve',
        eligible: { capability: 'creates-paths' },
        requires: ['insert', 'selection'],
        enabled: placing,
        invoker: {
          timing: 'immediate',
          run: (deps, params) => {
            // A double click arrives after both its clicks, the second of which placed a point.
            if ((params as { viaDoubleClick?: boolean } | undefined)?.viaDoubleClick) s().points.pop();
            commit(deps, false);
          },
        },
      },
      {
        id: 'spiro.removeLast',
        label: 'Spiro — take back the last point',
        eligible: { capability: 'creates-paths' },
        enabled: placing,
        invoker: { timing: 'immediate', run: () => { s().points.pop(); track(); } },
      },
      {
        id: 'spiro.cancel',
        label: 'Spiro — discard curve',
        eligible: { capability: 'creates-paths' },
        // Declining with nothing placed passes Escape on to `escape`.
        enabled: placing,
        invoker: { timing: 'immediate', run: () => { scratchRef.current = fresh(); track(); } },
      },
    ];
  }, [opts]);

  return useMemo(() => defineTool({
    id: 'spiro',
    keybinding: { key: 'B' },
    capabilities: ['creates-paths'],
    hookName: 'useSpiroTool',
    cursor: () => (scratchRef.current?.closeHint ? 'pointer' : cursorFor('pen', { fallback: 'crosshair' })),
    presentation: { label: 'Spiro', icon: createElement(SpiroIcon), group: 'draw' },
    actions,
    overlay,
    overlayPosition: 'before-selection',
    onDeactivate: () => {
      scratchRef.current = fresh();
      forceRender();
    },
    bindings: [
      { spec: { kind: 'click', mods: { shift: 'optional' } }, actionId: 'spiro.placePoint' },
      { spec: { kind: 'click', mods: { alt: true, shift: 'optional' } }, actionId: 'spiro.placePoint', opts: { params: { kind: 'corner' } } },
      { spec: { kind: 'click', mods: { mod: true, shift: 'optional' } }, actionId: 'spiro.finish' },
      { spec: { kind: 'doubleClick', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'spiro.finish', opts: { params: { viaDoubleClick: true } } },
      { spec: { kind: 'key', key: 'Enter' }, actionId: 'spiro.finish' },
      { spec: { kind: 'key', key: 'Backspace' }, actionId: 'spiro.removeLast' },
      { spec: { kind: 'key', key: 'Escape' }, actionId: 'spiro.cancel' },
    ],
  }), [actions, overlay]);
}
