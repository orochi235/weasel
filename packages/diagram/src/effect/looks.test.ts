import { describe, expect, it } from 'vitest';
import type { EffectLook } from './draw';
import { compact } from './compact';
import { lanes } from './lanes';
import { EFFECT_LOOKS } from './looks';
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';
import { SKIP } from './skipFixture';

describe('EffectLook', () => {
  // The typecheck is the test: looks with different options share one list type.
  it('holds looks with different options in one list, no cast', () => {
    const looks: EffectLook[] = [nodeGraph, rack, lanes, compact];
    const shipped: readonly EffectLook[] = Object.values(EFFECT_LOOKS);
    for (const look of [...looks, ...shipped]) expect(look(SKIP).data.nodes.length).toBeGreaterThan(0);
  });
});
