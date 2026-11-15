/** An SVG region export writes a parallax plane's nodes at their document poses, as PNG and PDF draw them. */
import { describe, expect, it } from 'vitest';
import { parallaxScene, PARALLAX_POSE } from '@weasel-js/core/testing/parallaxScene';
import { exportRegionSvg } from './regionSvg';

describe('exportRegionSvg of a scene with a parallax plane', () => {
  it.each([{ pan: 0.5 }, { pan: { x: 0.25, y: 2 }, zoom: 0.5, anchor: { x: 37, y: -12 } }])('writes the plane at its document pose (%o)', async (plane) => {
    const scene = parallaxScene(plane);
    const svg = await exportRegionSvg(scene, { ...PARALLAX_POSE });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.documentElement.getAttribute('viewBox')).toBe('100 0 10 10');
    const shapes = [...doc.querySelectorAll('rect, path')].map((el) => el.outerHTML);
    expect(shapes).toHaveLength(2);
    expect(shapes[1]).toMatch(/x="100"|M100 0/);
    expect(shapes[0]!.replace('#ff0000', '#00ff00')).toBe(shapes[1]);
  });
});
