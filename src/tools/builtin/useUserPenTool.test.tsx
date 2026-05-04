import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserPenTool } from './useUserPenTool';
import type { ToolCtx } from '../types';
import type { PolygonPath } from '../../features/paths/types';

interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

function makeAdapter() {
  const added: Pose[] = [];
  const ids: string[] = [];
  let n = 0;
  const setSelection = vi.fn();
  const addObject = vi.fn((p: Pose) => {
    const id = `o${++n}`;
    added.push(p);
    ids.push(id);
    return id;
  });
  return { added, ids, addObject, setSelection };
}

function setup(over: { autoSelect?: boolean; closeHitRadius?: number } = {}) {
  const adapter = makeAdapter();
  const wrapPath = vi.fn((path: PolygonPath, opts: { closed: boolean }): Pose => ({
    kind: 'path', path, closed: opts.closed,
  }));
  const { result } = renderHook(() => useUserPenTool<Pose>({
    wrapPath, adapter, ...over,
  }));
  // Pen state is persistent — initScratch returns the same ref.
  const scratch = result.current.initScratch!();
  return { tool: result.current, adapter, wrapPath, scratch };
}

function makeCtx<S>(scratch: S, over: Partial<ToolCtx<S>> = {}): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
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

describe('useUserPenTool', () => {
  it('declares id "pen", keybinding P, and a cursor function', () => {
    const { tool } = setup();
    expect(tool.id).toBe('pen');
    expect(tool.keybinding).toBe('P');
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

  it('clicking first anchor (≥3 anchors) closes the subpath → BetweenSubpaths', () => {
    const { tool, scratch } = setup({ closeHitRadius: 8 });
    // Three anchors at (0,0), (100,0), (100,100).
    for (const [x, y] of [[0, 0], [100, 0], [100, 100]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    // Click within close hit radius of first anchor.
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths.length).toBe(1);
    expect(scratch.finishedSubpaths[0].closed).toBe(true);
    expect(scratch.finishedSubpaths[0].anchors.length).toBe(3);
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
    expect(adapter.addObject).toHaveBeenCalledTimes(1);
    expect(adapter.setSelection).toHaveBeenCalledWith([adapter.ids[0]]);
    expect(scratch.current).toBeNull();
    expect(scratch.finishedSubpaths).toEqual([]);
  });

  it('Enter in BetweenSubpaths → commits, returns to Idle', () => {
    const { tool, scratch, adapter, wrapPath } = setup();
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
    expect(adapter.addObject).toHaveBeenCalledTimes(1);
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
    expect(adapter.addObject).not.toHaveBeenCalled();
  });

  it('tool-switch (onDeactivate) with ≥2 anchors → commits', () => {
    const { tool, scratch, adapter, wrapPath } = setup();
    for (const [x, y] of [[0, 0], [50, 0]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.onDeactivate!(makeCtx(scratch));
    expect(adapter.addObject).toHaveBeenCalledTimes(1);
    expect(wrapPath.mock.calls[0][1]).toEqual({ closed: false });
  });

  it('tool-switch with <2 anchors → discards', () => {
    const { tool, scratch, adapter } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.onDeactivate!(makeCtx(scratch));
    expect(adapter.addObject).not.toHaveBeenCalled();
    expect(scratch.current).toBeNull();
  });

  it('autoSelect: false → addObject called but setSelection not called', () => {
    const { tool, scratch, adapter } = setup({ autoSelect: false });
    for (const [x, y] of [[0, 0], [100, 0], [50, 80]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    tool.keyboard!.onDown!(ke('Enter'), makeCtx(scratch));
    expect(adapter.addObject).toHaveBeenCalled();
    expect(adapter.setSelection).not.toHaveBeenCalled();
  });

  it('pointer-move updates cursor and closeHintActive when within radius of first anchor', () => {
    const { tool, scratch } = setup({ closeHitRadius: 8 });
    for (const [x, y] of [[0, 0], [100, 0], [100, 100]] as const) {
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
      tool.pointer!.onClick!(pe(), makeCtx(scratch, { worldX: x, worldY: y }));
    }
    // Far from first anchor.
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 200, worldY: 200 }));
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 200, worldY: 200 }));
    expect(scratch.cursor).toEqual({ x: 200, y: 200 });
    expect(scratch.closeHintActive).toBe(false);
    // Near first anchor.
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 1, worldY: 1 }));
    expect(scratch.closeHintActive).toBe(true);
  });

  it('initScratch returns the same persistent ref across calls', () => {
    const { tool } = setup();
    const a = tool.initScratch!();
    const b = tool.initScratch!();
    expect(a).toBe(b);
  });
});
