import { describe, expect, it } from 'vitest';
import type { View } from 'core/viewport/view';
import { ViewSnap } from './viewSnap';

const at = (x: number, y = 0, zoom = 1): View => ({ x, y, scale: { x: zoom, y: zoom } });
/** The translation a view draws under, device pixels at 2x. */
const device = (v: View): [number, number] => [-v.x * v.scale.x * 2, -v.y * v.scale.y * 2];

describe('ViewSnap', () => {
  it('draws a moving view whole device pixels from where it held', () => {
    const snap = new ViewSnap();
    snap.draw(at(0.25), 2, true);
    // Held at -0.5 device px; moved 0.6 more, drawn 1 from where it held.
    expect(device(snap.draw(at(0.55), 2, true))).toEqual([-1.5, 0]);
    expect(snap.owesFrame(0)).toBe(true);
  });

  it('draws the view exactly once it holds', () => {
    const snap = new ViewSnap();
    snap.draw(at(0), 2, true);
    snap.draw(at(0.3, 0.7), 2, true);
    const held = at(0.3, 0.7);
    expect(snap.draw(held, 2, true)).toBe(held);
  });

  it('owes one frame after a hold off the grid that drew a retained layer through', () => {
    const snap = new ViewSnap();
    snap.draw(at(0), 2, true);
    snap.draw(at(0.3), 2, true);
    snap.draw(at(0.3), 2, true);
    expect(snap.owesFrame(1)).toBe(true);
    snap.draw(at(0.3), 2, true);
    expect(snap.owesFrame(1)).toBe(false);
  });

  it('owes nothing after a hold off the grid that drew nothing through', () => {
    const snap = new ViewSnap();
    snap.draw(at(0), 2, true);
    snap.draw(at(0.3), 2, true);
    snap.draw(at(0.3), 2, true);
    expect(snap.owesFrame(0)).toBe(false);
  });

  it('rounds the translation, not the camera, under zoom', () => {
    const snap = new ViewSnap();
    snap.draw(at(0, 0, 3), 2, true);
    const [x] = device(snap.draw(at(0.1, 0, 3), 2, true));
    // 0.1 world units at zoom 3 is 0.6 device px at 2x.
    expect(x).toBeCloseTo(-1, 9);
  });

  it('draws every view exactly with snapping off', () => {
    const snap = new ViewSnap();
    snap.draw(at(0), 2, false);
    const moved = at(0.3);
    expect(snap.draw(moved, 2, false)).toBe(moved);
    expect(snap.owesFrame(1)).toBe(false);
  });
});
