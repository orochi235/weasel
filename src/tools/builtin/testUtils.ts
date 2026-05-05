import { vi } from 'vitest';
import type { ToolCtx } from '../types';

/** Build a minimal ToolCtx for tool-hook unit tests. Override individual
 *  fields via the partial argument; defaults are inert (vi.fn() / no-op). */
export function makeCtx<S = undefined>(
  over: Partial<ToolCtx<S>> = {},
): ToolCtx<S> {
  return {
    worldX: 10,
    worldY: 20,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], set: vi.fn() } as unknown as ToolCtx<S>['selection'],
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined as S,
    ...over,
  };
}

/** A synthetic PointerEvent stand-in for handler signatures that don't
 *  inspect the event. */
export function pe(type = 'pointerdown'): PointerEvent {
  const e = new Event(type) as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  return e;
}
