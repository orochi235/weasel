import { describe, expect, it } from 'vitest';
import { resolveCompose } from './composeSpec';
import { effectParams } from './composeOutline';
import { SHAPES } from './shapes';
import { BASES } from './bases';
import { EFFECTS } from './effects';

describe('composed params', () => {
  it('keeps a base default where baseParams sets a key to undefined', () => {
    const spec = resolveCompose(SHAPES.pill, {}, { base: 'rounded-rect', baseParams: { erosion: undefined } });
    expect(spec.baseParams).toMatchObject({ erosion: BASES['rounded-rect'].defaults!.erosion });
  });

  it('keeps an effect default where its params set a key to undefined', () => {
    expect(effectParams(EFFECTS.spikes, { type: 'spikes', params: { count: undefined } })).toMatchObject({ count: 44 });
  });

});
