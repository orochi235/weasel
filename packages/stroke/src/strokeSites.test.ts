import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import { nearestStrokeSite, strokeSitesAt } from './strokeSites';

const L = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).build();

describe('nearestStrokeSite', () => {
  it('finds the centerline point and its fraction of the length', () => {
    const site = nearestStrokeSite(L, 50, 7)!;
    expect(site.t).toBeCloseTo(0.25, 9);
    expect(site.length).toBeCloseTo(200, 9);
    expect(site.x).toBeCloseTo(50, 9);
    expect(site.distance).toBeCloseTo(7, 9);
    expect(Math.abs(site.ny)).toBeCloseTo(1, 9);
  });

  it('measures each subpath on its own', () => {
    const two = new PathBuilder().moveTo(0, 0).lineTo(100, 0).moveTo(0, 50).lineTo(10, 50).build();
    const site = nearestStrokeSite(two, 5, 51)!;
    expect(site.subpath).toBe(1);
    expect(site.t).toBeCloseTo(0.5, 9);
  });

  it('reaches the closing segment of a closed subpath', () => {
    const square = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close().build();
    expect(nearestStrokeSite(square, -1, 5)!.t).toBeCloseTo(0.875, 9);
  });
});

describe('strokeSitesAt', () => {
  it('answers the point a fraction along every subpath', () => {
    const [site] = strokeSitesAt(L, 0.75);
    expect(site.x).toBeCloseTo(100, 9);
    expect(site.y).toBeCloseTo(50, 9);
  });

  it('inverts nearestStrokeSite', () => {
    const near = nearestStrokeSite(L, 100, 30)!;
    const [back] = strokeSitesAt(L, near.t);
    expect(back.x).toBeCloseTo(near.x, 6);
    expect(back.y).toBeCloseTo(near.y, 6);
  });
});
