import { describe, expect, it } from 'vitest';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 200, height: 200 };

function makeState(boundsById: Record<string, Bounds> = {}): ChromeState {
  return {
    selection: [],
    multiActive: false,
    boundsOf: (id) => boundsById[id] ?? null,
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

function pointRegion(
  overrides: Partial<AffordanceRegion> & { id: string },
): AffordanceRegion {
  return {
    targetId: null,
    shape: { kind: 'point', x: 0, y: 0, hitRadiusPx: 4 },
    bind: () => ({}),
    ...overrides,
  };
}

describe('composeAffordanceLayer', () => {
  it('exposes the supplied id, label, and screen space', () => {
    const layer = composeAffordanceLayer('test-overlay', 'Test', []);
    expect(layer.id).toBe('test-overlay');
    expect(layer.label).toBe('Test');
    expect(layer.space).toBe('screen');
  });

  it('draw emits a square paint command per region in array order', () => {
    const a: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        paint: { kind: 'square', sizePx: 4, fill: { color: 'red' } },
      })],
    };
    const b: Affordance = {
      id: 'b',
      regions: () => [pointRegion({
        id: 'r-b',
        shape: { kind: 'point', x: 10, y: 10, hitRadiusPx: 4 },
        paint: { kind: 'square', sizePx: 4, fill: { color: 'blue' } },
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    const out = layer.draw(makeState(), VIEW, DIMS);
    expect(out).toHaveLength(2);
    expect((out[0] as { fill: { color: string } }).fill.color).toBe('red');
    expect((out[1] as { fill: { color: string } }).fill.color).toBe('blue');
  });

  it('hitTest walks affordances top-down; first hit wins', () => {
    const calls: string[] = [];
    const a: Affordance = {
      id: 'a',
      regions: () => {
        calls.push('a');
        return [pointRegion({
          id: 'r-a',
          shape: { kind: 'point', x: 100, y: 100, hitRadiusPx: 4 },
        })];
      },
    };
    const aBinding: AffordanceBinding = { initialScratch: { which: 'b' } };
    const b: Affordance = {
      id: 'b',
      regions: () => {
        calls.push('b');
        return [pointRegion({
          id: 'r-b',
          shape: { kind: 'point', x: 0, y: 0, hitRadiusPx: 4 },
          bind: () => aBinding,
        })];
      },
    };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    const result = layer.hitTest(0, 0, makeState(), VIEW, DIMS);
    expect(result).not.toBeNull();
    expect(result?.initialScratch).toEqual({ which: 'b' });
    // 'b' is later in the array → walked first.
    expect(calls[0]).toBe('b');
  });

  it('hitTest unwraps the CanvasHelpers envelope Canvas hands its layers', () => {
    const a: Affordance = {
      id: 'a',
      regions: (state) => (state.selection.length === 1 ? [pointRegion({
        id: 'r-a',
        bind: () => ({ initialScratch: { which: 'a' } }),
      })] : []),
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    const state = { ...makeState(), selection: [asNodeId('n1')] };

    const viaEnvelope = layer.hitTest(0, 0, { getChromeState: () => state }, VIEW, DIMS);
    expect(viaEnvelope?.initialScratch).toEqual({ which: 'a' });
    // Bare state (the shape every unit-test call site passes) still works.
    expect(layer.hitTest(0, 0, state, VIEW, DIMS)?.initialScratch).toEqual({ which: 'a' });
  });

  it('hitTest returns null rather than throwing when no state is supplied', () => {
    const a: Affordance = {
      id: 'a',
      regions: (state) => [pointRegion({ id: `r-${state.selection.length}` })],
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    expect(layer.hitTest(0, 0, undefined, VIEW, DIMS)).toBeNull();
  });

  it('hitTest carries the hit region’s cursor', () => {
    const a: Affordance = {
      id: 'a',
      regions: () => [pointRegion({ id: 'r-a', cursor: 'ew-resize' })],
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    expect(layer.hitTest(0, 0, makeState(), VIEW, DIMS)?.cursor).toBe('ew-resize');
  });

  it('hitTest omits cursor when the region declares none', () => {
    const a: Affordance = { id: 'a', regions: () => [pointRegion({ id: 'r-a' })] };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    const hit = layer.hitTest(0, 0, makeState(), VIEW, DIMS);
    expect(hit).not.toBeNull();
    expect(hit && 'cursor' in hit).toBe(false);
  });

  it('hitTest carries an exclusive claim and the kinds it bars', () => {
    const a: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        strength: 'exclusive',
        claimedKinds: ['pointer', 'wheel'],
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    const hit = layer.hitTest(0, 0, makeState(), VIEW, DIMS);
    expect(hit?.strength).toBe('exclusive');
    expect(hit?.claimedKinds).toEqual(['pointer', 'wheel']);
  });

  it('hitTest returns null when no region contains the point', () => {
    const a: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        shape: { kind: 'point', x: 100, y: 100, hitRadiusPx: 2 },
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    expect(layer.hitTest(0, 0, makeState(), VIEW, DIMS)).toBeNull();
  });

  it('decorate output is appended to draw, after the affordance’s regions', () => {
    const aff: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        paint: { kind: 'square', sizePx: 4, fill: { color: 'red' } },
      })],
      decorate: () => [{
        kind: 'path',
        path: { kind: 'rect', x: 50, y: 50, width: 10, height: 10 },
        fill: { color: 'green' },
      }],
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    const out = layer.draw(makeState(), VIEW, DIMS);
    expect(out).toHaveLength(2);
    expect((out[0] as { fill: { color: string } }).fill.color).toBe('red');
    expect((out[1] as { fill: { color: string } }).fill.color).toBe('green');
  });

  it('applies target bounds rotation to paint position', () => {
    const bounds: Bounds = { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 };
    const aff: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        targetId: 't',
        // Local top-right corner.
        shape: { kind: 'point', x: 100, y: 0, hitRadiusPx: 4 },
        paint: { kind: 'square', sizePx: 4 },
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    const out = layer.draw(makeState({ t: bounds }), VIEW, DIMS);
    expect(out).toHaveLength(1);
    // After 90° rotation around center (50,50), local (100,0) → world (100,100).
    // Square is sizePx=4, so screen rect origin is (100-2, 100-2) = (98, 98).
    const cmd = out[0] as { path: { x: number; y: number } };
    expect(cmd.path.x).toBeCloseTo(98);
    expect(cmd.path.y).toBeCloseTo(98);
  });

  it('applies target bounds rotation to hit-test (rotated handle hits)', () => {
    const bounds: Bounds = { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 };
    const aff: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        targetId: 't',
        // Local top-right corner — should hit at world (100, 100) under rotation.
        shape: { kind: 'point', x: 100, y: 0, hitRadiusPx: 4 },
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // Click at the rotated position → hit.
    expect(layer.hitTest(100, 100, makeState({ t: bounds }), VIEW, DIMS)).not.toBeNull();
    // Click at the un-rotated position → miss.
    expect(layer.hitTest(100, 0, makeState({ t: bounds }), VIEW, DIMS)).toBeNull();
  });

  it('targetId=null means identity transform (world frame)', () => {
    const aff: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        targetId: null,
        shape: { kind: 'point', x: 42, y: 17, hitRadiusPx: 4 },
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    expect(layer.hitTest(42, 17, makeState(), VIEW, DIMS)).not.toBeNull();
  });

  it('rect-shape regions hit-test against axis-aligned local bounds', () => {
    const aff: Affordance = {
      id: 'a',
      regions: () => [{
        id: 'r-a',
        targetId: null,
        shape: { kind: 'rect', x: 10, y: 10, width: 20, height: 20 },
        bind: () => ({}),
      }],
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    expect(layer.hitTest(15, 15, makeState(), VIEW, DIMS)).not.toBeNull();
    expect(layer.hitTest(5, 5, makeState(), VIEW, DIMS)).toBeNull();
    expect(layer.hitTest(31, 15, makeState(), VIEW, DIMS)).toBeNull();
  });

  it('hit-radius scales with view.scale (screen-pixel semantics)', () => {
    const aff: Affordance = {
      id: 'a',
      regions: () => [pointRegion({
        id: 'r-a',
        shape: { kind: 'point', x: 0, y: 0, hitRadiusPx: 8 },
      })],
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    // At scale=1, world radius is 8.
    expect(layer.hitTest(7, 0, makeState(), { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS)).not.toBeNull();
    expect(layer.hitTest(9, 0, makeState(), { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS)).toBeNull();
    // At scale=2 (zoomed in), world radius is 4.
    expect(layer.hitTest(3, 0, makeState(), { x: 0, y: 0, scale: { x: 2, y: 2 } }, DIMS)).not.toBeNull();
    expect(layer.hitTest(5, 0, makeState(), { x: 0, y: 0, scale: { x: 2, y: 2 } }, DIMS)).toBeNull();
  });

  it('empty affordance list: draw returns [], hitTest returns null', () => {
    const layer = composeAffordanceLayer('x', 'X', []);
    expect(layer.draw(makeState(), VIEW, DIMS)).toEqual([]);
    expect(layer.hitTest(0, 0, makeState(), VIEW, DIMS)).toBeNull();
  });

  describe('chrome-caps visibility gate', () => {
    const a: Affordance = {
      id: 'aff-a',
      regions: () => [pointRegion({
        id: 'r-a',
        shape: { kind: 'point', x: 0, y: 0, hitRadiusPx: 4 },
        paint: { kind: 'square', sizePx: 4, fill: { color: 'red' } },
      })],
    };
    const b: Affordance = {
      id: 'aff-b',
      regions: () => [pointRegion({
        id: 'r-b',
        shape: { kind: 'point', x: 10, y: 10, hitRadiusPx: 4 },
        paint: { kind: 'square', sizePx: 4, fill: { color: 'blue' } },
      })],
    };

    it('draw skips affordances whose id reports !isVisible (via data envelope)', () => {
      const layer = composeAffordanceLayer('x', 'X', [a, b]);
      const data = {
        getChromeState: () => makeState(),
        getIsVisible: () => (id: string) => id !== 'aff-a',
      };
      const out = layer.draw(data as unknown as ChromeState, VIEW, DIMS);
      expect(out).toHaveLength(1);
      expect((out[0] as { fill: { color: string } }).fill.color).toBe('blue');
    });

    it('hitTest skips affordances whose id reports !isVisible', () => {
      const layer = composeAffordanceLayer('x', 'X', [a, b]);
      const isVisible = (id: string) => id !== 'aff-a';
      // (0,0) is on aff-a's region; should miss because aff-a is hidden.
      expect(layer.hitTest(0, 0, makeState(), VIEW, DIMS, isVisible)).toBeNull();
      // (10,10) is on aff-b's region; still hits.
      expect(layer.hitTest(10, 10, makeState(), VIEW, DIMS, isVisible)).not.toBeNull();
    });

    it('absent isVisible → every affordance is drawn AND hittable (legacy)', () => {
      const layer = composeAffordanceLayer('x', 'X', [a, b]);
      const out = layer.draw(makeState(), VIEW, DIMS);
      expect(out).toHaveLength(2);
      expect(layer.hitTest(0, 0, makeState(), VIEW, DIMS)).not.toBeNull();
    });
  });
});
