import { useMemo, useReducer, useRef, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Action, ActionDeps, ModifierState } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { boundsOfPath, isSpiroKind, withinPxRadius, type SpiroKind, type SpiroPoint } from '@weasel-js/geom';
import { createPointerFollower, defineTool, pointSnap, snapMods, type Tool } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { createSpiroPreviewLayer, type SpiroPreviewState } from './spiroPreviewLayer';
import { spiroNodeData } from './spiroShape';

/** Options for {@link useSpiroTool}. */
export interface UseSpiroToolOptions {
  /** Select the new curve once it commits. Default `true`. */
  autoSelect?: boolean;
  /** Screen-px radius of "click the first point to close". Default `8`. */
  closeHitRadius?: number;
}

/** The spiro tool's state between gestures: the points placed so far. */
interface SpiroScratch extends SpiroPreviewState {
  points: SpiroPoint[];
}

const fresh = (): SpiroScratch => ({ points: [], cursor: null, closeHint: false });

/** What {@link spiroActions} reads and writes of the tool's hook. */
interface SpiroActionsHost {
  /** The points placed so far. */
  scratch(): SpiroScratch;
  /** Drop every point placed. */
  reset(): void;
  options(): { autoSelect: boolean; closeHitRadius: number };
  repaint(): void;
}

const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

/** The spiro tool's actions. Each point placed, and the cursor, snaps
 *  through the `snap` dep's `point` sessions about the point placed before. */
function spiroActions(host: SpiroActionsHost): Action[] {
  const s = host.scratch;
  // The deps last followed through, whose camera and snap the cursor reads.
  let followed: ActionDeps | undefined;
  const snaps = pointSnap();
  const nearFirst = (x: number, y: number): boolean => {
    const { points } = s();
    if (points.length < 3) return false;
    const scale = followed?.view?.get().scale ?? { x: 1, y: 1 };
    return withinPxRadius(points[0].x - x, points[0].y - y, host.options().closeHitRadius, scale);
  };
  // The cursor the preview solves through, following the pointer while points are placed.
  const follower = createPointerFollower(() => track());
  const track = (): void => {
    const scratch = s();
    if (scratch.points.length === 0) follower.unfollow();
    const at = scratch.points.length > 0 ? follower.pointer()?.get() ?? null : null;
    if (!at) snaps.stop();
    const p = at ? snaps.trail(followed?.snap, at.world, scratch.points.at(-1)) : null;
    scratch.cursor = p ? { ...p, kind: 'smooth' } : null;
    scratch.closeHint = p !== null && nearFirst(p.x, p.y);
    host.repaint();
  };
  const commit = (deps: ActionDeps, closed: boolean): void => {
    const { points } = s();
    if (points.length >= 2) {
      const { path, representation } = spiroNodeData([{ points, closed }]);
      const id = deps.insert?.commit(boundsOfPath(path), { kind: 'path', path, closed, data: { representation } }) ?? null;
      if (id !== null && host.options().autoSelect) deps.selection?.set([id]);
    }
    host.reset();
    track();
  };
  const placing = () => (s().points.length > 0 ? true : ActionDisabledReason.NotApplicable);

  return [
    {
      id: 'spiro.placePoint',
      label: 'Spiro — place point',
      eligible: { capability: 'creates-paths' },
      requires: ['view', 'pointer', 'insert', 'selection', 'snap'],
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const p = params as { pressX?: number; pressY?: number; kind?: unknown; mods?: ModifierState } | undefined;
          if (p?.pressX === undefined || p.pressY === undefined) return;
          followed = deps;
          follower.follow(deps.pointer);
          const mods = snapMods({ modifiers: p.mods ?? NO_KEYS });
          const at = snaps.place(deps.snap, { x: p.pressX, y: p.pressY }, mods, s().points.at(-1)).point;
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
      invoker: { timing: 'immediate', run: () => { host.reset(); track(); } },
    },
  ];
}

/**
 * Active-slot Tool that draws a spiro curve (`solveSpiro`) by placing its
 * on-curve points: each click places one, of the kind `params.kind` of the
 * `spiro.placePoint` action (default `'smooth'`; Alt-click places a corner),
 * and the preview solves the curve through the points and the cursor as it
 * moves. Clicking the first point of three or more closes the curve; Enter,
 * a double-click or Mod-click finishes it open; Backspace takes back the last
 * point and Escape discards them all, as does switching tools.
 *
 * The curve is inserted through the `insert` dep as a `'path'`, its spiro
 * form beside it on `data.representation`, so a consumer shapes the node by
 * overriding that dep. With `spiroPreset` on, path edit then edits its points
 * (`spiroRepresentation`).
 */
export function useSpiroTool(options: UseSpiroToolOptions = {}): Tool {
  const { autoSelect = true, closeHitRadius = 8 } = options;
  const opts = useLatest({ autoSelect, closeHitRadius });
  const scratchRef = useRef<SpiroScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = fresh();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const [overlay] = useState(() => createSpiroPreviewLayer({ state: () => scratchRef.current! }));

  const actions = useMemo(() => spiroActions({
    scratch: () => scratchRef.current!,
    reset: () => { scratchRef.current = fresh(); },
    options: () => opts.current,
    repaint: forceRender,
  }), [opts]);

  return useMemo(() => defineTool({
    id: 'spiro',
    keybinding: { key: 'P', shift: true },
    capabilities: ['creates-paths'],
    hookName: 'useSpiroTool',
    cursor: () => (scratchRef.current?.closeHint ? 'pointer' : cursorFor('pen', { fallback: 'crosshair' })),
    presentation: { label: 'Spiro', icon: icon('spiro'), group: 'draw' },
    actions,
    overlay,
    overlayPosition: 'before-selection',
    onDeactivate: () => {
      scratchRef.current = fresh();
      forceRender();
    },
    bindings: [
      { spec: { kind: 'click', mods: { shift: 'optional' } }, actionId: 'spiro.placePoint', opts: { id: 'spiro.placePoint' } },
      { spec: { kind: 'click', mods: { alt: true, shift: 'optional' } }, actionId: 'spiro.placePoint', opts: { id: 'spiro.placeCorner', params: { kind: 'corner' } } },
      { spec: { kind: 'click', mods: { mod: true, shift: 'optional' } }, actionId: 'spiro.finish', opts: { id: 'spiro.finishClick' } },
      { spec: { kind: 'doubleClick', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'spiro.finish', opts: { id: 'spiro.finishDoubleClick', params: { viaDoubleClick: true } } },
      { spec: { kind: 'key', key: 'Enter' }, actionId: 'spiro.finish', opts: { id: 'spiro.finishKey' } },
      { spec: { kind: 'key', key: 'Backspace' }, actionId: 'spiro.removeLast', opts: { id: 'spiro.removeLast' } },
      { spec: { kind: 'key', key: 'Escape' }, actionId: 'spiro.cancel', opts: { id: 'spiro.cancel' } },
    ],
  }), [actions, overlay]);
}
