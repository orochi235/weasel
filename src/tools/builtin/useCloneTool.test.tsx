import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCloneTool } from './useCloneTool';
import { cloneByAltDrag } from 'interactions/gestures/clone/behaviors/cloneByAltDrag';
import type { InsertAdapter, Op } from '../../index';
import type { ToolCtx } from '../types';

interface Obj { id: string }

function makeAdapter(opts: { selection?: string[] } = {}) {
  const applied: Array<{ ops: Op[]; label: string }> = [];
  const idsLog: string[][] = [];
  const adapter: InsertAdapter<Obj> = {
    commitInsert: () => null,
    commitPaste: (snap) => snap.items.map((item) => ({ id: `new-${(item as { id: string }).id}` }) as Obj),
    snapshotSelection: (ids) => { idsLog.push([...ids]); return { items: ids.map((id) => ({ id })) }; },
    insertNode: () => {},
    setSelection: () => {},
    applyOps: (ops, label) => { applied.push({ ops, label: label ?? '' }); },
    getSelection: () => opts.selection ?? [],
  };
  return { adapter, applied, idsLog };
}

function setup(
  hitId: string | null = 'a',
  opts: { selection?: string[]; cloneSelection?: boolean } = {},
) {
  const { adapter, applied, idsLog } = makeAdapter({ selection: opts.selection });
  const drawGhost = vi.fn(() => []);
  const pickBest = vi.fn(() => hitId);
  const { result } = renderHook(() =>
    useCloneTool(adapter, {
      behaviors: [cloneByAltDrag()],
      pickBest,
      drawGhost,
      cloneSelection: opts.cloneSelection,
    }),
  );
  return { tool: result.current, applied, idsLog, drawGhost, pickBest };
}

function makeCtx<S>(scratch: S, over: Partial<ToolCtx<S>> = {}): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0 });
  return e;
}

const altMods = { alt: true, shift: false, meta: false, ctrl: false, space: false };

describe('useCloneTool', () => {
  it('declares default id, cursor, and overlay layer', () => {
    const { tool } = setup();
    expect(tool.id).toBe('clone');
    expect(tool.cursor).toBe('copy');
    expect(tool.overlay).toBeDefined();
    expect(tool.overlay!.id).toBe('clone-ghost');
  });

  it('respects custom id / cursor options', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useCloneTool(adapter, {
        behaviors: [cloneByAltDrag()],
        pickBest: () => null,
        drawGhost: () => [],
        id: 'dup',
        cursor: 'crosshair',
      }),
    );
    expect(result.current.id).toBe('dup');
    expect(result.current.cursor).toBe('crosshair');
  });

  it('pointer.onDown without activating modifier passes through', () => {
    const { tool, pickBest } = setup();
    const scratch = tool.initScratch!();
    expect(tool.pointer!.onDown!(pe(), makeCtx(scratch))).toBe('pass');
    expect(pickBest).not.toHaveBeenCalled();
    expect(scratch.pendingId).toBeNull();
  });

  it('pointer.onDown with alt but no hit passes through', () => {
    const { tool, pickBest } = setup(null);
    const scratch = tool.initScratch!();
    expect(
      tool.pointer!.onDown!(pe(), makeCtx(scratch, { modifiers: altMods })),
    ).toBe('pass');
    expect(pickBest).toHaveBeenCalled();
    expect(scratch.pendingId).toBeNull();
  });

  it('pointer.onDown with alt + hit claims and stashes pendingId/pendingMods', () => {
    const { tool } = setup('a');
    const scratch = tool.initScratch!();
    const ctx = makeCtx(scratch, { worldX: 5, worldY: 7, modifiers: altMods });
    expect(tool.pointer!.onDown!(pe(), ctx)).toBe('claim');
    expect(scratch.pendingId).toBe('a');
    expect(scratch.pendingMods).toEqual(altMods);
  });

  it('drag.onStart with no pendingId passes through', () => {
    const { tool } = setup();
    const scratch = tool.initScratch!();
    expect(tool.drag!.onStart!(pe(), makeCtx(scratch))).toBe('pass');
  });

  it('full drag lifecycle commits one applyOps', () => {
    const { tool, applied } = setup('a');
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    expect(tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }))).toBe('claim');
    expect(tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 10, worldY: 10, modifiers: altMods }))).toBe('claim');
    expect(tool.drag!.onEnd!(pe(), makeCtx(scratch))).toBe('claim');
    expect(applied).toHaveLength(1);
  });

  it('drag.onMove without an active clone passes through', () => {
    const { tool } = setup();
    const scratch = tool.initScratch!();
    expect(tool.drag!.onMove!(pe(), makeCtx(scratch))).toBe('pass');
  });

  it('drag.onCancel cancels in-flight clone without dispatching', () => {
    const { tool, applied } = setup('a');
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 5, worldY: 5, modifiers: altMods }));
    tool.drag!.onCancel!(makeCtx(scratch));
    expect(applied).toHaveLength(0);
  });

  it('cloneSelection=false: clones just the hit even when hit is selected', () => {
    const { tool, idsLog } = setup('a', { selection: ['a', 'b', 'c'] });
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    expect(idsLog[0]).toEqual(['a']);
  });

  it('cloneSelection=true: hit in selection → clones the whole selection', () => {
    const { tool, applied, idsLog } = setup('a', { selection: ['a', 'b', 'c'], cloneSelection: true });
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    expect(idsLog[0]).toEqual(['a', 'b', 'c']);
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 10, worldY: 10, modifiers: altMods }));
    tool.drag!.onEnd!(pe(), makeCtx(scratch));
    expect(applied).toHaveLength(1);
    // 3 InsertOps (one per cloned item) + 1 SetSelectionOp = 4 total
    expect(applied[0].ops).toHaveLength(4);
  });

  it('cloneSelection=true: hit NOT in selection → clones just the hit', () => {
    const { tool, idsLog } = setup('a', { selection: ['b', 'c'], cloneSelection: true });
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    expect(idsLog[0]).toEqual(['a']);
  });

  it('cloneSelection=true: empty selection → clones just the hit', () => {
    const { tool, idsLog } = setup('a', { selection: [], cloneSelection: true });
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    expect(idsLog[0]).toEqual(['a']);
  });

  it('cloneSelection=true: adapter without getSelection → clones just the hit (no crash)', () => {
    const { adapter, idsLog } = makeAdapter();
    // Remove getSelection entirely
    const adapterWithoutGetSelection = { ...adapter, getSelection: undefined } as unknown as typeof adapter;
    const { result } = renderHook(() =>
      useCloneTool(adapterWithoutGetSelection, {
        behaviors: [cloneByAltDrag()],
        pickBest: () => 'a',
        drawGhost: () => [],
        cloneSelection: true,
      }),
    );
    const tool = result.current;
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    expect(() => {
      tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0, modifiers: altMods }));
    }).not.toThrow();
    expect(idsLog[0]).toEqual(['a']);
  });
});
