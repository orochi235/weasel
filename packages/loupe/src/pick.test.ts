import { describe, it, expect } from 'vitest';
import { screenToWorld, viewToTransform, worldToScreen } from '@weasel-js/core';
import { loupeInnerView, loupeSourcePoint } from './geometry';

const rect = { x: 30, y: 48, w: 208, h: 170 };

describe('loupeSourcePoint', () => {
  it('maps the lens center to the aim point', () => {
    const p = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    expect(loupeSourcePoint(p, rect, { x: 400, y: 300 }, 8)).toEqual({ x: 400, y: 300 });
  });

  it('divides the offset from the center by the magnification', () => {
    const p = { x: rect.x + rect.w / 2 + 40, y: rect.y + rect.h / 2 - 16 };
    expect(loupeSourcePoint(p, rect, { x: 400, y: 300 }, 8)).toEqual({ x: 405, y: 298 });
  });

  // The one that matters: picking and painting must agree about what the
  // lens is showing, whatever view the canvas is under.
  it.each([
    { x: 0, y: 0, scale: { x: 1, y: 1 } },
    { x: -120, y: 55, scale: { x: 2.5, y: 2.5 } },
    { x: 33, y: -7, scale: { x: 0.4, y: 0.4 } },
  ])('inverts the inner view %o paints through', (outer) => {
    const aim = { x: 400, y: 300 };
    const factor = 6;
    const world = screenToWorld(aim.x, aim.y, viewToTransform(outer));
    const inner = loupeInnerView({ x: world[0], y: world[1] }, outer, rect, factor);

    const p = { x: rect.x + 17, y: rect.y + 133 };
    // Where the lens's own paint puts that point: through the inner view,
    // with the rect origin as its screen origin.
    const innerWorld = screenToWorld(p.x - rect.x, p.y - rect.y, viewToTransform(inner));
    const onCanvas = worldToScreen(innerWorld[0], innerWorld[1], viewToTransform(outer));

    const got = loupeSourcePoint(p, rect, aim, factor);
    expect(got.x).toBeCloseTo(onCanvas[0], 6);
    expect(got.y).toBeCloseTo(onCanvas[1], 6);
  });
});
