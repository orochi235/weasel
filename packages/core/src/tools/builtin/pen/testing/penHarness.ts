import { vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { renderHook, act } from '@testing-library/react';
import { usePenTool } from '../usePenTool';
import { createPenPreviewLayer } from 'features/paths/penPreviewLayer';
import type { PolygonPath } from '@weasel-js/geom';
import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { ModifierState } from 'core/modifierState';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import type { InsertExtras } from 'interactions/actions/depSchema';
import { rootsTree } from 'core/adapters/testing/rootsTree';

// `setup` reads the pen's state off the preview layer's recorded calls, so a
// test file calling it must mock 'features/paths/penPreviewLayer' with the real
// factory wrapped in `vi.fn`. `vi.mock` is hoisted per file and cannot live here.
const previewLayers = vi.mocked(createPenPreviewLayer);

export interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

export const NO_MODS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

export function makeAdapter() {
  const added: Pose[] = [];
  const ids: string[] = [];
  let n = 0;
  const setSelection = vi.fn<(ids: string[]) => void>();
  const addNode = vi.fn((p: Pose) => {
    const id = `o${++n}`;
    added.push(p);
    ids.push(id);
    return id;
  });
  const makeNode = vi.fn((p: Pose) => ({ id: `o${++n}`, pose: p }));
  return { added, ids, addNode, makeNode, setSelection };
}

/** The `insert` and `selection` deps the pen commits through, recording on
 *  `a`. `noBuild` leaves `insert.build` off, as a consumer's own dep may. */
export function penDeps(a: ReturnType<typeof makeAdapter>, noBuild = false) {
  const poseOf = (extras: InsertExtras): Pose => {
    const e = extras as { path: PolygonPath; closed: boolean };
    return { kind: 'path', path: e.path, closed: e.closed };
  };
  return {
    insert: {
      commit: vi.fn((_bounds: unknown, extras: InsertExtras) => a.addNode(poseOf(extras))),
      ...(noBuild ? {} : {
        build: (_bounds: unknown, extras: InsertExtras) => {
          const node = a.makeNode(poseOf(extras));
          return { id: node.id, ops: [createInsertOp({ node })] };
        },
      }),
    },
    selection: { set: a.setSelection },
  };
}

/** Stand-ins for the deps the pen reads and writes existing paths through,
 *  over a plain record of world-space paths. */
function standInScene(paths: Record<string, PolygonPath>) {
  const scene = { ...paths };
  // The area query answers by anchor-in-rect, so a box the pen sizes wrongly
  // finds nothing.
  const hitTestArea = vi.fn((b: { x: number; y: number; width: number; height: number }) =>
    Object.keys(scene).filter((id) => {
      const c = scene[id].coords;
      for (let i = 0; i + 1 < c.length; i += 2) {
        if (c[i] >= b.x && c[i] <= b.x + b.width && c[i + 1] >= b.y && c[i + 1] <= b.y + b.height) return true;
      }
      return false;
    }));
  const applyEdit = vi.fn((id: string, path: unknown) => { scene[id] = path as PolygonPath; });
  const editOps = vi.fn((id: string, path: unknown): Op[] => [{
    apply: () => { scene[id] = path as PolygonPath; },
    invert: () => { throw new Error('not exercised'); },
  }]);
  // What a committed op batch landed on: `applyOps` applies each op against
  // this, the way the scene would.
  const inserted: Array<{ id: string; pose: Pose }> = [];
  const opTarget = {
    ...rootsTree(),
    insertNode: (node: { id: string; pose: Pose }) => { inserted.push(node); },
    removeNode: (id: string) => { delete scene[id]; },
  };
  const applyOps = vi.fn((ops: Op[], _label: string) => { for (const op of ops) op.apply(opTarget); });
  return { scene, hitTestArea, applyEdit, editOps, inserted, applyOps };
}

/**
 * Drives the pen through its Actions the way the dispatcher does.
 *
 * Every call runs inside `act()`: the pen force-renders after each scratch
 * mutation so the host repaints its preview layer, and an unwrapped update
 * makes React log an act warning.
 */
export function setup(over: {
  autoSelect?: boolean;
  autoCommitOnClose?: boolean;
  closeHitRadius?: number;
  anchorSnapRadius?: number;
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
  /** Uniform view scale, to exercise the zoom-relative close-hit radius. */
  scale?: number;
  /** Paths already in the scene, in world coords, keyed by node id and
   *  listed front-to-back. */
  paths?: Record<string, PolygonPath>;
  /** Replace the stand-in deps with real ones. */
  deps?: Record<string, unknown>;
  /** Leave `build` off the insert dep. */
  noMakeNode?: boolean;
  /** Mount the pen under a `KitSettingsProvider` holding these. */
  kitSettings?: KitSettingsOverrides;
} = {}) {
  const { scale = 1, paths = {}, deps: depsOver, noMakeNode, kitSettings, ...toolOpts } = over;
  const adapter = makeAdapter();
  const wrapper = kitSettings
    ? ({ children }: { children: ReactNode }) => createElement(KitSettingsProvider, { value: kitSettings }, children)
    : undefined;
  const { result } = renderHook(() => usePenTool(toolOpts), wrapper ? { wrapper } : undefined);
  const tool = result.current;
  // The state this pen's overlay paints from.
  const scratch = previewLayers.mock.lastCall![0].state;

  const { scene, hitTestArea, applyEdit, editOps, inserted, applyOps } = standInScene(paths);
  const deps = {
    view: { get: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }), set: () => {} },
    areaSelect: { hitTestArea },
    editAnchors: { getEditablePath: (id: string) => scene[id] ?? null, applyEdit, editOps },
    scene: { get: (id: string) => (scene[id] ? { id, kind: 'leaf', parent: null, data: { path: scene[id] } } : undefined) },
    applyOps,
    ...penDeps(adapter, noMakeNode),
    ...depsOver,
  } as unknown as ActionDeps;

  const actionOf = (id: string): Action => {
    const a = (result.current.actions ?? []).find((x) => x.id === id);
    if (!a) throw new Error(`${id} not declared on the tool`);
    return a;
  };

  /** Run an immediate action, honoring the `enabled` gate the dispatcher
   *  consults first. Returns whether it actually ran. */
  const fire = (id: string, params?: Record<string, unknown>): boolean => {
    const action = actionOf(id);
    if (action.enabled && action.enabled(deps) !== true) return false;
    const invoker = action.invoker;
    if (invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
    act(() => { invoker.run(deps, params); });
    return true;
  };

  const ctx = (world: { x: number; y: number }, mods: Partial<ModifierState>, start?: { x: number; y: number }): InvocationCtx => ({
    world,
    screen: world,
    modifiers: { ...NO_MODS, ...mods },
    deps,
    drag: { start: start ?? world, current: world, delta: { x: 0, y: 0 } },
  });

  return {
    tool, adapter, scratch, actionOf, deps, scene, applyEdit, editOps, applyOps, inserted,

    /** A plain click — the `pen.placeAnchor` binding. */
    click(x: number, y: number) { fire('pen.placeAnchor', { pressX: x, pressY: y }); },

    /** ⌘/Ctrl-click — the `pen.finishOpen` binding. Returns false when the
     *  action declined, in which case the dispatcher would fall through to
     *  the plain-click binding. */
    modClick(x: number, y: number): boolean {
      return fire('pen.finishOpen', { pressX: x, pressY: y });
    },

    /** A double click on the canvas. The dispatcher emits `click` for each of
     *  the two presses and *then* `doubleclick`, so the test does the same. */
    doubleClick(x: number, y: number) {
      this.click(x, y);
      this.click(x, y);
      fire('pen.finishOpen', { pressX: x, pressY: y, viaDoubleClick: true });
    },

    /** A drag from `from` to `to`, with optional intermediate moves. */
    drag(from: { x: number; y: number }, to: { x: number; y: number }, mods: Partial<ModifierState> = {}, vias: Array<{ x: number; y: number }> = []) {
      const action = actionOf('pen.dragHandle');
      const invoker = action.invoker;
      if (invoker?.timing !== 'ongoing') throw new Error('pen.dragHandle is not ongoing');
      let handle!: OngoingHandle;
      act(() => { handle = invoker.start(ctx(from, mods, from))!; });
      for (const via of vias) act(() => { handle.onMove?.(ctx(via, mods, from)); });
      act(() => { handle.onEnd?.(ctx(to, mods, from), 'commit'); });
    },

    /** Enter. Returns false when the action declined. */
    enter(): boolean { return fire('pen.finish'); },
    /** Escape. Returns false when the action declined — which is what lets
     *  the ambient `escape` ladder take over. */
    escape(): boolean { return fire('pen.cancel'); },

    deactivate() { act(() => { tool.onDeactivate?.(); }); },
  };
}
