import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/geom';
import { outlineDetail, outlinePath, outlineSolid } from '../outline';

/** Far enough from 0 that a Float32 coordinate steps by 0.5. */
const FAR = { x: 5_000_000.25, y: -3_000_000.25, width: 240, height: 160 };
const OUTLINES = ['roundRect', 'stadium', 'cylinder', 'person', 'collections', 'queue', 'component', 'cube', 'endEvent', 'subprocess'] as const;

describe.each(OUTLINES)('%s far from the origin', (outline) => {
  it('keeps its path and detail on the bounds it was given', () => {
    const paths = [outlinePath(outline, FAR), outlineDetail(outline, FAR), outlineSolid(outline, FAR)];
    for (const p of paths) {
      if (!p) continue;
      const got = boundsOfPath(p);
      expect(got.x).toBeGreaterThanOrEqual(FAR.x - 0.01);
      expect(got.y).toBeGreaterThanOrEqual(FAR.y - 0.01);
      expect(got.x + got.width).toBeLessThanOrEqual(FAR.x + FAR.width + 0.01);
      expect(got.y + got.height).toBeLessThanOrEqual(FAR.y + FAR.height + 0.01);
    }
    const main = boundsOfPath(outlinePath(outline, FAR));
    expect(Math.min(main.x - FAR.x, main.y - FAR.y)).toBeGreaterThan(-0.01);
  });
});
