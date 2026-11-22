import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/geom';
import { outlineDetail, outlinePath } from '../outline';

describe('folder', () => {
  it.each([{ x: 0, y: 0, width: 10, height: 100 }, { x: 0, y: 0, width: 30, height: 200 }])(
    'keeps its tab inside a box narrower than the tab is deep, %o',
    (b) => {
      for (const p of [outlinePath('folder', b), outlineDetail('folder', b)!]) {
        const got = boundsOfPath(p);
        expect(got.x + got.width).toBeLessThanOrEqual(b.x + b.width + 1e-6);
      }
    },
  );
});
