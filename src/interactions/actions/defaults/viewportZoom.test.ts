import { describe, it, expect, vi } from 'vitest';
import { viewportZoomAction } from './viewportZoom';
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

function getImmediateInvoker(action: typeof viewportZoomAction) {
  if (!action.invoker || action.invoker.timing !== 'immediate') {
    throw new Error('Expected immediate invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Descriptor shape
// ---------------------------------------------------------------------------

describe('viewportZoomAction descriptor', () => {
  it('declares id, label, array defaultBinding, and immediate timing', () => {
    expect(viewportZoomAction.id).toBe('viewport.zoom');
    expect(viewportZoomAction.label).toBe('Zoom');
    expect(Array.isArray(viewportZoomAction.defaultBinding)).toBe(true);
    expect(viewportZoomAction.invoker?.timing).toBe('immediate');
  });

  it('requires view dep', () => {
    expect(viewportZoomAction.requires).toContain('view');
  });

  it('enabled returns true (always enabled)', () => {
    expect(viewportZoomAction.enabled!()).toBe(true);
  });

  it('has 4 gesture bindings: wheel+mod, key =, key -, key 0', () => {
    const bindings = viewportZoomAction.defaultBinding as Array<{ spec: unknown; opts: { params: { kind: string } } }>;
    expect(bindings).toHaveLength(4);
    const specs = bindings.map((b) => b.spec);
    expect(specs).toContainEqual({ kind: 'wheel', mods: { mod: true } });
    expect(specs).toContainEqual({ kind: 'key', key: '=', mods: { mod: true, shift: 'optional' } });
    expect(specs).toContainEqual({ kind: 'key', key: '-', mods: { mod: true } });
    expect(specs).toContainEqual({ kind: 'key', key: '0', mods: { mod: true } });
  });

  it('each binding declares a params.kind', () => {
    const bindings = viewportZoomAction.defaultBinding as Array<{ spec: unknown; opts: { params: { kind: string } } }>;
    const kinds = bindings.map((b) => b.opts.params.kind);
    expect(kinds).toContain('wheel');
    expect(kinds).toContain('in');
    expect(kinds).toContain('out');
    expect(kinds).toContain('reset');
  });
});

// ---------------------------------------------------------------------------
// Invoker behaviour
// ---------------------------------------------------------------------------

describe('viewportZoomAction invoker', () => {
  describe("kind: 'wheel'", () => {
    it('zooms in when deltaY is negative (scroll up)', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      // Negative deltaY = scroll up = zoom in (factor > 1)
      invoker.run({ view }, { kind: 'wheel', deltaY: -100, deltaX: 0, clientX: 0, clientY: 0 });
      expect(view._value.scale.x).toBeGreaterThan(1);
      expect(view._value.scale.y).toBeGreaterThan(1);
    });

    it('zooms out when deltaY is positive (scroll down)', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'wheel', deltaY: 100, deltaX: 0, clientX: 0, clientY: 0 });
      expect(view._value.scale.x).toBeLessThan(1);
      expect(view._value.scale.y).toBeLessThan(1);
    });

    it('anchors zoom at clientX/clientY', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      // Zoom in at (100, 100): the world point under (100,100) should stay fixed.
      // At scale 1, world point = (100, 100). After zoom, worldX = clientX/newScale + view.x
      // zoomAt ensures worldX - anchor/newScale stays pinned.
      invoker.run({ view }, { kind: 'wheel', deltaY: -100, deltaX: 0, clientX: 100, clientY: 100 });
      // After zoom the world under the anchor stays the same:
      // worldX = anchor.x / newScale.x + newView.x === anchor.x / oldScale.x + oldView.x = 100
      const worldX = 100 / view._value.scale.x + view._value.x;
      expect(worldX).toBeCloseTo(100, 5);
    });

    it('no-op when deltaY is zero', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'wheel', deltaY: 0, deltaX: 0, clientX: 0, clientY: 0 });
      expect(view._value.scale).toEqual({ x: 1, y: 1 });
    });
  });

  describe("kind: 'in'", () => {
    it('zooms in by KEY_STEP (1.25)', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'in' });
      expect(view._value.scale.x).toBeCloseTo(1.25, 5);
      expect(view._value.scale.y).toBeCloseTo(1.25, 5);
    });
  });

  describe("kind: 'out'", () => {
    it('zooms out by 1/KEY_STEP (0.8)', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'out' });
      expect(view._value.scale.x).toBeCloseTo(0.8, 5);
      expect(view._value.scale.y).toBeCloseTo(0.8, 5);
    });
  });

  describe("kind: 'reset'", () => {
    it('resets to scale 1 at origin', () => {
      const view = makeView({ x: 100, y: 50, scale: { x: 3, y: 3 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'reset' });
      expect(view._value).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    });
  });

  it('is a no-op when view dep is absent', () => {
    const mockSet = vi.fn();
    const invoker = getImmediateInvoker(viewportZoomAction);
    expect(() => invoker.run({}, { kind: 'in' })).not.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('legacy bridge (undefined params) defaults to zoom-in', () => {
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const invoker = getImmediateInvoker(viewportZoomAction);
    invoker.run({ view }, undefined);
    // Defaults to zoom-in (scale > 1).
    expect(view._value.scale.x).toBeGreaterThan(1);
  });
});
