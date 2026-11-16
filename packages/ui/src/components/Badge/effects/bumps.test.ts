import { describe, expect, it } from 'vitest';
import type { EffectModule, PerimeterPoint } from '../bases/types';
import Bites from './Bites';
import Puffs from './Puffs';
import Scallops from './Scallops';
import Spikes from './Spikes';

const totalCss = 203;
const perimeterAt = (s: number): PerimeterPoint => ({ x: s, y: 0, nx: 0, ny: -1 });

function dyAt<P>(effect: EffectModule<P>, s: number, params: P, phase: number): number {
  return effect.offsetAt!(s, { params, phase, totalCss, perimeterAt }).dy;
}

const effects: [string, EffectModule<{ irregularity: number }>][] = [
  ['scallops', Scallops],
  ['bites', Bites],
  ['spikes', Spikes],
  ['puffs', Puffs],
];

describe('a bump effect with irregularity', () => {
  for (const [name, effect] of effects) {
    for (const phase of [0, 0.3]) {
      it(`draws ${name} at one size across the outline's start (phase ${phase})`, () => {
        const params = { irregularity: 1 };
        const before = dyAt(effect, totalCss - 1e-6, params, phase);
        const after = dyAt(effect, 1e-6, params, phase);
        expect(after).toBeCloseTo(before, 3);
      });
    }
  }
});
