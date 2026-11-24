import { describe, expect, it } from 'vitest';
import { resolveCompose } from './composeSpec';
import { effectParams } from './effects';
import { SHAPES } from './shapes';
import { BASES } from './bases';

describe('composed params', () => {
  it('keeps a base default where baseParams sets a key to undefined', () => {
    const spec = resolveCompose(SHAPES.pill, {}, { base: 'rounded-rect', baseParams: { erosion: undefined } });
    expect(spec.baseParams).toMatchObject({ erosion: BASES['rounded-rect'].defaults!.erosion });
  });

  it('keeps an effect default where its params set a key to undefined', () => {
    expect(effectParams({ type: 'spikes', params: { count: undefined } })).toMatchObject({ count: 44 });
  });

});

describe('resolveCompose', () => {
  it('keeps a base default for a param given as undefined', () => {
    const spec = resolveCompose(SHAPES.pill, {}, { base: 'chamfered-rect', baseParams: { chamfer: undefined } });
    expect(spec.baseParams).toEqual(BASES['chamfered-rect'].defaults);
  });

  it("draws the shape's own composition when the base prop names no registered base", () => {
    const spec = resolveCompose(SHAPES.square, {}, { base: 'bogus' as never, effects: [{ type: 'shadow' }] });
    const own = resolveCompose(SHAPES.square, {}, {});
    expect(spec.base).toBe(own.base);
    expect(spec.base).not.toBeNull();
    expect(spec.fromProp).toBe(false);
  });
});
