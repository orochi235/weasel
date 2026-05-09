import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { paintGradientTrack } from './paintGradientTrack';
import type { TrackCtx } from './RangePicker';

const ctx: TrackCtx = {
  trackWidth: 200,
  valueToFraction: (v: number) => v,
};

describe('paintGradientTrack', () => {
  it('returns a function that renders a div with a sampled linear gradient', () => {
    const renderTrack = paintGradientTrack({
      gradient: t => (t < 0.5 ? '#000' : '#fff'),
      samples: 4,
    });
    const { container } = render(<>{renderTrack(ctx)}</>);
    const div = container.querySelector('div')!;
    const bg = (div as HTMLElement).style.background;
    expect(bg).toContain('linear-gradient(to right');
    // 5 stops at 0/25/50/75/100%.
    expect(bg).toMatch(/0\.0%/);
    expect(bg).toMatch(/100\.0%/);
    expect(bg).toContain('#000');
    expect(bg).toContain('#fff');
  });

  it('layers hatched overlays for activeRange < full', () => {
    const renderTrack = paintGradientTrack({
      gradient: () => '#888',
      samples: 2,
      activeRange: [0.25, 0.75],
      hatch: { angleDeg: 135, stripe: 2, gap: 4, dim: 75 },
    });
    const { container } = render(<>{renderTrack(ctx)}</>);
    const div = container.querySelector('div')!;
    const bg = (div as HTMLElement).style.background;
    expect(bg).toContain('repeating-linear-gradient(135deg');
    // Two outer hatched regions (left and right), so two repeating-linear-gradient layers and two dim layers.
    expect(bg.match(/repeating-linear-gradient/g)?.length).toBe(2);
  });

  it('omits overlays when activeRange covers full range', () => {
    const renderTrack = paintGradientTrack({
      gradient: () => '#888',
      activeRange: [0, 1],
      hatch: { angleDeg: 135 },
    });
    const { container } = render(<>{renderTrack(ctx)}</>);
    const div = container.querySelector('div')!;
    expect((div as HTMLElement).style.background).not.toContain('repeating-linear-gradient');
  });
});
