import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePenTool } from './usePenTool';
import type { ToolCtx } from '../../types';
import type { PolygonPath } from 'features/paths/types';

interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

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
 * Wrap a tool's gesture handlers so each invocation runs inside act(). usePenTool
 * calls forceRender (a useReducer dispatch + setIsEditing) from most handlers to
 * repaint its overlay; driving those handlers directly from a test — outside any
 * act() boundary — makes React log "An update to TestComponent was not wrapped in
 * act(...)". Wrapping the calls acts the updates instead. Deterministic, unlike a
 * trailing flush: a wrapped update never warns.
 */
function actWrapTool<T extends {
  pointer?: unknown; drag?: unknown; keyboard?: unknown; onActivate?: unknown; onDeactivate?: unknown;
}>(tool: T): T {
  const wrapFn = (fn: (...a: unknown[]) => unknown) => (...a: unknown[]): unknown => {
    let r: unknown;
    act(() => { r = fn(...a); });
    return r;
  };
  const wrapMethod = (fn: unknown): unknown =>
    typeof fn === 'function' ? wrapFn(fn as (...a: unknown[]) => unknown) : fn;
  const wrapGroup = (g: unknown): unknown => {
    if (!g || typeof g !== 'object') return g;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
      out[k] = typeof v === 'function' ? wrapFn(v as (...a: unknown[]) => unknown) : v;
    }
    return out;
  };
  return {
    ...tool,
    pointer: wrapGroup(tool.pointer), drag: wrapGroup(tool.drag), keyboard: wrapGroup(tool.keyboard),
    onActivate: wrapMethod(tool.onActivate), onDeactivate: wrapMethod(tool.onDeactivate),
  };
}

function setup(over: {
  autoSelect?: boolean;
  autoCommitOnClose?: boolean;
  closeHitRadius?: number;
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
} = {}) {
  const adapter = makeAdapter();
  const wrapPath = vi.fn((path: PolygonPath, opts: { closed: boolean }): Pose => ({
    kind: 'path', path, closed: opts.closed,
  }));
  const { result } = renderHook(() => usePenTool<Pose>({
    wrapPath, adapter, ...over,
  }));
  // Pen state is persistent — initScratch returns the same ref.
  const rawTool = result.current;
  const scratch = rawTool.initScratch!();
  const tool = actWrapTool(rawTool);
  return { tool, adapter, wrapPath, scratch };
}

function makeCtx<S>(scratch: S, over: Partial<ToolCtx<S>> = {}): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    // The declarative routing factory rejects pointerDown/click handlers
    // when ctx.target is undefined (the dispatcher always supplies one in
    // production). Default to an empty hit so the '*' route fires.
    target: { category: 'empty', kind: 'empty' } as ToolCtx['target'],
    scratch,
    ...over,
  };
}

function pe(clientX = 0, clientY = 0): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX, clientY, button: 0 });
  return e;
}

function ke(key: string): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key });
  return e;
}

describe('usePenTool', () => {
  it('declares id "pen" and a cursor function', () => {
    const { tool } = setup();
    expect(tool.id).toBe('pen');
    // keybinding field removed from ToolDef; key activation is now registered
    // as a `tool.shortcut.pen` action via useKeybindings.
    expect(typeof tool.cursor).toBe('function');
  });

  it('cursor is "crosshair" normally, "pointer" when closeHintActive', () => {
    const { tool, scratch } = setup();
    const cursor = tool.cursor as (c: ToolCtx<typeof scratch>) => string;
    expect(cursor(makeCtx(scratch))).toBe('crosshair');
    scratch.closeHintActive = true;
    expect(cursor(makeCtx(scratch))).toBe('pointer');
    scratch.closeHintActive = false;
  });

  it('click on empty space (Idle) → places a corner anchor and enters Drawing', () => {
    const { tool, scratch } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 10, worldY: 20 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 10, worldY: 20 }));
    expect(scratch.current).not.toBeNull();
    expect(scratch.current!.anchors).toEqual([
      { x: 10, y: 20 },
    ]);
    expect(scratch.finishedSubpaths).toEqual([]);
  });

  it('second click in Drawing → appends corner anchor', () => {
    const { tool, scratch } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 10, worldY: 20 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 10, worldY: 20 }));
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 30, worldY: 40 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 30, worldY: 40 }));
    expect(scratch.current!.anchors.length).toBe(2);
    expect(scratch.current!.anchors[1]).toEqual({ x: 30, y: 40 });
  });

  it('drag → places anchor with outHandle at the drag end', () => {
    const { tool, scratch } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 10, worldY: 20 }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 14, worldY: 20 }));
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 50, worldY: 20 }));
    tool.drag!.onEnd!(pe(), makeCtx(scratch, { worldX: 50, worldY: 20 }));
    expect(scratch.current!.anchors.length).toBe(1);
    const a = scratch.current!.anchors[0];
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(a.outHandle).toEqual({ x: 50, y: 20 });
  });

  it('Alt held during placement drag → marks altBroken on the anchor', () => {
    const { tool, scratch } = setup();
    const altMods = { alt: true, shift: false, meta: false, ctrl: false, space: false };
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 5, worldY: 0, modifiers: altMods }));
    tool.drag!.onEnd!(pe(), makeCtx(scratch, { worldX: 20, worldY: 0, modifiers: altMods }));
    expect(scratch.current!.anchors[0].altBroken).toBe(true);
  });

  it('Shift held during drag → constrains outHandle direction to 45°', () => {
    const { tool, scratch } = setup();
    const shiftMods = { alt: false, shift: true, meta: false, ctrl: false, space: false };
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: shiftMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 10, worldY: 1, modifiers: shiftMods }));
    tool.drag!.onEnd!(pe(), makeCtx(scratch, { worldX: 10, worldY: 1, modifiers: shiftMods }));
    const out = scratch.current!.anchors[0].outHandle!;
    // (10,1) snaps to horizontal — y close to 0.
    expect(out.y).toBeCloseTo(0);
    expect(out.x).toBeGreaterThan(0);
  });

  it('clicking first anchor (≥3 anchors) closes the subpath and auto-commits (default)', () => {
    const { tool, scratch, adapter, wrapPath } = setup({ closeHitRadius: 8 });
    // Three anchors at (0,0), (100,0), (100,100).
    for (const [x, y] of [[0, 0], [100, 0], [100, 100]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    // Click within close hit radius of first anchor.
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    expect(wrapPath).toHaveBeenCalledTimes(1);
    expect(wrapPath.mock.calls[0][1]).toEqual({ closed: true });
    expect(adapter.addNode).toHaveBeenCalledTimes(1);
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths).toEqual([]);
  });

  it('autoCommitOnClose: false → close-on-first-anchor parks the subpath in scratch (BetweenSubpaths)', () => {
    const { tool, scratch, adapter } = setup({ closeHitRadius: 8, autoCommitOnClose: false });
    for (const [x, y] of [[0, 0], [100, 0], [100, 100]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths.length).toBe(1);
    expect(scratch.finishedSubpaths[0].closed).toBe(true);
    expect(scratch.finishedSubpaths[0].anchors.length).toBe(3);
    expect(adapter.addNode).not.toHaveBeenCalled();
  });

  it('clicking first anchor with <3 anchors → no-op (degenerate)', () => {
    const { tool, scratch } = setup();
    for (const [x, y] of [[0, 0], [50, 0]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    // Should append (or treat as a 3rd-anchor click, not close).
    expect(scratch.current).not.toBeNull();
    expect(scratch.finishedSubpaths.length).toBe(0);
    // The third click landed near (0,0) so it appended at (1,1).
    expect(scratch.current!.anchors.length).toBe(3);
  });

  it('Enter in Drawing → open-finishes current subpath, commits, auto-selects, returns to Idle', () => {
    const { tool, scratch, adapter, wrapPath } = setup();
    for (const [x, y] of [[0, 0], [100, 0], [100, 100]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    const dec = tool.keyboard!.onDown!(ke('Enter'), makeCtx(scratch));
    expect(dec).toBe('claim');
    expect(wrapPath).toHaveBeenCalledTimes(1);
    expect(wrapPath.mock.calls[0][1]).toEqual({ closed: false });
    expect(adapter.addNode).toHaveBeenCalledTimes(1);
    expect(adapter.setSelection).toHaveBeenCalledWith([adapter.ids[0]]);
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths).toEqual([]);
  });

  it('Enter in BetweenSubpaths → commits, returns to Idle', () => {
    const { tool, scratch, adapter, wrapPath } = setup({ autoCommitOnClose: false });
    // Build + close a subpath.
    for (const [x, y] of [[0, 0], [100, 0], [100, 100]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    // BetweenSubpaths now.
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths.length).toBe(1);
    tool.keyboard!.onDown!(ke('Enter'), makeCtx(scratch));
    expect(wrapPath).toHaveBeenCalledTimes(1);
    expect(wrapPath.mock.calls[0][1]).toEqual({ closed: true });
    expect(adapter.addNode).toHaveBeenCalledTimes(1);
  });

  it('Esc → discards everything', () => {
    const { tool, scratch, adapter } = setup();
    for (const [x, y] of [[0, 0], [50, 0]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.keyboard!.onDown!(ke('Escape'), makeCtx(scratch));
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths).toEqual([]);
    expect(adapter.addNode).not.toHaveBeenCalled();
  });

  it('tool-switch (onDeactivate) discards in-progress path regardless of anchor count', () => {
    // Mirrors the Escape contract: an in-progress path is by definition
    // incomplete (user didn't close-on-first / cmd-click / press Enter).
    // Switching tools should NOT auto-commit a stub polyline.
    const { tool, scratch, adapter } = setup();
    for (const [x, y] of [[0, 0], [50, 0], [100, 0]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.onDeactivate!(makeCtx(scratch));
    expect(adapter.addNode).not.toHaveBeenCalled();
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths).toEqual([]);
  });

  it('tool-switch with <2 anchors → discards', () => {
    const { tool, scratch, adapter } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.onDeactivate!(makeCtx(scratch));
    expect(adapter.addNode).not.toHaveBeenCalled();
    expect(scratch.current).toBeNull();
  });

  it('autoSelect: false → addNode called but setSelection not called', () => {
    const { tool, scratch, adapter } = setup({ autoSelect: false });
    for (const [x, y] of [[0, 0], [100, 0], [50, 80]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.keyboard!.onDown!(ke('Enter'), makeCtx(scratch));
    expect(adapter.addNode).toHaveBeenCalled();
    expect(adapter.setSelection).not.toHaveBeenCalled();
  });

  // The rubber-band cursor update on hover (no drag in flight) was driven
  // through drag.onMove in the pre-migration imperative tool. The
  // declarative routing factory gates drag.onMove behind drag.onStart's
  // begin() — matching the runtime dispatcher contract, where onMove is
  // only fired after threshold-promoted onStart. The hover-preview hook
  // is therefore unreachable through the tool's drag channel and would
  // need a separate overlay-level onUncapturedMove wiring; the pre-
  // migration imperative pen tested dead code via a direct method call.
  // See usePenTool.ts pointerDown/drag comments for details.

  it('initScratch returns the same persistent ref across calls', () => {
    const { tool } = setup();
    let a: unknown, b: unknown;
    act(() => { a = tool.initScratch!(); });
    act(() => { b = tool.initScratch!(); });
    expect(a).toBe(b);
  });

  describe('Cmd+click open-finish (Illustrator convention)', () => {
    it('Cmd+click after ≥2 anchors commits and clears the path', () => {
      const { tool, adapter, scratch } = setup();
      for (const [x, y] of [[0, 0], [50, 0], [50, 50]] as const) {
        tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
        tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      }
      tool.pointer!.onDown!(pe(), makeCtx(scratch, {
        worldX: 200, worldY: 200,
        modifiers: { alt: false, shift: false, meta: true, ctrl: false, space: false },
      }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, {
        worldX: 200, worldY: 200,
        modifiers: { alt: false, shift: false, meta: true, ctrl: false, space: false },
      }));
      expect(adapter.addNode).toHaveBeenCalledTimes(1);
      expect(scratch.current).toBeNull();
      // The committed pose is open (Cmd+click is open-finish).
      const lastWrap = adapter.added[adapter.added.length - 1];
      expect(lastWrap.closed).toBe(false);
    });

    it('Cmd+click with <2 anchors does NOT commit', () => {
      const { tool, adapter, scratch } = setup();
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.pointer!.onDown!(pe(), makeCtx(scratch, {
        worldX: 50, worldY: 50,
        modifiers: { alt: false, shift: false, meta: true, ctrl: false, space: false },
      }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, {
        worldX: 50, worldY: 50,
        modifiers: { alt: false, shift: false, meta: true, ctrl: false, space: false },
      }));
      expect(adapter.addNode).not.toHaveBeenCalled();
      // The Cmd+click fell through to corner-anchor placement.
      expect(scratch.current!.anchors).toHaveLength(2);
    });

    it('Ctrl+click works the same as Cmd+click (cross-platform)', () => {
      const { tool, adapter, scratch } = setup();
      for (const [x, y] of [[0, 0], [50, 0]] as const) {
        tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
        tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      }
      tool.pointer!.onDown!(pe(), makeCtx(scratch, {
        worldX: 200, worldY: 200,
        modifiers: { alt: false, shift: false, meta: false, ctrl: true, space: false },
      }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, {
        worldX: 200, worldY: 200,
        modifiers: { alt: false, shift: false, meta: false, ctrl: true, space: false },
      }));
      expect(adapter.addNode).toHaveBeenCalledTimes(1);
    });
  });

  describe('double-click last anchor open-finish (Illustrator convention)', () => {
    it('two clicks on the same spot within 300ms commit as open path', () => {
      const { tool, adapter, scratch } = setup();
      // Place two anchors first.
      for (const [x, y] of [[0, 0], [50, 0]] as const) {
        tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
        tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      }
      // Second click on the last anchor → open-finish.
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 50, worldY: 0 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 50, worldY: 0 }));
      expect(adapter.addNode).toHaveBeenCalledTimes(1);
      expect(adapter.added[0].closed).toBe(false);
      expect(scratch.current).toBeNull();
    });

    it('does NOT trigger when the second click lands far from the last anchor', () => {
      const { tool, adapter, scratch } = setup();
      for (const [x, y] of [[0, 0], [50, 0]] as const) {
        tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
        tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      }
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 500, worldY: 500 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 500, worldY: 500 }));
      expect(adapter.addNode).not.toHaveBeenCalled();
      expect(scratch.current!.anchors).toHaveLength(3);
    });

    it('does NOT trigger when interval exceeds 300ms', () => {
      const { tool, adapter, scratch } = setup();
      for (const [x, y] of [[0, 0], [50, 0]] as const) {
        tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
        tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      }
      // Force the last-click timestamp far back in time.
      scratch._lastClick = { t: performance.now() - 1000, x: 50, y: 0 };
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 50, worldY: 0 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 50, worldY: 0 }));
      expect(adapter.addNode).not.toHaveBeenCalled();
      expect(scratch.current!.anchors).toHaveLength(3);
    });

    it('does NOT trigger with <2 anchors (single anchor + repeat click)', () => {
      const { tool, adapter, scratch } = setup();
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      expect(adapter.addNode).not.toHaveBeenCalled();
    });
  });

  describe('snapPoint', () => {
    const SPACING = 10;
    const grid = (p: { x: number; y: number }) => ({
      x: Math.round(p.x / SPACING) * SPACING,
      y: Math.round(p.y / SPACING) * SPACING,
    });

    it('snaps corner-anchor click placement to the grid', () => {
      const { tool, scratch } = setup({ snapPoint: grid });
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 12, worldY: 18 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 12, worldY: 18 }));
      expect(scratch.current!.anchors).toEqual([{ x: 10, y: 20 }]);
    });

    it('snaps smooth-anchor base point on drag.onStart', () => {
      const { tool, scratch } = setup({ snapPoint: grid });
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 23, worldY: 7 }));
      tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 25, worldY: 9 }));
      // Anchor base is the snapped pendingDown coords.
      expect(scratch.current!.anchors[0].x).toBe(20);
      expect(scratch.current!.anchors[0].y).toBe(10);
    });

    // Rubber-band cursor preview (no drag in flight) was driven via
    // drag.onMove pre-migration — see comment above the deleted
    // 'pointer-move updates cursor and closeHintActive' test. Path is
    // unreachable through the declarative factory's drag channel.

    it('snaps the outgoing-handle target while dragging a handle', () => {
      const { tool, scratch } = setup({ snapPoint: grid });
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
      tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 27, worldY: 32 }));
      const a = scratch.current!.anchors[0];
      expect(a.outHandle).toEqual({ x: 30, y: 30 });
    });

    it('passthrough (no snapPoint) preserves raw coords', () => {
      const { tool, scratch } = setup();
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 12, worldY: 18 }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 12, worldY: 18 }));
      expect(scratch.current!.anchors).toEqual([{ x: 12, y: 18 }]);
    });
  });
});
