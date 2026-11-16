import { describe, expect, it } from 'vitest';
import ChamferedRect from './ChamferedRect';
import RoundedRect from './RoundedRect';
import type { BaseSampler } from './types';

function measured(sampler: BaseSampler, boxW: number, boxH: number, n = 4000): number {
  let len = 0;
  let prev = sampler.perimeterAt(0);
  for (let i = 1; i <= n; i++) {
    const p = sampler.perimeterAt((i / n) * sampler.totalCss);
    len += Math.hypot(((p.x - prev.x) * boxW) / 100, ((p.y - prev.y) * boxH) / 100);
    prev = p;
  }
  return len;
}

describe('the rounded-rect base', () => {
  it('measures elliptical corners by their arc length', () => {
    const sampler = RoundedRect.build({ eccentricity: 3, erosion: 0.5 }, 120, 24);
    expect(sampler.totalCss).toBeCloseTo(281.38, 1);
    expect(measured(sampler, 120, 24)).toBeCloseTo(sampler.totalCss, 1);
  });

  it('samples a corner at even arc length, with the ellipse normal', () => {
    const boxW = 120;
    const boxH = 24;
    const sampler = RoundedRect.build({ eccentricity: 3, erosion: 0.5 }, boxW, boxH);
    const steps = 200;
    for (let i = 1; i < steps; i++) {
      const s = (i / steps) * sampler.totalCss;
      const a = sampler.perimeterAt(s - 0.05);
      const b = sampler.perimeterAt(s + 0.05);
      const gap = Math.hypot(((b.x - a.x) * boxW) / 100, ((b.y - a.y) * boxH) / 100);
      expect(gap).toBeCloseTo(0.1, 2);
      const p = sampler.perimeterAt(s);
      const tx = ((b.x - a.x) * boxW) / 100;
      const ty = ((b.y - a.y) * boxH) / 100;
      expect(Math.abs(p.nx * tx + p.ny * ty) / gap).toBeLessThan(0.01);
    }
  });
});

describe('the chamfered-rect base', () => {
  it('holds a chamfer to half the shorter side, so the outline stays convex', () => {
    const boxW = 80;
    const boxH = 10;
    const sampler = ChamferedRect.build({ chamfer: 6 }, boxW, boxH);
    for (let i = 0; i < 400; i++) {
      const p = sampler.perimeterAt((i / 400) * sampler.totalCss);
      expect(p.nx * (p.x - 50) * boxW + p.ny * (p.y - 50) * boxH).toBeGreaterThan(0);
    }
  });
});
