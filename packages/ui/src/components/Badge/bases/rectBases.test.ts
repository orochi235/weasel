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
  it('gives every point a unit normal at full pinch, where its end edges collapse to points', () => {
    const sampler = RoundedRect.build({ erosion: 0, pinch: 1 }, 40, 40);
    for (let i = 0; i < 400; i++) {
      const p = sampler.perimeterAt((i / 400) * sampler.totalCss);
      expect(Math.hypot(p.nx, p.ny)).toBeCloseTo(1, 6);
    }
  });

  it('draws a radius in CSS px on any box height', () => {
    const arc = (boxH: number, radius: number) => {
      const m = RoundedRect.build({ radius }, 100, boxH).bodyPath.match(/A ([\d.]+) ([\d.]+)/)!;
      return [Number(m[1]), (Number(m[2]) * boxH) / 100];
    };
    for (const boxH of [16, 22, 30, 40]) {
      expect(arc(boxH, 6)[0]).toBeCloseTo(6, 6);
      expect(arc(boxH, 6)[1]).toBeCloseTo(6, 6);
    }
    expect(arc(16, 100)[1]).toBeCloseTo(8, 6);
  });

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

describe('a pinched rounded-rect base', () => {
  it('measures its perimeter along the squeezed outline', () => {
    for (const params of [{ erosion: 0, pinch: 1 }, { erosion: 0.3, pinch: 0.6 }]) {
      const sampler = RoundedRect.build(params, 200, 20);
      expect(measured(sampler, 200, 20)).toBeCloseTo(sampler.totalCss, 0);
    }
    expect(RoundedRect.build({ erosion: 0, pinch: 1 }, 200, 20).totalCss).toBeLessThan(420);
  });

  it('walks the squeezed outline at an even pace, with no length at a collapsed end', () => {
    const boxW = 200;
    const boxH = 20;
    const sampler = RoundedRect.build({ erosion: 0, pinch: 1 }, boxW, boxH);
    for (let i = 1; i < 200; i++) {
      const s = (i / 200) * sampler.totalCss;
      const [a, p, b] = [s - 0.05, s, s + 0.05].map((at) => sampler.perimeterAt(at));
      const step = (u: typeof p, v: typeof p) => Math.hypot(((v.x - u.x) * boxW) / 100, ((v.y - u.y) * boxH) / 100);
      expect(step(a!, p!) + step(p!, b!)).toBeCloseTo(0.1, 2);
    }
  });

  it('keeps its square corners in the drawn outline', () => {
    const { bodyPath } = RoundedRect.build({ erosion: 0, pinch: 0.5 }, 200, 20);
    for (const corner of ['0 25', '100 25', '100 75', '0 75']) expect(bodyPath).toContain(` ${corner}`);
  });
});
