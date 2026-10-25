import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { CSSProperties, ReactElement } from 'react';
import { paintGradientTrack } from './paintGradientTrack';
import { arcShape, lineShape, trackRun, trackShapeD, type TrackRun } from '@weasel-js/geom';
import type { TrackCtx } from './components/Slider';

const ctx: TrackCtx = {
  shape: trackRun(lineShape({ x: 0, y: 12 }, { x: 200, y: 12 })),
  trackWidth: 200,
  valueToFraction: (v: number) => v,
  fractionToPosition: (f: number) => `${(f * 100).toFixed(1)}%`,
  along: false,
};

describe('paintGradientTrack', () => {
  it("places the ramp and the hatch on the slider's rail, not the bare track", () => {
    const railed: TrackCtx = { ...ctx, fractionToPosition: (f) => `rail(${f})` };
    const renderTrack = paintGradientTrack({
      gradient: () => '#888',
      samples: 2,
      activeRange: [0.25, 0.75],
    });
    // Read off the element rather than the DOM: jsdom drops a background it can't parse.
    const bg = (renderTrack(railed) as ReactElement<{ style: CSSProperties }>).props.style.background as string;
    // Every sample sits at the rail position for its fraction.
    expect(bg).toContain('rail(0)');
    expect(bg).toContain('rail(0.5)');
    expect(bg).toContain('rail(1)');
    // The dimmed ends run to the rail positions of the active range's ends.
    expect(bg).toContain('rail(0.25)');
    expect(bg).toContain('rail(0.75)');
  });

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
    expect(bg).toContain('rgb(0, 0, 0)');
    expect(bg).toContain('rgb(255, 255, 255)');
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

describe('paintGradientTrack on a curve', () => {
  // A quarter of the way in from each end of a 180° arc is the value span; the rest is band past it.
  const arc = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 90, end: 270, direction: 'ccw' });
  const curved: TrackCtx = { ...ctx, shape: trackRun(arc, 0.25, 0.75), trackWidth: arc.length / 2, along: true };
  const paint = (opts: Parameters<typeof paintGradientTrack>[0]) => render(<svg>{paintGradientTrack(opts)(curved)}</svg>).container;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  it('strokes the value span in segments, each a ramp between the samples at its ends', () => {
    const c = paint({ gradient: (t) => `rgb(${Math.round(t * 255)}, 0, 0)`, samples: 4 });
    const ramps = [...c.querySelectorAll('linearGradient')];
    expect(ramps).toHaveLength(4);
    const run = curved.shape;
    ramps.forEach((g, i) => {
      const [a, b] = [run.at(i / 4).point, run.at((i + 1) / 4).point];
      expect(near(Number(g.getAttribute('x1')), a.x) && near(Number(g.getAttribute('y1')), a.y)).toBe(true);
      expect(near(Number(g.getAttribute('x2')), b.x) && near(Number(g.getAttribute('y2')), b.y)).toBe(true);
      const stops = [...g.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color'));
      expect(stops).toEqual([`rgb(${Math.round((i / 4) * 255)}, 0, 0)`, `rgb(${Math.round(((i + 1) / 4) * 255)}, 0, 0)`]);
    });
    for (const g of ramps) expect(c.querySelector(`path[stroke="url(#${g.id})"]`)).not.toBeNull();
  });

  it('carries the end colors over the band past each end of the span', () => {
    const c = paint({ gradient: (t) => (t < 0.5 ? 'black' : 'white'), samples: 2 });
    const solid = [...c.querySelectorAll('path')].filter((p) => !p.getAttribute('stroke')?.startsWith('url('));
    // Reading order runs against the arc here, so the arc's start holds the span's end.
    const run = curved.shape as TrackRun;
    expect(run.reversed).toBe(true);
    // Each runs from its end of the band to just under the span, so no seam shows where the ramp begins.
    expect(solid.map((p) => p.getAttribute('stroke'))).toEqual(['black', 'white']);
    expect(solid[0]!.getAttribute('d')).toMatch(/ 20 100$/);
    expect(solid[1]!.getAttribute('d')).toMatch(/^M 180 100 /);
  });

  it('dims and hatches the band outside the active range', () => {
    const c = paint({ gradient: () => '#888', activeRange: [0.25, 0.75] });
    const dim = [...c.querySelectorAll('path[data-dim]')].map((p) => p.getAttribute('d'));
    const hatch = [...c.querySelectorAll('path[data-hatch]')].map((p) => p.getAttribute('d'));
    // Span fractions 0.25 and 0.75 are arc fractions 0.625 and 0.375, reversed.
    const outside = [trackShapeD(arc, 0.625, 1), trackShapeD(arc, 0, 0.375)];
    expect(dim).toEqual(outside);
    expect(hatch).toEqual(outside);
    const pattern = c.querySelector('pattern')!;
    expect(c.querySelector(`path[data-hatch]`)!.getAttribute('stroke')).toBe(`url(#${pattern.id})`);
    expect(pattern.getAttribute('patternTransform')).toBe('rotate(45)');
  });

  it('draws nothing on a run collapsed to a point, as on the render before an Along is measured', () => {
    const collapsed: TrackCtx = { ...curved, shape: trackRun(arc, 0.5, 0.5) };
    const c = render(<svg>{paintGradientTrack({ gradient: () => '#888', activeRange: [0.25, 0.75] })(collapsed)}</svg>).container;
    expect(c.querySelector('path')).toBeNull();
  });

  it('draws no dimming when the active range covers the span', () => {
    const c = paint({ gradient: () => '#888', activeRange: [0, 1] });
    expect(c.querySelector('[data-dim], [data-hatch], pattern')).toBeNull();
  });
});

it('strokes a line shape the slider lies along as a band, not a box-wide CSS ramp', () => {
  const line: TrackCtx = { ...ctx, shape: trackRun(lineShape({ x: 10, y: 90 }, { x: 190, y: 30 })), along: true };
  const c = render(<svg>{paintGradientTrack({ gradient: () => '#888', samples: 2 })(line)}</svg>).container;
  expect(c.querySelectorAll('linearGradient')).toHaveLength(2);
});
