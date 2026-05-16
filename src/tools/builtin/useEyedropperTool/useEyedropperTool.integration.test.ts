// Integration tests for useEyedropperTool through the dispatcher, mirroring
// the way swillustrator wires it: registry-active (sticky `I`), hotkey-engaged
// (alt-hold), and a getNodeAtPoint callback that derives `ctx.target.category`.
//
// These complement the unit tests in useEyedropperTool.test.ts (which call the
// pointer.onClick handler directly with a hand-built ToolCtx) by walking the
// full pointerdown → pointerup path so the slot-order / claim-priority logic
// is exercised end-to-end.

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createToolsDispatcher } from '../../dispatcher';
import { defineTool } from '../../defineTool';
import { useEyedropperTool } from './useEyedropperTool';
import type { AnyTool, ToolCtx } from '../../types';
import type { NodeId } from 'core/scene/types';

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {
      get: () => [], set: () => {}, add: () => {}, remove: () => {},
      toggle: () => {}, clear: () => {}, applyClick: () => {},
    } as never,
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
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

// A getNodeAtPoint that always returns a single 'rect' node — matches the
// swillustrator pattern of returning the topmost item under the cursor.
const getNodeAtPoint = () => ({
  id: 'r1' as NodeId,
  kind: 'rect',
  pose: { x: 0, y: 0, width: 100, height: 100 },
  data: {},
});

describe('useEyedropperTool through the dispatcher', () => {
  it('active-slot click on a rect routes through pickFromNode to onPick', () => {
    // Mirrors swillustrator after the user presses `I` to switch tools:
    // slots.active = eyedropper, slots.hotkey = null.
    const onPick = vi.fn();
    const colorOf = () => '#7fb069';
    const { result } = renderHook(() => useEyedropperTool({ onPick, colorOf }));
    const eyedropper = result.current as unknown as AnyTool;

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: eyedropper, ambient: [] }),
      getCtx: makeCtx as unknown as (
        overrides?: { clientX?: number; clientY?: number }
      ) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint,
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));

    expect(onPick).toHaveBeenCalledWith('#7fb069');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('hotkey-slot click pre-empts an active tool that claims at pointerdown', () => {
    // Mirrors swillustrator while the user holds Alt: slots.hotkey = eyedropper,
    // slots.active = select-like-tool whose pointer.onDown always claims (the
    // useSelectTool pattern). Without proper priority the select tool would win
    // and the eyedropper would never run — this test pins that down.
    const onPick = vi.fn();
    const colorOf = () => '#abcdef';
    const { result } = renderHook(() => useEyedropperTool({ onPick, colorOf }));
    const eyedropper = result.current as unknown as AnyTool;

    // Stand-in for useSelectTool: always claims pointerdown so it would
    // consume the gesture if no higher-priority slot pre-empts it.
    const selectStub: AnyTool = defineTool({
      id: 'select-stub',
      pointer: {
        onDown: () => 'claim',
        onClick: () => 'claim',
      },
    });

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: eyedropper, active: selectStub, ambient: [] }),
      getCtx: makeCtx as unknown as (
        overrides?: { clientX?: number; clientY?: number }
      ) => Omit<ToolCtx, 'scratch'>,
      getNodeAtPoint,
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));

    expect(onPick).toHaveBeenCalledWith('#abcdef');
  });

  it('without getNodeAtPoint, every click is classified as empty → onPick never fires', () => {
    // Regression guard for the swillustrator bug: omitting `getNodeAtPoint`
    // from `useTools` makes the dispatcher fall back to empty hits, which the
    // eyedropper's `pickFromNode` short-circuits on. This test pins down the
    // failure mode so the missing-wiring case stays visible.
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    const eyedropper = result.current as unknown as AnyTool;

    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: eyedropper, ambient: [] }),
      getCtx: makeCtx as unknown as (
        overrides?: { clientX?: number; clientY?: number }
      ) => Omit<ToolCtx, 'scratch'>,
      // Intentionally no getNodeAtPoint.
    });

    dispatcher.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    dispatcher.onPointerUp(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));

    expect(onPick).not.toHaveBeenCalled();
  });
});
