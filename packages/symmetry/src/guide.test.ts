import { describe, expect, it } from 'vitest';
import type { View } from '@weasel-js/core';
import { guideHandles, symmetryGuideLayer, type SymmetryHandlePress } from './guide';
import { handleChange } from './handleDrag';
import { DEFAULT_SYMMETRY, HORIZONTAL_AXIS, type SymmetrySpec } from './kinds';

const VIEW: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const C = { x: 50, y: 50 };
const DIMS = { width: 400, height: 400 };
const spec = (over: Partial<SymmetrySpec>): SymmetrySpec => ({ ...DEFAULT_SYMMETRY, ...over });
const source = (s: SymmetrySpec) => ({ current: () => ({ group: 'g', spec: s, center: C }), subscribe: () => () => {} });

describe('guideHandles', () => {
  it('puts the knob along the axis, the set distance out on screen', () => {
    const [knob, center] = guideHandles(spec({ kind: 'mirror', angle: HORIZONTAL_AXIS }), C, VIEW, 64);
    expect(center).toEqual({ handle: 'center', at: { x: 100, y: 100 } });
    expect(knob).toEqual({ handle: 'angle', at: { x: 164, y: 100 } });
  });

  it('moves the knob out past the contents\' reach, measured on screen, with room for its hit circle', () => {
    const [knob] = guideHandles(spec({ kind: 'mirror', angle: HORIZONTAL_AXIS }), C, VIEW, 64, 40, 9);
    expect(knob).toEqual({ handle: 'angle', at: { x: 100 + 80 + 18, y: 100 } });
  });

  it('gives a radial kind only its center, since turning it changes nothing', () => {
    expect(guideHandles(spec({ kind: 'radial' }), C, VIEW, 64).map((h) => h.handle)).toEqual(['center']);
  });

  it('puts a repeat\'s step handle at the first repeat', () => {
    const [step] = guideHandles(spec({ kind: 'repeat', angle: 0, spacing: 30 }), C, VIEW, 64);
    expect(step).toEqual({ handle: 'step', at: { x: 160, y: 100 } });
  });
});

describe('symmetryGuideLayer', () => {
  it('claims a press on a handle, saying which, and nothing elsewhere on the line', () => {
    const layer = symmetryGuideLayer(source(spec({ kind: 'mirror', angle: HORIZONTAL_AXIS })));
    const hit = layer.hitTest!(50, 50, undefined, VIEW, DIMS);
    expect(hit?.strength).toBe('exclusive');
    expect(hit?.initialScratch).toEqual({ handle: 'center', group: 'g' });
    expect(layer.hitTest!(82, 50, undefined, VIEW, DIMS)?.initialScratch).toEqual({ handle: 'angle', group: 'g' });
    expect(layer.hitTest!(120, 50, undefined, VIEW, DIMS)).toBeNull();
  });

  it('draws nothing without an active group', () => {
    const layer = symmetryGuideLayer({ current: () => null, subscribe: () => () => {} });
    expect(layer.draw(undefined, VIEW, { width: 100, height: 100 })).toEqual([]);
  });
});

describe('handleChange', () => {
  const id = { point: (p: { x: number; y: number }) => p, angle: (theta: number) => theta };
  const press = (handle: SymmetryHandlePress['handle']): SymmetryHandlePress => ({ handle, group: 'g' });

  it('moves the center by the drag, through the snap', () => {
    const snap = { ...id, point: (p: { x: number; y: number }) => ({ x: Math.round(p.x / 10) * 10, y: p.y }) };
    expect(handleChange(press('center'), { center: C }, { x: 0, y: 0 }, { x: 14, y: 3 }, snap))
      .toEqual({ center: { x: 60, y: 53 } });
  });

  it('turns the axis to point at the pointer, through the snap', () => {
    const step = { ...id, angle: (theta: number) => Math.round(theta / (Math.PI / 12)) * (Math.PI / 12) };
    expect(handleChange(press('angle'), { center: C }, C, { x: 60, y: 51 }, id).spec!.angle).toBeCloseTo(Math.atan2(1, 10));
    expect(handleChange(press('angle'), { center: C }, C, { x: 60, y: 51 }, step).spec!.angle).toBeCloseTo(0);
  });

  it('sets a repeat\'s direction and spacing from its step handle', () => {
    const out = handleChange(press('step'), { center: C }, C, { x: 50, y: 90 }, id);
    expect(out.spec!.angle).toBeCloseTo(Math.PI / 2);
    expect(out.spec!.spacing).toBeCloseTo(40);
  });
});
