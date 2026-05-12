// src/tools/routing/defineTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { defineTool } from './defineTool';
import { apply, begin, hold, commit, cancel, claim } from './result';
import { asNodeId } from '../../core/scene/types';
import type { Op } from '../../core/ops/types';
import type { RenderLayer } from '../../core/layers/render';

const noMods = { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false };
const stubOp: Op = { apply: () => {}, invert: () => stubOp };

function buildCtx(overrides: Record<string, unknown> = {}) {
  return {
    worldX: 0, worldY: 0,
    point: { x: 0, y: 0 },
    modifiers: noMods,
    selection: { current: [] as unknown },
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: vi.fn(),
    canvasRect: { left: 0, top: 0, width: 100, height: 100 } as DOMRect,
    target: { category: 'empty' as const, kind: 'empty' as const },
    scratch: null,
    ...overrides,
  };
}

describe('defineTool — basic translation', () => {
  it('produces a Tool with id and presentation', () => {
    const tool = defineTool({
      id: 'test',
      presentation: { label: 'Test', group: 'select' },
      initial: {},
    });
    expect(tool.id).toBe('test');
    expect(tool.presentation?.label).toBe('Test');
  });

  it('phase-free click action fires apply', () => {
    const tool = defineTool({
      id: 'test',
      initial: {
        click: { '*': () => apply([stubOp], 'Test') },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(ctx.applyOps).toHaveBeenCalledWith([stubOp], 'Test');
  });

  it('begin opens engaged phase by setting scratch', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({ scratch: { x: 1 } }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ x: 1 });
  });

  it('hold updates scratch within engaged', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { x: 1 },
          onMove: (ctx) => hold({ x: ctx.scratch.x + 1 }),
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    tool.drag?.onMove?.(new MouseEvent('mousemove') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: { x: number } }).scratch).toEqual({ x: 2 });
  });

  it('commit applies ops and closes engaged', () => {
    const tool = defineTool<{ done: boolean }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { done: false },
          onRelease: () => commit([stubOp], 'Done'),
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    tool.drag?.onEnd?.(new MouseEvent('mouseup') as unknown as PointerEvent, ctx as never);
    expect(ctx.applyOps).toHaveBeenCalledWith([stubOp], 'Done');
    expect((ctx as { scratch: unknown }).scratch).toBeNull();
  });

  it('cancel closes engaged without applying', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { x: 1 },
          onCancel: () => undefined,
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    tool.drag?.onCancel?.(ctx as never);
    expect(ctx.applyOps).not.toHaveBeenCalled();
    expect((ctx as { scratch: unknown }).scratch).toBeNull();
  });

  it('engaged.click routes when scratch is set', () => {
    const onAnchorClick = vi.fn(() => apply([stubOp]));
    const tool = defineTool<{ anchors: number[] }>({
      id: 'pen',
      initial: {
        click: { 'empty': () => begin({ scratch: { anchors: [0] } }) },
      },
      engaged: {
        click: { '*': onAnchorClick },
      },
    });
    const ctx = buildCtx();
    // First click opens engaged phase
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ anchors: [0] });
    // Second click — now engaged, routes through engaged.click
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(onAnchorClick).toHaveBeenCalledTimes(1);
  });

  it('cursor resolves with phase override', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      cursor: 'grab',
      engaged: { cursor: 'grabbing' },
      initial: { drag: () => begin({ scratch: { x: 0 } }) },
    });
    const ctx = buildCtx();
    // Idle: top-level cursor
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grab');
    // Open engaged phase
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    // Engaged: phase cursor override
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grabbing');
  });

  it('claim suppresses fall-through', () => {
    const tool = defineTool({
      id: 'test',
      initial: { click: { '*': () => claim() } },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const result = tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(result).toBe('claim');
  });

  it('forwards initial.overlay onto Tool.overlay', () => {
    const layer: RenderLayer<unknown> = {
      id: 'fixture-overlay',
      label: 'Fixture',
      space: 'screen',
      draw: () => [],
    };
    const tool = defineTool({
      id: 'fixture',
      initial: { overlay: () => layer },
    });
    expect(tool.overlay).toBe(layer);
  });

  it('omits Tool.overlay when no phase.overlay is defined', () => {
    const tool = defineTool({ id: 'fixture-no-overlay', initial: {} });
    expect(tool.overlay).toBeUndefined();
  });

  it('claimsAll as a function is evaluated per call', () => {
    let scratchVal: { engaged: boolean } = { engaged: false };
    const tool = defineTool<{ engaged: boolean }>({
      id: 'fixture-modal',
      initial: { claimsAll: (ctx) => ctx.scratch?.engaged === true },
    });
    const baseCtx = {
      worldX: 0, worldY: 0,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
      selection: {} as never, adapter: {}, applyOps: () => {},
      view: {} as never, canvasRect: {} as never, scratch: scratchVal,
    };
    expect(tool.claimsAll!(baseCtx as never)).toBe(false);
    scratchVal = { engaged: true };
    expect(tool.claimsAll!({ ...baseCtx, scratch: scratchVal } as never)).toBe(true);
  });

  it('claimsAll as boolean still works', () => {
    const tool = defineTool({
      id: 'fixture-static-claim',
      initial: { claimsAll: true },
    });
    expect(tool.claimsAll!({ scratch: null } as never)).toBe(true);
  });

  it('claimsAll absent returns false', () => {
    const tool = defineTool({ id: 'fixture-no-claim', initial: {} });
    expect(tool.claimsAll!({ scratch: null } as never)).toBe(false);
  });
});

describe('defineTool — pointerDown route', () => {
  it('emits a pointer.onDown handler when initial.pointerDown is defined', () => {
    const tool = defineTool({
      id: 'test',
      initial: {
        pointerDown: { 'rect': () => claim() },
      },
    });
    expect(tool.pointer?.onDown).toBeDefined();
  });

  it('omits pointer.onDown when no pointerDown route table is defined', () => {
    const tool = defineTool({
      id: 'test',
      initial: { click: { '*': () => apply([stubOp]) } },
    });
    expect(tool.pointer?.onDown).toBeUndefined();
  });

  it('pointerDown action fires before any threshold gate (sets scratch via begin)', () => {
    const tool = defineTool<{ classification: string }>({
      id: 'test',
      initial: {
        pointerDown: {
          'rect': () => begin({
            scratch: { classification: 'in-selection' },
          }),
        },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ classification: 'in-selection' });
  });

  it('pointerDown returning none falls through (pass)', () => {
    const tool = defineTool({
      id: 'test',
      initial: {
        pointerDown: { 'rect': () => ({ kind: 'none' as const }) },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const result = tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect(result).toBe('pass');
  });

  it('engaged.pointerDown routes when scratch is set', () => {
    const onAnchorDown = vi.fn(() => claim());
    const tool = defineTool<{ anchors: number[] }>({
      id: 'pen',
      initial: {
        pointerDown: { 'empty': () => begin({ scratch: { anchors: [] } }) },
      },
      engaged: {
        pointerDown: { '*': onAnchorDown },
      },
    });
    const ctx = buildCtx();
    // First down opens engaged phase
    tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    // Second down — now engaged
    tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect(onAnchorDown).toHaveBeenCalledTimes(1);
  });
});

describe('defineTool — raw event in ActionFn', () => {
  it('passes the raw PointerEvent to a click ActionFn', () => {
    const seen: Array<PointerEvent | KeyboardEvent | WheelEvent | undefined> = [];
    const tool = defineTool({
      id: 'test',
      initial: {
        click: {
          'rect': (_ctx, e) => {
            seen.push(e);
            return claim();
          },
        },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const evt = new MouseEvent('click') as unknown as PointerEvent;
    tool.pointer?.onClick?.(evt, ctx as never);
    expect(seen[0]).toBe(evt);
  });

  it('passes the raw PointerEvent to a dblTap ActionFn', () => {
    const seen: Array<PointerEvent | KeyboardEvent | WheelEvent | undefined> = [];
    const tool = defineTool({
      id: 'test',
      initial: {
        dblTap: {
          'rect': (_ctx, e) => {
            seen.push(e);
            return claim();
          },
        },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const evt = new MouseEvent('click') as unknown as PointerEvent;
    tool.dblTap?.onTap?.(evt, ctx as never);
    expect(seen[0]).toBe(evt);
  });

  it('passes the raw PointerEvent to BeginSpec.onMove and onRelease', () => {
    const moveEvents: Array<PointerEvent | undefined> = [];
    const releaseEvents: Array<PointerEvent | undefined> = [];
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { x: 0 },
          onMove: (_ctx, e) => {
            moveEvents.push(e);
            return hold({ x: 1 });
          },
          onRelease: (_ctx, e) => {
            releaseEvents.push(e);
            return commit([stubOp]);
          },
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    const moveEvt = new MouseEvent('mousemove') as unknown as PointerEvent;
    tool.drag?.onMove?.(moveEvt, ctx as never);
    expect(moveEvents[0]).toBe(moveEvt);
    const upEvt = new MouseEvent('mouseup') as unknown as PointerEvent;
    tool.drag?.onEnd?.(upEvt, ctx as never);
    expect(releaseEvents[0]).toBe(upEvt);
  });

  it('existing ActionFns that ignore the event parameter still work', () => {
    // The whole point of making `event` optional: ActionFns written
    // before Phase 4.5 (taking only `ctx`) must continue to compile and
    // behave identically.
    const tool = defineTool({
      id: 'test',
      initial: { click: { '*': (_ctx) => apply([stubOp], 'Test') } },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(ctx.applyOps).toHaveBeenCalledWith([stubOp], 'Test');
  });
});
