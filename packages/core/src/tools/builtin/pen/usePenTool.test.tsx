import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePenTool, type PenScratch } from './usePenTool';
import type { PolygonPath } from 'features/paths/types';
import { pathFromD } from 'features/paths/pathFromD';
import { pathToAnchors } from 'features/paths/anchors';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { resolveEditablePathOf } from 'canvas/deps/editAnchors';
import type { Scene } from 'core/scene/types';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { ModifierState } from 'core/modifierState';

interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

const NO_MODS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

function makeAdapter() {
  const added: Pose[] = [];
  const ids: string[] = [];
  let n = 0;
  const setSelection = vi.fn();
  const addNode = vi.fn((p: Pose) => {
    const id = `o${++n}`;
    added.push(p);
    ids.push(id);
    return id;
  });
  return { added, ids, addNode, setSelection };
}

/**
 * Drives the pen through its Actions the way the dispatcher does.
 *
 * Every call runs inside `act()`: the pen force-renders after each scratch
 * mutation so the host repaints its preview layer, and an unwrapped update
 * makes React log an act warning.
 */
function setup(over: {
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
} = {}) {
  const { scale = 1, paths = {}, deps: depsOver, ...toolOpts } = over;
  const adapter = makeAdapter();
  const wrapPath = vi.fn((path: PolygonPath, opts: { closed: boolean }): Pose => ({
    kind: 'path', path, closed: opts.closed,
  }));
  const { result } = renderHook(() => usePenTool<Pose>({ wrapPath, adapter, ...toolOpts }));
  const tool = result.current;
  // Pen state is persistent — initScratch returns the same ref, which is also
  // how `penPreviewLayer` reads the in-progress path.
  const scratch = tool.initScratch!() as PenScratch;

  const scene = { ...paths };
  // Stand-ins for the two deps the pen reads existing paths through. The
  // area query answers by anchor-in-rect, so a box the pen sizes wrongly
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
  const deps = {
    view: { get: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }), set: () => {} },
    areaSelect: { hitTestArea },
    editAnchors: { getEditablePath: (id: string) => scene[id] ?? null, applyEdit },
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
    tool, adapter, wrapPath, scratch, actionOf, scene, applyEdit,

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

    deactivate() { act(() => { tool.onDeactivate?.({} as never); }); },
  };
}

describe('usePenTool', () => {
  it('declares id "pen" and a cursor function', () => {
    const { tool } = setup();
    expect(tool.id).toBe('pen');
    expect(typeof tool.cursor).toBe('function');
  });

  it('cursor is the nib glyph normally, "pointer" when closeHintActive', () => {
    // jsdom draws no cursor; this checks the string handed to the host. The
    // close hint stays a keyword because it is about what the next click does,
    // not about which tool is active.
    const { tool, scratch } = setup();
    const cursor = tool.cursor as (ctx: never) => string;
    expect(cursor({} as never)).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(cursor({} as never)).toMatch(/, crosshair$/);
    scratch.closeHintActive = true;
    expect(cursor({} as never)).toBe('pointer');
    scratch.closeHintActive = false;
  });

  it('declares its whole input surface as bindings', () => {
    const { tool } = setup();
    expect((tool.def as any)?.initial).toBeUndefined();
    expect(tool.bindings).toHaveLength(6);
  });

  it('click on empty space (Idle) → places a corner anchor and enters Drawing', () => {
    const p = setup();
    p.click(10, 20);
    expect(p.scratch.current).not.toBeNull();
    expect(p.scratch.current!.anchors).toEqual([{ x: 10, y: 20 }]);
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('second click in Drawing → appends corner anchor', () => {
    const p = setup();
    p.click(10, 20);
    p.click(30, 40);
    expect(p.scratch.current!.anchors.length).toBe(2);
    expect(p.scratch.current!.anchors[1]).toEqual({ x: 30, y: 40 });
  });

  it('drag → places the anchor at the PRESS point with an outHandle at the drag end', () => {
    // The anchor lands where the pointer went down, not where the drag
    // threshold happened to be crossed. `InvocationCtx.drag.start` carries
    // the press position because the dispatcher buffers the pointerdown and
    // releases it at the threshold — which is why the pen no longer keeps a
    // `_pendingDown` field of its own.
    const p = setup();
    p.drag({ x: 10, y: 20 }, { x: 50, y: 20 }, {}, [{ x: 30, y: 20 }]);
    expect(p.scratch.current!.anchors.length).toBe(1);
    const a = p.scratch.current!.anchors[0];
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(a.outHandle).toEqual({ x: 50, y: 20 });
  });

  it('Alt held during placement drag → marks altBroken on the anchor', () => {
    const p = setup();
    p.drag({ x: 0, y: 0 }, { x: 20, y: 0 }, { alt: true });
    expect(p.scratch.current!.anchors[0].altBroken).toBe(true);
  });

  it('Shift held during drag → constrains outHandle direction to 45°', () => {
    const p = setup();
    p.drag({ x: 0, y: 0 }, { x: 10, y: 1 }, { shift: true });
    const out = p.scratch.current!.anchors[0].outHandle!;
    expect(out.y).toBeCloseTo(0);
    expect(out.x).toBeGreaterThan(0);
  });

  it('a cancelled drag takes back the anchor it placed', () => {
    const p = setup();
    const invoker = p.actionOf('pen.dragHandle').invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('expected ongoing');
    const cancelledDrag = () => act(() => {
      const handle = invoker.start({
        world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
        modifiers: NO_MODS, deps: {} as ActionDeps,
        drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
      })!;
      handle.onEnd?.({
        world: { x: 5, y: 5 }, screen: { x: 5, y: 5 },
        modifiers: NO_MODS, deps: {} as ActionDeps,
      }, 'cancel');
    });

    cancelledDrag();
    expect(p.scratch.draggingHandleAt).toBeNull();
    // Nothing was placed, so there is no subpath in progress either.
    expect(p.scratch.current).toBeNull();

    // With a path already under way, only the cancelled anchor goes.
    p.click(50, 50);
    p.click(80, 50);
    cancelledDrag();
    expect(p.scratch.current!.anchors).toHaveLength(2);
  });

  it('clicking first anchor (≥3 anchors) closes the subpath and auto-commits (default)', () => {
    const p = setup({ closeHitRadius: 8 });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(1, 1); // within the close-hit radius of the first anchor
    expect(p.wrapPath).toHaveBeenCalledTimes(1);
    expect(p.wrapPath.mock.calls[0][1]).toEqual({ closed: true });
    expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('the close-hit radius is measured in screen px, so it shrinks as you zoom in', () => {
    // radius = closeHitRadius / meanScale(view.scale) — the `view` dep is
    // what the action reads for it.
    const p = setup({ closeHitRadius: 8, scale: 4 });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    // 3 world px away: inside 8px at scale 1, outside the 2px at scale 4.
    p.click(3, 0);
    expect(p.adapter.addNode).not.toHaveBeenCalled();
    expect(p.scratch.current!.anchors).toHaveLength(4);
  });

  it('autoCommitOnClose: false → close-on-first-anchor parks the subpath in scratch', () => {
    const p = setup({ closeHitRadius: 8, autoCommitOnClose: false });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(1, 1);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths.length).toBe(1);
    expect(p.scratch.finishedSubpaths[0].closed).toBe(true);
    expect(p.scratch.finishedSubpaths[0].anchors.length).toBe(3);
    expect(p.adapter.addNode).not.toHaveBeenCalled();
  });

  it('clicking first anchor with <3 anchors → appends instead of closing (degenerate)', () => {
    const p = setup();
    p.click(0, 0); p.click(50, 0);
    p.click(1, 1);
    expect(p.scratch.current).not.toBeNull();
    expect(p.scratch.finishedSubpaths.length).toBe(0);
    expect(p.scratch.current!.anchors.length).toBe(3);
  });

  it('Enter in Drawing → open-finishes, commits, auto-selects, returns to Idle', () => {
    const p = setup();
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    expect(p.enter()).toBe(true);
    expect(p.wrapPath).toHaveBeenCalledTimes(1);
    expect(p.wrapPath.mock.calls[0][1]).toEqual({ closed: false });
    expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
    expect(p.adapter.setSelection).toHaveBeenCalledWith([p.adapter.ids[0]]);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('Enter in BetweenSubpaths → commits, returns to Idle', () => {
    const p = setup({ autoCommitOnClose: false });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(1, 1);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths.length).toBe(1);
    p.enter();
    expect(p.wrapPath).toHaveBeenCalledTimes(1);
    expect(p.wrapPath.mock.calls[0][1]).toEqual({ closed: true });
    expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
  });

  it('Enter with nothing drawn declines, so the key falls through', () => {
    const p = setup();
    expect(p.enter()).toBe(false);
    expect(p.actionOf('pen.finish').enabled?.()).toBe(ActionDisabledReason.NotApplicable);
  });

  it('Esc → discards everything', () => {
    const p = setup();
    p.click(0, 0); p.click(50, 0);
    expect(p.escape()).toBe(true);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
    expect(p.adapter.addNode).not.toHaveBeenCalled();
  });

  it('Esc with nothing drawn declines, keeping the escape ladder intact', () => {
    // An idle pen must not swallow Escape: the ambient `escape` action goes
    // on to clear the selection / return to the default tool.
    const p = setup();
    expect(p.escape()).toBe(false);
    expect(p.actionOf('pen.cancel').enabled?.()).toBe(ActionDisabledReason.NotApplicable);
  });

  it('tool-switch (onDeactivate) discards in-progress path regardless of anchor count', () => {
    // Mirrors the Escape contract: an in-progress path is by definition
    // incomplete (the user didn't close-on-first / ⌘-click / press Enter).
    // Switching tools must NOT auto-commit a stub polyline.
    const p = setup();
    p.click(0, 0); p.click(50, 0); p.click(100, 0);
    p.deactivate();
    expect(p.adapter.addNode).not.toHaveBeenCalled();
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('tool-switch with <2 anchors → discards', () => {
    const p = setup();
    p.click(0, 0);
    p.deactivate();
    expect(p.adapter.addNode).not.toHaveBeenCalled();
    expect(p.scratch.current).toBeNull();
  });

  it('autoSelect: false → addNode called but setSelection not called', () => {
    const p = setup({ autoSelect: false });
    p.click(0, 0); p.click(100, 0); p.click(50, 80);
    p.enter();
    expect(p.adapter.addNode).toHaveBeenCalled();
    expect(p.adapter.setSelection).not.toHaveBeenCalled();
  });

  it('initScratch returns the same persistent ref across calls', () => {
    const { tool } = setup();
    expect(tool.initScratch!()).toBe(tool.initScratch!());
  });

  describe('bindings', () => {
    it('routes plain click, mod-click, double-click, drag, Enter and Escape', () => {
      const { tool } = setup();
      const routes = (tool.bindings ?? []).map((b) => [
        b.spec.kind,
        'key' in b.spec ? b.spec.key : (b.spec.mods?.mod === true ? 'mod' : ''),
        b.actionId,
      ]);
      expect(routes).toEqual([
        ['click', '', 'pen.placeAnchor'],
        ['click', 'mod', 'pen.finishOpen'],
        ['doubleClick', '', 'pen.finishOpen'],
        ['drag', '', 'pen.dragHandle'],
        ['key', 'Enter', 'pen.finish'],
        ['key', 'Escape', 'pen.cancel'],
      ]);
    });
  });

  describe('⌘-click open-finish (Illustrator convention)', () => {
    it('⌘-click after ≥2 anchors commits the path open and clears it', () => {
      const p = setup();
      p.click(0, 0); p.click(50, 0); p.click(50, 50);
      expect(p.modClick(200, 200)).toBe(true);
      expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
      expect(p.scratch.current).toBeNull();
      expect(p.adapter.added.at(-1)!.closed).toBe(false);
    });

    it('⌘-click with <2 anchors declines, so the click falls through to anchor placement', () => {
      // Strict modifier matching means the two click bindings are distinct
      // routes; declining is what lets the dispatcher try the plain one.
      const p = setup();
      p.click(0, 0);
      expect(p.modClick(50, 50)).toBe(false);
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      p.click(50, 50); // the fall-through
      expect(p.scratch.current!.anchors).toHaveLength(2);
    });

    it('the binding uses `mod`, which is meta on mac and ctrl elsewhere', () => {
      // The retired route grammar's modifier matcher accepted meta OR ctrl on
      // every platform, so ⌘-click's route also fired on Ctrl-click on mac —
      // where Ctrl-click is the context menu.
      const { tool } = setup();
      const modClick = (tool.bindings ?? []).find((b) => b.actionId === 'pen.finishOpen' && b.spec.kind === 'click');
      expect(modClick?.spec.mods).toMatchObject({ mod: true });
      expect(modClick?.spec.mods).not.toHaveProperty('ctrl');
      expect(modClick?.spec.mods).not.toHaveProperty('meta');
    });
  });

  describe('double-click open-finish (Illustrator convention)', () => {
    it('double-clicking the last anchor commits the path open, without a duplicate anchor', () => {
      // `doubleclick` is synthesized AFTER both clicks, so the second click
      // has already placed an anchor on top of the first's. The action drops
      // that duplicate before committing — net effect matches the pen's old
      // private 300ms detector, using the dispatcher's single definition of
      // a double click instead of a fourth one.
      const p = setup();
      p.click(0, 0);
      p.doubleClick(50, 0);
      expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
      expect(p.adapter.added[0].closed).toBe(false);
      expect(p.scratch.current).toBeNull();
      // Two anchors survive: (0,0) and the first of the double-click pair.
      expect(p.adapter.added[0].path.commands).toHaveLength(2);
    });

    it('drops exactly one anchor, wherever the double-click lands', () => {
      // The dropped anchor is by construction the one the second click just
      // appended, so there is no position test to get wrong — the pen's old
      // detector needed one only because it had to decide, mid-click,
      // whether a double-click was happening at all.
      const p = setup();
      p.click(0, 0); p.click(50, 0);
      p.doubleClick(500, 500);
      // (0,0), (50,0) and ONE anchor at (500,500) survive.
      expect(p.adapter.added[0].path.commands).toHaveLength(3);
    });

    it('a double-click that closes the subpath keeps every anchor', () => {
      // The second click landed on the first anchor and closed the path, so
      // the anchors already moved to `finishedSubpaths` — there is nothing
      // for the double click to undo.
      const p = setup({ closeHitRadius: 8, autoCommitOnClose: false });
      p.click(0, 0); p.click(100, 0); p.click(100, 100);
      p.doubleClick(1, 1);
      expect(p.scratch.finishedSubpaths.length + (p.scratch.current ? 1 : 0)).toBe(0);
      expect(p.adapter.added[0].closed).toBe(true);
      expect(p.adapter.added[0].path.commands).toHaveLength(4); // M L L Z
    });

    it('declines with <2 anchors', () => {
      const p = setup();
      const action = p.actionOf('pen.finishOpen');
      expect(action.enabled?.()).toBe(ActionDisabledReason.NotApplicable);
      p.click(0, 0);
      expect(action.enabled?.()).toBe(ActionDisabledReason.NotApplicable);
    });
  });

  describe('snapPoint', () => {
    const SPACING = 10;
    const grid = (p: { x: number; y: number }) => ({
      x: Math.round(p.x / SPACING) * SPACING,
      y: Math.round(p.y / SPACING) * SPACING,
    });

    it('snaps corner-anchor click placement to the grid', () => {
      const p = setup({ snapPoint: grid });
      p.click(12, 18);
      expect(p.scratch.current!.anchors).toEqual([{ x: 10, y: 20 }]);
    });

    it('snaps the smooth-anchor base point at drag start', () => {
      const p = setup({ snapPoint: grid });
      p.drag({ x: 23, y: 7 }, { x: 60, y: 7 });
      expect(p.scratch.current!.anchors[0].x).toBe(20);
      expect(p.scratch.current!.anchors[0].y).toBe(10);
    });

    it('snaps the outgoing-handle target while dragging a handle', () => {
      const p = setup({ snapPoint: grid });
      p.drag({ x: 0, y: 0 }, { x: 27, y: 32 });
      expect(p.scratch.current!.anchors[0].outHandle).toEqual({ x: 30, y: 30 });
    });

    it('passthrough (no snapPoint) preserves raw coords', () => {
      const p = setup();
      p.click(12, 18);
      expect(p.scratch.current!.anchors).toEqual([{ x: 12, y: 18 }]);
    });
  });

  describe('continuing an existing open path', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    const pointsOf = (path: unknown) =>
      pathToAnchors(path as PolygonPath).anchors.map((sub) => sub.map((a) => [a.x, a.y]));

    it('pressing the last anchor picks the path up, and later clicks append to that node', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0 L 100 100') } });
      p.click(102, 97);
      expect(p.scratch.current!.anchors.map((a) => [a.x, a.y])).toEqual([[0, 0], [100, 0], [100, 100]]);
      p.click(200, 100);
      p.enter();
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.applyEdit).toHaveBeenCalledOnce();
      expect(p.applyEdit.mock.calls[0][0]).toBe('n1');
      expect(pointsOf(p.scene.n1)).toEqual([[[0, 0], [100, 0], [100, 100], [200, 100]]]);
      expect(p.adapter.setSelection).toHaveBeenCalledWith(['n1']);
      expect(p.scratch.current).toBeNull();
    });

    it('pressing the first anchor prepends, keeping the path running the way it did', () => {
      const p = setup({ paths: { n1: poly('M 0 0 C 30 0 70 0 100 0 L 100 100') } });
      p.click(1, 1);
      p.click(-50, 0);
      p.enter();
      const { anchors } = pathToAnchors(p.scene.n1);
      expect(anchors[0].map((a) => [a.x, a.y])).toEqual([[-50, 0], [0, 0], [100, 0], [100, 100]]);
      // The curve survives both reversals unchanged.
      expect(anchors[0][1].outHandle).toEqual({ x: 30, y: 0 });
      expect(anchors[0][2].inHandle).toEqual({ x: 70, y: 0 });
    });

    it('clicking the far end closes the continued path onto itself', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.click(100, 100);
      p.click(0, 1);
      expect(p.applyEdit).toHaveBeenCalledOnce();
      expect(Array.from(p.scene.n1.commands).at(-1)).toBe(4 /* Z */);
      expect(pointsOf(p.scene.n1)).toEqual([[[0, 0], [100, 0], [100, 100]]]);
    });

    it('leaves the node\'s other subpaths and fill rule alone', () => {
      const original = { ...poly('M 0 0 L 10 0 L 10 10 Z M 50 50 L 60 50'), fillRule: 'evenodd' as const };
      const p = setup({ paths: { n1: original } });
      p.click(60, 50);
      p.click(60, 60);
      p.enter();
      expect(pointsOf(p.scene.n1)).toEqual([[[0, 0], [10, 0], [10, 10]], [[50, 50], [60, 50], [60, 60]]]);
      expect(pathToAnchors(p.scene.n1).closed).toEqual([true, false]);
      expect(p.scene.n1.fillRule).toBe('evenodd');
    });

    it('finishing without adding anything writes nothing', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.enter();
      expect(p.applyEdit).not.toHaveBeenCalled();
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.scratch.current).toBeNull();
    });

    it('Escape drops the pick-up without touching the node', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.click(200, 0);
      p.escape();
      expect(p.applyEdit).not.toHaveBeenCalled();
      p.click(300, 300);
      p.click(400, 300);
      p.enter();
      // The next path is a new node, not a continuation.
      expect(p.adapter.addNode).toHaveBeenCalledOnce();
      expect(p.applyEdit).not.toHaveBeenCalled();
    });

    it('dragging from the endpoint picks the path up and pulls that anchor\'s handle', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.drag({ x: 100, y: 0 }, { x: 150, y: 0 });
      expect(p.scratch.current!.anchors).toHaveLength(2);
      expect(p.scratch.current!.anchors[1].outHandle).toEqual({ x: 150, y: 0 });
      p.click(200, 50);
      p.enter();
      expect(p.applyEdit).toHaveBeenCalledOnce();
      const [sub] = pathToAnchors(p.scene.n1).anchors;
      expect(sub.map((a) => [a.x, a.y])).toEqual([[0, 0], [100, 0], [200, 50]]);
      expect(sub[1].outHandle).toEqual({ x: 150, y: 0 });
    });

    it('only picks up from idle — mid-path, an endpoint press places an anchor', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(300, 300);
      p.click(100, 0);
      p.enter();
      expect(p.applyEdit).not.toHaveBeenCalled();
      expect(p.adapter.addNode).toHaveBeenCalledOnce();
    });

    it('ignores closed subpaths and interior anchors', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0 L 100 100 Z'), n2: poly('M 200 0 L 300 0 L 300 100') } });
      p.click(0, 0);
      expect(p.scratch.current!.anchors).toHaveLength(1);
      p.escape();
      p.click(300, 0);
      expect(p.scratch.current!.anchors).toHaveLength(1);
    });

    it('finds a kit path node through the real area query', () => {
      // The shape the kit's own pen commits: a rect pose over a pose-local
      // `data.path`, stroked, no fill.
      const node = {
        id: 'k', kind: 'leaf' as const, layer: 'default', parent: null,
        pose: { x: 40, y: 40, width: 100, height: 50 },
        data: { path: poly('M 0 0 L 100 0 L 100 50'), fill: null, stroke: { color: '#000', width: 2 } },
      };
      const scene = {
        layers: [{ id: 'default' }],
        renderOrder: () => ['k'],
        renderOrderNodes: () => [node],
        get: (id: string) => (id === 'k' ? node : undefined),
        overrides: { get: () => undefined },
      } as unknown as Scene<unknown, string, unknown>;
      const applyEdit = vi.fn();
      const p = setup({
        deps: {
          areaSelect: { hitTestArea: (b: Parameters<typeof hitTestArea>[1]) => hitTestArea(scene, b) },
          editAnchors: { getEditablePath: (id: string) => resolveEditablePathOf(scene.get(id as never) as never), applyEdit },
        },
      });
      p.click(143, 88);
      expect(p.scratch.current!.anchors.map((a) => [a.x, a.y])).toEqual([[40, 40], [140, 40], [140, 90]]);
      p.click(200, 90);
      p.enter();
      expect(applyEdit).toHaveBeenCalledOnce();
      expect(applyEdit.mock.calls[0][0]).toBe('k');
    });

    it('the pick-up radius is screen px, like the close radius', () => {
      const p = setup({ scale: 4, paths: { n1: poly('M 0 0 L 100 0') } });
      // 3 world units at 4x is 12 screen px — outside the default 8.
      p.click(103, 0);
      expect(p.scratch.current!.anchors).toHaveLength(1);
      p.escape();
      p.click(101, 0);
      expect(p.scratch.current!.anchors).toHaveLength(2);
    });
  });

  describe('snapping to existing anchors', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    const paths = { n1: poly('M 0 0 L 100 0 L 100 100 Z'), n2: poly('M 300 0 L 400 0 L 500 0') };

    it('a click near an existing anchor lands exactly on it', () => {
      const p = setup({ paths });
      p.click(-50, -50);
      p.click(103, 96);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
    });

    it('snaps to interior anchors too, and starts a new path on one from idle', () => {
      const p = setup({ paths });
      p.click(402, 3);
      expect(p.scratch.current!.anchors).toEqual([{ x: 400, y: 0 }]);
      expect(p.scratch.continuing).toBeNull();
    });

    it('snaps the smooth-anchor base point at drag start', () => {
      const p = setup({ paths });
      p.click(-50, -50);
      p.drag({ x: 97, y: 2 }, { x: 150, y: 50 });
      expect(p.scratch.current!.anchors[1]).toMatchObject({ x: 100, y: 0 });
    });

    it('beats grid snapping, which still applies away from anchors', () => {
      const grid = (q: { x: number; y: number }) => ({ x: Math.round(q.x / 30) * 30, y: Math.round(q.y / 30) * 30 });
      const p = setup({ paths, snapPoint: grid });
      p.click(-50, -50);
      p.click(96, 104);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
      // 6px off an anchor at 1x: outside the default radius, so the grid wins.
      p.click(206, 0);
      expect(p.scratch.current!.anchors[2]).toEqual({ x: 210, y: 0 });
    });

    it('measures the radius in screen px', () => {
      const p = setup({ paths, scale: 4 });
      p.click(-50, -50);
      p.click(103, 100);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 103, y: 100 });
      p.click(101, 100);
      expect(p.scratch.current!.anchors[2]).toEqual({ x: 100, y: 100 });
    });

    it('anchorSnapRadius sets the radius; 0 turns snapping off', () => {
      const wide = setup({ paths, anchorSnapRadius: 20 });
      wide.click(-50, -50);
      wide.click(115, 100);
      expect(wide.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
      const off = setup({ paths, anchorSnapRadius: 0 });
      off.click(-50, -50);
      off.click(101, 100);
      expect(off.scratch.current!.anchors[1]).toEqual({ x: 101, y: 100 });
    });
  });
});
