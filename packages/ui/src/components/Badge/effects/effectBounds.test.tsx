import { describe, expect, it } from 'vitest';
import type { EffectModule, PerimeterPoint } from '../bases/types';
import Bites from './Bites';
import Puffs from './Puffs';
import Scallops from './Scallops';
import Spikes from './Spikes';

const line = (s: number): PerimeterPoint => ({ x: s, y: 0, nx: 0, ny: -1 });

function outline(effect: EffectModule<object>, params: object, totalCss = 200): number[] {
  const out: number[] = [];
  for (let s = 0; s < totalCss; s += 0.5) out.push(effect.offsetAt!(s, { params, phase: 0, totalCss, perimeterAt: line }).dy);
  return out;
}

describe('an infinite bump effect param', () => {
  const cases: [string, EffectModule<object>, object][] = [
    ['puffs', Puffs, { irregularity: Infinity }],
    ['bites', Bites, { irregularity: Infinity }],
    ['scallops', Scallops, { irregularity: Infinity }],
    ['spikes', Spikes, { irregularity: Infinity, cornerCompensation: -Infinity }],
  ];
  for (const [name, effect, params] of cases) {
    it(`${name} reads ${Object.keys(params).join(' and ')} as the default`, () => {
      expect(outline(effect, params)).toEqual(outline(effect, {}));
    });
  }
});
