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

type DyAt = (s: number, phase: number) => number;
const irregular = { irregularity: 1 };
const effects: [string, DyAt][] = [
  ['scallops', (s, phase) => dyAt(Scallops, s, irregular, phase)],
  ['bites', (s, phase) => dyAt(Bites, s, irregular, phase)],
  ['spikes', (s, phase) => dyAt(Spikes, s, irregular, phase)],
  ['puffs', (s, phase) => dyAt(Puffs, s, irregular, phase)],
];

describe('a bump effect with irregularity', () => {
  for (const [name, at] of effects) {
    for (const phase of [0, 0.3]) {
      it(`draws ${name} at one size across the outline's start (phase ${phase})`, () => {
        const before = at(totalCss - 1e-6, phase);
        const after = at(1e-6, phase);
        expect(after).toBeCloseTo(before, 3);
      });
    }
  }
});
