import { describe, it, expect, vi } from 'vitest';
import { viewportPanAction } from './viewportPan';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeView(initial: View = { x: 0, y: 0, scale: { x: 1, y: 1 } }): ViewApi & { _value: View } {
  let v = initial;
  return {
    _value: initial,
    get() { return v; },
    set(next) { v = next; (this as unknown as { _value: View })._value = next; },
  };
}

function getImmediateInvoker(action: typeof viewportPanAction) {
  if (!action.invoker || action.invoker.timing !== 'immediate') {
    throw new Error('Expected immediate invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Descriptor shape
// ---------------------------------------------------------------------------

describe('viewportPanAction descriptor', () => {
  it('declares id, label, plain-wheel + shift-wheel bindings, and immediate timing', () => {
    expect(viewportPanAction.id).toBe('viewport.pan');
    expect(viewportPanAction.label).toBe('Pan');
    expect(viewportPanAction.defaultBinding).toEqual([
      { spec: { kind: 'wheel' }, opts: {} },
      { spec: { kind: 'wheel', mods: { shift: true } }, opts: { params: { swapAxis: true } } },
    ]);
    expect(viewportPanAction.invoker?.timing).toBe('immediate');
  });

  it('requires view dep', () => {
    expect(viewportPanAction.requires).toContain('view');
  });

  it('enabled returns true (always enabled)', () => {
    expect(viewportPanAction.enabled!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invoker behaviour
// ---------------------------------------------------------------------------

describe('viewportPanAction invoker', () => {
  it('pans x and y by deltaX/deltaY divided by scale', () => {
    const view = makeView({ x: 10, y: 20, scale: { x: 2, y: 2 } });
    const invoker = getImmediateInvoker(viewportPanAction);
    invoker.run({ view }, { deltaX: 40, deltaY: 60 });
    // dx = 40/2 = 20, dy = 60/2 = 30
    expect(view._value.x).toBe(30);
    expect(view._value.y).toBe(50);
  });

  it('does not pan when deltaX/deltaY are zero', () => {
    const view = makeView({ x: 5, y: 5, scale: { x: 1, y: 1 } });
    const invoker = getImmediateInvoker(viewportPanAction);
    invoker.run({ view }, { deltaX: 0, deltaY: 0 });
    expect(view._value.x).toBe(5);
    expect(view._value.y).toBe(5);
  });

  it('does not pan when params are absent (legacy bridge)', () => {
    const view = makeView({ x: 5, y: 5, scale: { x: 1, y: 1 } });
    const invoker = getImmediateInvoker(viewportPanAction);
    invoker.run({ view }, undefined);
    expect(view._value.x).toBe(5);
    expect(view._value.y).toBe(5);
  });

  it('preserves scale in the updated view', () => {
    const scale = { x: 3, y: 3 };
    const view = makeView({ x: 0, y: 0, scale });
    const invoker = getImmediateInvoker(viewportPanAction);
    invoker.run({ view }, { deltaX: 30, deltaY: 30 });
    expect(view._value.scale).toEqual(scale);
  });

  it('shift+wheel (swapAxis): routes deltaY into the x axis when deltaX is zero', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const invoker = getImmediateInvoker(viewportPanAction);
    invoker.run({ view }, { deltaX: 0, deltaY: 50, swapAxis: true });
    expect(view._value.x).toBe(50);
    expect(view._value.y).toBe(0);
  });

  it('shift+wheel (swapAxis): prefers deltaX when present (trackpad horizontal swipe)', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const invoker = getImmediateInvoker(viewportPanAction);
    invoker.run({ view }, { deltaX: 30, deltaY: 70, swapAxis: true });
    expect(view._value.x).toBe(30);
    expect(view._value.y).toBe(0);
  });

  it('is a no-op when view dep is absent', () => {
    const mockSet = vi.fn();
    const invoker = getImmediateInvoker(viewportPanAction);
    expect(() => invoker.run({}, { deltaX: 10, deltaY: 10 })).not.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
