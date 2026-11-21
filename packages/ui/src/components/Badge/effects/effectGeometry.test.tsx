import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { polygonSampler } from '../bases/polygonSampler';
import type { BaseSampler, EffectModule, PerimeterPoint } from '../bases/types';
import Aqua from './Aqua';
import Bevel from './Bevel';
import Bevel2 from './Bevel2';
import Bites from './Bites';
import Metal from './Metal';
import Outline from './Outline';
import Perforations from './Perforations';
import Scallops from './Scallops';
import Spikes from './Spikes';
import Sunbeams from './Sunbeams';

const square: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

function draw<P>(effect: EffectModule<P>, params: P, boxW = 200, boxH = 30, sampler?: BaseSampler) {
  const Component = effect.Component!;
  const s = sampler ?? polygonSampler(square, boxW, boxH);
  const { container } = render(
    <svg>
      <Component sampler={s} boxW={boxW} boxH={boxH} variant="solid" params={params} phase={0} />
    </svg>,
  );
  return container;
}

describe('a Badge effect stroke', () => {
  it('draws an outline `width` as that many CSS px on a stretched badge', () => {
    const path = draw(Outline, { width: 2 }).querySelector('path')!;
    expect(path.getAttribute('stroke-width')).toBe('2');
  });

  it('draws the aqua and metal bezel and rim at their CSS px widths', () => {
    for (const effect of [Aqua, Metal] as EffectModule<{ bezelWidth: number; rimWidth: number }>[]) {
      const widths = [...draw(effect, { bezelWidth: 1.5, rimWidth: 2 }).querySelectorAll('path[stroke]')]
        .map((p) => p.getAttribute('stroke-width'));
      expect(new Set(widths)).toEqual(new Set(['1.5', '2']));
    }
  });
});
