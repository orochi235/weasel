import { describe, it, expect, vi } from 'vitest';
import { viewportZoomAction, makeViewportZoomAction } from './viewportZoom';
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

  describe('keyboard zoom anchor', () => {
    it('anchors at the host center when view.hostSize is wired', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      view.hostSize = () => ({ width: 800, height: 600 });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'in' });
      // The world point under the canvas center (400, 300) must stay fixed.
      const worldX = 400 / view._value.scale.x + view._value.x;
      const worldY = 300 / view._value.scale.y + view._value.y;
      expect(worldX).toBeCloseTo(400, 5);
      expect(worldY).toBeCloseTo(300, 5);
      expect(view._value.scale.x).toBeCloseTo(1.25, 5);
    });

    it('falls back to the origin without hostSize', () => {
      const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
      const invoker = getImmediateInvoker(viewportZoomAction);
      invoker.run({ view }, { kind: 'in' });
      // Anchored at (0,0): translation unchanged.
      expect(view._value.x).toBeCloseTo(0, 5);
      expect(view._value.y).toBeCloseTo(0, 5);
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

// ---------------------------------------------------------------------------
// makeViewportZoomAction — configurable wheel trigger + clamp
// ---------------------------------------------------------------------------

describe('makeViewportZoomAction', () => {
  it('binds the wheel gesture to plain wheel when wheel: "plain"', () => {
    const action = makeViewportZoomAction({ wheel: 'plain' });
    const specs = (action.defaultBinding as Array<{ spec: unknown }>).map((b) => b.spec);
    // Plain wheel: no mods (forbids any modifier).
    expect(specs).toContainEqual({ kind: 'wheel' });
    expect(specs).not.toContainEqual({ kind: 'wheel', mods: { mod: true } });
    // Keyboard bindings are unchanged.
    expect(specs).toContainEqual({ kind: 'key', key: '0', mods: { mod: true } });
  });

  it('defaults the wheel gesture to Cmd/Ctrl+wheel', () => {
    const action = makeViewportZoomAction();
    const specs = (action.defaultBinding as Array<{ spec: unknown }>).map((b) => b.spec);
    expect(specs).toContainEqual({ kind: 'wheel', mods: { mod: true } });
  });

  it('clamps the resulting scale to [min, max] on wheel zoom', () => {
    const action = makeViewportZoomAction({ wheel: 'plain', min: 5, max: 500 });
    const invoker = getImmediateInvoker(action);

    // Zoom out hard from scale 5 — clamp floor holds it at 5.
    const low = makeView({ x: 0, y: 0, scale: { x: 5, y: 5 } });
    invoker.run({ view: low }, { kind: 'wheel', deltaY: 5000, clientX: 0, clientY: 0 });
    expect(low._value.scale.x).toBeCloseTo(5, 5);

    // Zoom in hard from scale 500 — clamp ceiling holds it at 500.
    const high = makeView({ x: 0, y: 0, scale: { x: 500, y: 500 } });
    invoker.run({ view: high }, { kind: 'wheel', deltaY: -5000, clientX: 0, clientY: 0 });
    expect(high._value.scale.x).toBeCloseTo(500, 5);
  });

  it('default clamp (0.1–8) matches the shared viewportZoomAction instance', () => {
    const action = makeViewportZoomAction();
    const invoker = getImmediateInvoker(action);
    const view = makeView({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    // Huge zoom-in is clamped at the kit default ceiling of 8.
    invoker.run({ view }, { kind: 'wheel', deltaY: -5000, clientX: 0, clientY: 0 });
    expect(view._value.scale.x).toBeCloseTo(8, 5);
  });
});

// ---------------------------------------------------------------------------
// Animated discrete steps
// ---------------------------------------------------------------------------

function makeAnimatedView(initial: View = { x: 0, y: 0, scale: { x: 1, y: 1 } }) {
  let v = initial;
  let pending: View | null = null;
  const calls = { animate: [] as Array<{ to: View; opts: unknown }>, set: [] as View[] };
  const api: ViewApi = {
    get: () => v,
    set: (next) => { v = next; calls.set.push(next); },
    hostSize: () => ({ width: 400, height: 200 }),
    animate: (to, opts) => { pending = to; calls.animate.push({ to, opts }); },
    stopAnimation: () => { pending = null; },
    animationTarget: () => pending,
  };
  return { api, calls, current: () => v };
}

describe('makeViewportZoomAction with animate', () => {
  it('animates Cmd+= instead of setting the view', () => {
    const action = makeViewportZoomAction({ animate: { ms: 400 } });
    const { api, calls } = makeAnimatedView();
    getImmediateInvoker(action).run({ view: api }, { kind: 'in' });

    expect(calls.set).toEqual([]);
    expect(calls.animate).toHaveLength(1);
    // KEY_STEP 1.25, anchored at the host center (200, 100).
    expect(calls.animate[0].to.scale).toEqual({ x: 1.25, y: 1.25 });
    expect(calls.animate[0].opts).toMatchObject({ ms: 400 });
  });

  it('compounds successive steps off the pending target', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView();
    const invoker = getImmediateInvoker(action);

    invoker.run({ view: api }, { kind: 'in' });
    invoker.run({ view: api }, { kind: 'in' });

    expect(calls.animate[1].to.scale.x).toBeCloseTo(1.25 * 1.25, 10);
  });

  it('never animates wheel zoom — the input already samples every frame', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView();
    getImmediateInvoker(action).run({ view: api }, { kind: 'wheel', deltaY: -100, clientX: 0, clientY: 0 });

    expect(calls.animate).toEqual([]);
    expect(calls.set).toHaveLength(1);
  });

  it('sets rather than animates when the view dep has no animate', () => {
    const action = makeViewportZoomAction({ animate: true });
    const view = makeView();
    view.hostSize = () => ({ width: 400, height: 200 });
    getImmediateInvoker(action).run({ view }, { kind: 'in' });

    expect(view.get().scale).toEqual({ x: 1.25, y: 1.25 });
  });

  it('sets rather than animates when animate is off', () => {
    const action = makeViewportZoomAction();
    const { api, calls } = makeAnimatedView();
    getImmediateInvoker(action).run({ view: api }, { kind: 'in' });

    expect(calls.animate).toEqual([]);
    expect(calls.set).toHaveLength(1);
  });

  it('animates the reset branch to identity, honoring resetMs', () => {
    const action = makeViewportZoomAction({ animate: { ms: 200, resetMs: 500 } });
    const { api, calls } = makeAnimatedView({ x: 30, y: 40, scale: { x: 3, y: 3 } });
    getImmediateInvoker(action).run({ view: api }, { kind: 'reset' });

    expect(calls.animate).toHaveLength(1);
    expect(calls.animate[0].to).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    expect(calls.animate[0].opts).toMatchObject({ ms: 500 });
  });

  it('animates to the view a recenter callback returns', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView({ x: 30, y: 40, scale: { x: 3, y: 3 } });
    api.recenter = () => ({ x: -8, y: -8, scale: { x: 0.5, y: 0.5 } });
    getImmediateInvoker(action).run({ view: api }, { kind: 'reset' });

    expect(calls.animate[0].to).toEqual({ x: -8, y: -8, scale: { x: 0.5, y: 0.5 } });
  });

  it('leaves a void-returning recenter alone — it dispatched the view itself', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView();
    const recenter = vi.fn(() => undefined);
    api.recenter = recenter;
    getImmediateInvoker(action).run({ view: api }, { kind: 'reset' });

    expect(recenter).toHaveBeenCalledOnce();
    expect(calls.animate).toEqual([]);
    expect(calls.set).toEqual([]);
  });
});
