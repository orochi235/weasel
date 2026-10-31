import { boundsOfPath, pathContainsPoint } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { boxForContent, contentBox, outlineDetail, outlinePath, type Bounds } from '../outline';

const BOX: Bounds = { x: 10, y: 20, width: 160, height: 90 };

const inside = (outer: Bounds, inner: Bounds) =>
  inner.x >= outer.x - 1e-3 && inner.y >= outer.y - 1e-3
  && inner.x + inner.width <= outer.x + outer.width + 1e-3 && inner.y + inner.height <= outer.y + outer.height + 1e-3;

describe.each(['boundary', 'control', 'entity'])('%s', (outline) => {
  it('stands its figure over a label strip, inside its bounds', () => {
    const figure = boundsOfPath(outlinePath(outline, BOX));
    const c = contentBox(outline, BOX);
    expect(inside(BOX, figure)).toBe(true);
    expect(c.y).toBeGreaterThanOrEqual(figure.y + figure.height - 1e-3);
    expect(c.y + c.height).toBeCloseTo(BOX.y + BOX.height, 6);
  });
});

describe.each(['collections', 'queue'])('%s', (outline) => {
  it('keeps its outline, detail, and content inside its bounds, the content inside the shape', () => {
    expect(inside(BOX, boundsOfPath(outlinePath(outline, BOX)))).toBe(true);
    expect(inside(BOX, boundsOfPath(outlineDetail(outline, BOX)!))).toBe(true);
    const c = contentBox(outline, BOX);
    const path = outlinePath(outline, BOX);
    for (const [x, y] of [[c.x + 1, c.y + 1], [c.x + c.width - 1, c.y + c.height - 1]] as const) expect(pathContainsPoint(path, x, y)).toBe(true);
  });

  it('sizes a box whose content holds what was asked for', () => {
    const want = { width: 80, height: 24 };
    const got = contentBox(outline, { x: 0, y: 0, ...boxForContent(outline, want) });
    expect(got.width).toBeGreaterThanOrEqual(want.width - 1e-6);
    expect(got.height).toBeGreaterThanOrEqual(want.height - 1e-6);
  });
});
