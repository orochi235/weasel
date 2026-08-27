import { describe, it, expect } from 'vitest';
import { solid, strokeOf } from '@weasel-js/core';
import type { FillStyle } from '@weasel-js/core';
import { computeScrubbedPaints } from './computeScrubbedPaints';

/** Opacity of the scrubbed fill / stroke paint, rounded to 3 places so the
 *  8-bit hex the fixtures are written in compares cleanly. */
function alphas(out: ReturnType<typeof computeScrubbedPaints>) {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    fill: out.fill ? round(out.fill.opacity ?? 1) : null,
    stroke: out.stroke ? round(out.stroke.paint.opacity ?? 1) : null,
  };
}

describe('computeScrubbedPaints', () => {
  it('scales both opacities by the same factor, preserving ratio', () => {
    // fill α=0.8, stroke α=0.4 → ratio 2:1
    // target brightest = 0.4 → factor 0.5 → fill α=0.4, stroke α=0.2
    const out = computeScrubbedPaints(
      { fill: solid('#ff0000cc'), stroke: strokeOf('#00ff0066') }, // 0xcc≈0.8, 0x66≈0.4
      0.4,
    );
    expect(alphas(out)).toEqual({ fill: 0.4, stroke: 0.2 });
  });

  it('clamps target to [0, 1]', () => {
    const out = computeScrubbedPaints(
      { fill: solid('#ff0000ff'), stroke: strokeOf('#00ff00ff') },
      1.5,
    );
    expect(alphas(out)).toEqual({ fill: 1, stroke: 1 });
  });

  it('handles target = 0', () => {
    const out = computeScrubbedPaints(
      { fill: solid('#ff0000ff'), stroke: strokeOf('#00ff0080') },
      0,
    );
    expect(alphas(out)).toEqual({ fill: 0, stroke: 0 });
  });

  it('passes through an absent paint unchanged', () => {
    const out = computeScrubbedPaints({ fill: null, stroke: strokeOf('#000000ff') }, 0.5);
    expect(out.fill).toBeNull();
    expect(alphas(out).stroke).toBe(0.5);
  });

  it('returns zero opacities unchanged when both start at 0 (no ratio to preserve)', () => {
    const out = computeScrubbedPaints(
      { fill: solid('#ff000000'), stroke: strokeOf('#00ff0000') },
      0.5,
    );
    expect(alphas(out)).toEqual({ fill: 0, stroke: 0 });
  });

  it('scrubs a gradient fill, which the old hex-splicing form could not', () => {
    // The whole reason opacity lives on the paint: a gradient has no hex to
    // splice an alpha into, and used to pass through untouched.
    const gradient: FillStyle = {
      fill: 'linear-gradient',
      from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
      opacity: 1,
    };
    const out = computeScrubbedPaints({ fill: gradient, stroke: null }, 0.5);
    expect(out.fill).toEqual({ ...gradient, opacity: 0.5 });
  });

  it('keeps the stroke geometry while scrubbing its paint', () => {
    const dashed = { paint: solid('#000000ff'), width: 4, dash: [2, 2] };
    const out = computeScrubbedPaints({ fill: null, stroke: dashed }, 0.25);
    expect(out.stroke).toEqual({ ...dashed, paint: { color: '#000000', opacity: 0.25 } });
  });
});
