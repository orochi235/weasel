import { describe, expect, it } from 'vitest';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import type { Affordance } from './types';
import type { ChromeState } from 'core/selection/chromeState';

// What the layer paints and what it lets a press reach are the same chrome.

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 200, height: 200, dpr: 1 };
const STATE: ChromeState = {
  selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: NO_MOD,
};

describe('composeAffordanceLayer paint matches hit', () => {
  it('does not paint a region whose own chromeId is hidden, as it cannot be hit', () => {
    const a: Affordance = {
      id: 'aff',
      regions: () => [{
        id: 'r',
        targetId: null,
        chromeId: 'part',
        shape: { kind: 'point', x: 10, y: 10, hitRadiusPx: 4 },
        paint: { kind: 'square', sizePx: 4, fill: { paint: { color: 'red' } } },
        bind: () => ({}),
      }],
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    const data = { getChromeState: () => STATE, getIsVisible: () => (id: string) => id !== 'part' };
    expect(layer.hitTest(10, 10, data, VIEW, DIMS)).toBeNull();
    expect(layer.draw(data, VIEW, DIMS)).toHaveLength(0);
  });
});
