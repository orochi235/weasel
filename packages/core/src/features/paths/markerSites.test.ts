import { describe, it, expect } from 'vitest';
import { markerSites } from './markerSites';
import type { Polyline } from './tessellate/polyline';

const ALL = { start: true, mid: true, end: true };

/** (0,0) -> (10,0), two authored anchors. */
function straight(): Polyline {
  return {
    points: [0, 0, 10, 0],
    closed: false,
    anchorA: new Uint32Array([0, 1]),
    anchorB: new Uint32Array([0, 1]),
    anchorT: new Float32Array([0, 0]),
  };
}

/** (0,0) -> (10,0) -> (10,10): one interior authored anchor at the corner. */
function bent(): Polyline {
  return {
    points: [0, 0, 10, 0, 10, 10],
    closed: false,
    anchorA: new Uint32Array([0, 1, 2]),
    anchorB: new Uint32Array([0, 1, 2]),
    anchorT: new Float32Array([0, 0, 0]),
  };
}

describe('markerSites', () => {
  it('puts the end marker on the last point, pointing along travel', () => {
    const end = markerSites(straight(), { start: false, mid: false, end: true });
    expect(end).toHaveLength(1);
    expect(end[0]).toMatchObject({ role: 'end', x: 10, y: 0 });
    expect(end[0].angle).toBeCloseTo(0, 6);
  });

  it('reverses the start marker so both heads point outward', () => {
    const start = markerSites(straight(), { start: true, mid: false, end: false });
    expect(start).toHaveLength(1);
    expect(start[0]).toMatchObject({ role: 'start', x: 0, y: 0 });
    expect(Math.abs(start[0].angle)).toBeCloseTo(Math.PI, 6);
  });

  it('places a mid marker on the bisector at an interior anchor', () => {
    const mid = markerSites(bent(), { start: false, mid: true, end: false });
    expect(mid).toHaveLength(1);
    expect(mid[0]).toMatchObject({ role: 'mid', x: 10, y: 0 });
    // Arriving +X, leaving +Y — the bisector is 45°.
    expect(mid[0].angle).toBeCloseTo(Math.PI / 4, 6);
  });

  it('emits no mid marker on a two-anchor run', () => {
    expect(markerSites(straight(), { start: false, mid: true, end: false })).toEqual([]);
  });

  it('skips flattened curve samples, keeping only authored anchors', () => {
    // Interior samples carry A !== B, marking them as curve interior.
    const curve: Polyline = {
      points: [0, 0, 3, 1, 6, 1, 10, 0],
      closed: false,
      anchorA: new Uint32Array([0, 0, 0, 1]),
      anchorB: new Uint32Array([0, 1, 1, 1]),
      anchorT: new Float32Array([0, 0.3, 0.7, 0]),
    };
    expect(markerSites(curve, { start: false, mid: true, end: false })).toEqual([]);
  });

  it('gives a closed subpath no start or end', () => {
    const loop: Polyline = { ...bent(), closed: true };
    const sites = markerSites(loop, ALL);
    expect(sites.some((s) => s.role === 'start' || s.role === 'end')).toBe(false);
  });

  it('returns nothing when no marker was asked for', () => {
    expect(markerSites(bent(), { start: false, mid: false, end: false })).toEqual([]);
  });
});
