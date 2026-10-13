import { describe, expect, it } from 'vitest';
import { quatrefoilRadius, quatrefoilVertices } from './Quatrefoil';

describe('quatrefoilRadius', () => {
  it('runs from the spike radius to the lobe radius through the valley when the join is sharp', () => {
    const r = quatrefoilRadius({ valleySmooth: 0 });
    expect(r(0)).toBeCloseTo(50, 10);
    expect(r(0.25)).toBeCloseTo(37.5, 10);
    expect(r(0.5)).toBeCloseTo(25, 10);
    expect(r(0.75)).toBeCloseTo(33.5, 10);
    expect(r(1)).toBeCloseTo(42, 10);
  });

  it('lifts every radius by the smooth maximum of the two segments', () => {
    const r = quatrefoilRadius();
    expect(r(0)).toBeCloseTo((75 + Math.sqrt(634)) / 2, 10);
    expect(r(0.25)).toBeCloseTo((62.5 + Math.sqrt(165.25)) / 2, 10);
    expect(r(0.5)).toBeCloseTo(26.5, 10);
    expect(r(1)).toBeCloseTo((67 + Math.sqrt(298)) / 2, 10);
  });

  it('truncates a tip by its erosion', () => {
    expect(quatrefoilRadius({ valleySmooth: 0, spikeTipErosion: 0.2 })(0)).toBeCloseTo(45, 10);
    expect(quatrefoilRadius({ valleySmooth: 0, lobeTipErosion: 0.5 })(1)).toBeCloseTo(33.5, 10);
  });

  it('bulges a segment outward as its curvature rises', () => {
    const r = quatrefoilRadius({ valleySmooth: 0, spikeCurvature: 2 });
    expect(r(0.25)).toBeCloseTo(25 + 25 * Math.sqrt(0.75), 10);
  });

  it('clamps the spike radius to the box and the valley to the lower of the two tips', () => {
    expect(quatrefoilRadius({ valleySmooth: 0, spikeR: 80 })(0)).toBeCloseTo(50, 10);
    expect(quatrefoilRadius({ valleySmooth: 0, spikeR: 20, valleyR: 30 })(0.5)).toBeCloseTo(20, 10);
  });
});

describe('quatrefoilVertices', () => {
  it('places each vertex at the profile radius around the box center', () => {
    const verts = quatrefoilVertices({ valleySmooth: 0, samples: 48 });
    expect(verts).toHaveLength(48);
    expect(verts[0][0]).toBeCloseTo(100, 10);
    expect(verts[0][1]).toBeCloseTo(50, 10);
    expect(verts[6][0]).toBeCloseTo(50 + 42 * Math.SQRT1_2, 10);
    expect(verts[6][1]).toBeCloseTo(50 + 42 * Math.SQRT1_2, 10);
    expect(verts[12][0]).toBeCloseTo(50, 10);
    expect(verts[12][1]).toBeCloseTo(100, 10);
  });
});
