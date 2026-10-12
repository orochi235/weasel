import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BaseSampler, EffectModule } from '../bases/types';
import Aqua from './Aqua';
import Metal from './Metal';
import Outline from './Outline';
import Sunbeams from './Sunbeams';

const sampler: BaseSampler = {
  bodyPath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
  perimeterAt: () => ({ x: 0, y: 0, nx: 0, ny: -1 }),
  totalCss: 400,
};

function markup<P>(effect: EffectModule<P>, params: P): string {
  const Component = effect.Component!;
  const { container } = render(
    <svg>
      <Component sampler={sampler} boxW={100} boxH={100} variant="solid" params={params} phase={0} />
    </svg>,
  );
  return container.innerHTML;
}

const accent = { ref: 'accent' };

describe('a Badge effect color', () => {
  it('is a color source, written as the theme resolves it', () => {
    expect(markup(Outline, { color: accent })).toContain('stroke="var(--wzl-accent)"');
    expect(markup(Sunbeams, { color: accent })).toContain('fill="var(--wzl-accent)"');
    expect(markup(Metal, { accent })).toContain('color-mix(in srgb, var(--wzl-accent)');
    expect(markup(Aqua, { accent })).toContain('stop-color: var(--wzl-accent)');
  });

  it('defaults to the color each effect has always drawn', () => {
    expect(markup(Outline, {})).toContain('stroke="var(--badge-edge)"');
    expect(markup(Sunbeams, {})).toContain('fill="#ffffff"');
    // jsdom writes a hex inside a style as rgb().
    expect(markup(Metal, {})).toContain('color-mix(in srgb, rgb(170, 179, 189)');
    expect(markup(Aqua, {})).toContain('stop-color: var(--badge-edge)');
  });
});
