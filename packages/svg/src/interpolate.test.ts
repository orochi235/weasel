import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode } from './types';

const STOPS = [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }];

function square(paint: unknown): SvgNode[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { kind: 'gradient', paint },
  } as unknown as SvgNode];
}

const LINEAR_OKLCH = {
  fill: 'linear-gradient' as const,
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: STOPS,
  units: 'bounds' as const,
  interpolate: 'oklch' as const,
};

function paintOf(svg: string): Record<string, unknown> {
  const nodes = parseSvg(svg).nodes as unknown as { fill?: { paint?: Record<string, unknown> } }[];
  const paint = nodes[0].fill?.paint;
  if (!paint) throw new Error('no paint parsed');
  return paint;
}

describe('gradient interpolation space in SVG', () => {
  it('keeps the native element and marks the space beside it', () => {
    const svg = serializeSvg(square(LINEAR_OKLCH));
    expect(svg).toContain('<linearGradient id="grad0"');
    expect(svg).toContain('wzl:interpolate="oklch"');
    expect(svg).toContain('xmlns:wzl="urn:weasel-js:svg"');
  });

  it('references the gradient without a fallback, since SVG still paints it', () => {
    const svg = serializeSvg(square(LINEAR_OKLCH));
    expect(svg).toContain('fill="url(#grad0)"');
  });

  it('writes nothing for the default space, and declares no namespace for it', () => {
    const svg = serializeSvg(square({ ...LINEAR_OKLCH, interpolate: 'rgb' }));
    expect(svg).not.toContain('wzl:interpolate');
    expect(svg).not.toContain('xmlns:wzl');
  });

  it('round-trips the space on all three kinds', () => {
    for (const space of ['oklab', 'oklch'] as const) {
      const linear = paintOf(serializeSvg(square({ ...LINEAR_OKLCH, interpolate: space })));
      expect(linear.interpolate).toBe(space);

      const radial = paintOf(serializeSvg(square({
        fill: 'radial-gradient', center: { x: 0.5, y: 0.5 }, radius: 0.5,
        stops: STOPS, units: 'bounds', interpolate: space,
      })));
      expect(radial.interpolate).toBe(space);

      const conic = paintOf(serializeSvg(square({
        fill: 'conic-gradient', center: { x: 0.5, y: 0.5 }, angle: 0,
        stops: STOPS, units: 'bounds', interpolate: space,
      })));
      expect(conic.interpolate).toBe(space);
    }
  });

  it('leaves the field off a gradient that never named a space', () => {
    const paint = paintOf(serializeSvg(square({
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: STOPS, units: 'bounds',
    })));
    expect(paint.interpolate).toBeUndefined();
  });

  it('ignores a space it does not know rather than carrying it through', () => {
    const svg = serializeSvg(square(LINEAR_OKLCH)).replace('"oklch"', '"lab"');
    expect(paintOf(svg).interpolate).toBeUndefined();
  });
});
