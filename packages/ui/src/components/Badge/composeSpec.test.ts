import { describe, expect, it } from 'vitest';
import { resolveCompose } from './composeSpec';
import { SHAPES } from './shapes';
import { BASES } from './bases';

describe('resolveCompose', () => {
  it('keeps a base default for a param given as undefined', () => {
    const spec = resolveCompose(SHAPES.pill, {}, { base: 'chamfered-rect', baseParams: { chamfer: undefined } });
    expect(spec.baseParams).toEqual(BASES['chamfered-rect'].defaults);
  });
});
