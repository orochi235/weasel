import { describe, expect, it } from 'vitest';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import type { Affordance } from './types';
import type { ChromeState } from '../core/selection/chromeState';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: 1 };
const DIMS = { width: 200, height: 200 };

function makeState(): ChromeState {
  return {
    selection: [],
    multiActive: false,
    boundsOf: () => null,
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

const STUB_DRAG = { onStart: () => 'claim' as const };

describe('composeAffordanceLayer', () => {
  it('exposes the supplied id, label, and screen space', () => {
    const layer = composeAffordanceLayer('test-overlay', 'Test', []);
    expect(layer.id).toBe('test-overlay');
    expect(layer.label).toBe('Test');
    expect(layer.space).toBe('screen');
  });

  it('draw concatenates each affordance render output in array order', () => {
    const a: Affordance = {
      id: 'a',
      render: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { color: 'red' } }],
    };
    const b: Affordance = {
      id: 'b',
      render: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { color: 'blue' } }],
    };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    const out = layer.draw(makeState(), VIEW, DIMS);
    expect(out).toHaveLength(2);
    expect((out[0] as { fill: { color: string } }).fill.color).toBe('red');
    expect((out[1] as { fill: { color: string } }).fill.color).toBe('blue');
  });

  it('hitTest walks affordances top-down (last → first); first non-null wins', () => {
    const calls: string[] = [];
    const a: Affordance = {
      id: 'a',
      render: () => [],
      hitTest: () => { calls.push('a'); return null; },
    };
    const b: Affordance = {
      id: 'b',
      render: () => [],
      hitTest: () => { calls.push('b'); return { drag: STUB_DRAG }; },
    };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    const result = layer.hitTest!(0, 0, makeState(), VIEW, DIMS);
    expect(result).not.toBeNull();
    // 'b' is later in the array → tested first → returns the hit.
    // 'a' is never consulted because 'b' already claimed.
    expect(calls).toEqual(['b']);
  });

  it('hitTest returns null when every affordance returns null', () => {
    const a: Affordance = { id: 'a', render: () => [], hitTest: () => null };
    const b: Affordance = { id: 'b', render: () => [], hitTest: () => null };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    expect(layer.hitTest!(0, 0, makeState(), VIEW, DIMS)).toBeNull();
  });

  it('hitTest skips affordances that omit the hitTest method', () => {
    const decorative: Affordance = { id: 'a', render: () => [] }; // no hitTest
    const interactive: Affordance = {
      id: 'b',
      render: () => [],
      hitTest: () => ({ drag: STUB_DRAG }),
    };
    const layer = composeAffordanceLayer('x', 'X', [decorative, interactive]);
    const result = layer.hitTest!(0, 0, makeState(), VIEW, DIMS);
    expect(result).not.toBeNull();
  });

  it('initialScratch from the hit propagates through the HitResult', () => {
    const aff: Affordance = {
      id: 'a',
      render: () => [],
      hitTest: () => ({ drag: STUB_DRAG, initialScratch: { anchor: 'br', targetId: 'g1' } }),
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    const result = layer.hitTest!(0, 0, makeState(), VIEW, DIMS);
    expect(result?.initialScratch).toEqual({ anchor: 'br', targetId: 'g1' });
  });

  it('empty affordance list: draw returns [], hitTest returns null', () => {
    const layer = composeAffordanceLayer('x', 'X', []);
    expect(layer.draw(makeState(), VIEW, DIMS)).toEqual([]);
    expect(layer.hitTest!(0, 0, makeState(), VIEW, DIMS)).toBeNull();
  });
});
