// src/tools/dispatcher.hitOverride.test.ts
import { describe, it, expect } from 'vitest';
import { createToolsDispatcher } from './dispatcher';
import type { AnyTool, ToolCtx } from './types';

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { get: () => [], set: () => {}, add: () => {}, remove: () => {}, toggle: () => {}, clear: () => {}, applyClick: () => {} } as never,
    adapter: null,
    applyOps: () => {},
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
    ...over,
  };
}

function pointerEvent(type: string, init: Partial<PointerEventInit> = {}): PointerEvent {
  // jsdom doesn't implement PointerEvent; synthesize via Event + assign.
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

describe('dispatcher: hitOverride hook', () => {
  it('hitOverride returning a value → ctx.target has category:tool, kind, and extra on click', () => {
    let observedTarget: unknown = undefined;

    const tool: AnyTool = {
      id: 'pen-edit',
      hitOverride: () => ({ target: 'anchor', extra: { sub: 0, idx: 2 } }),
      pointer: {
        onClick: (_e, ctx) => {
          observedTarget = ctx.target;
          return 'claim';
        },
      },
    };

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint: () => null,
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 10, clientY: 10 }));

    expect(observedTarget).toEqual({
      category: 'tool',
      kind: 'anchor',
      extra: { sub: 0, idx: 2 },
    });
  });

  it('hitOverride returning null + getNodeAtPoint returning null → ctx.target is empty hit', () => {
    let observedTarget: unknown = undefined;

    const tool: AnyTool = {
      id: 'pen-edit',
      hitOverride: () => null,
      pointer: {
        onClick: (_e, ctx) => {
          observedTarget = ctx.target;
          return 'claim';
        },
      },
    };

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint: () => null,
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 10, clientY: 10 }));

    expect(observedTarget).toEqual({ category: 'empty', kind: 'empty' });
  });

  it('hitOverride fires on pointerdown (target captured into startTarget for drag routing)', () => {
    let observedTargetOnStart: unknown = undefined;

    const tool: AnyTool = {
      id: 'pen-edit',
      hitOverride: () => ({ target: 'handle', extra: { nodeId: 'n1', handleIdx: 1 } }),
      drag: {
        onStart: (_e, ctx) => {
          observedTargetOnStart = ctx.target;
          return undefined;
        },
      },
    };

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint: () => null,
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    // Cross the threshold to promote to drag
    dispatcher.onPointerMove(pointerEvent('pointermove', { clientX: 50, clientY: 50 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));

    expect(observedTargetOnStart).toEqual({
      category: 'tool',
      kind: 'handle',
      extra: { nodeId: 'n1', handleIdx: 1 },
    });
  });

  it('tool without hitOverride is not affected — still gets empty hit when getNodeAtPoint returns null', () => {
    let observedTarget: unknown = undefined;

    const tool: AnyTool = {
      id: 'plain',
      pointer: {
        onClick: (_e, ctx) => {
          observedTarget = ctx.target;
          return 'claim';
        },
      },
    };

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: tool, ambient: [] }),
      getCtx: makeCtx as unknown as (overrides?: { clientX?: number; clientY?: number }) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint: () => null,
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 10, clientY: 10 }));

    expect(observedTarget).toEqual({ category: 'empty', kind: 'empty' });
  });
});
