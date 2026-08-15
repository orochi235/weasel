import { describe, it, expect } from 'vitest';
import { makeRandomScene, pipView, PIP } from '../ViewportLayerDemo';

/** The world rect a viewport shows: its inner view's origin, extended by the
 *  screen bounds divided by the inner scale. */
function pipWorldRect() {
  const view = pipView(makeRandomScene());
  return {
    x0: view.x, y0: view.y,
    x1: view.x + PIP.w / PIP.scale,
    y1: view.y + PIP.h / PIP.scale,
  };
}

describe('ViewportLayerDemo PiP', () => {
  it('lenses a slice of the world that holds scene content', () => {
    // The scene is randomly placed on every mount, so this asserts over many
    // draws: a PiP aimed at a fixed world rect is empty about half the time,
    // which reads as a broken viewport rather than an empty one.
    for (let trial = 0; trial < 200; trial++) {
      const items = makeRandomScene();
      const view = pipView(items);
      const r = {
        x0: view.x, y0: view.y,
        x1: view.x + PIP.w / PIP.scale,
        y1: view.y + PIP.h / PIP.scale,
      };
      const visible = items.filter(
        (n) =>
          n.pose.x < r.x1 && n.pose.x + n.pose.width > r.x0 &&
          n.pose.y < r.y1 && n.pose.y + n.pose.height > r.y0,
      );
      expect(visible.length, `trial ${trial}: PiP world rect ${JSON.stringify(r)} is empty`)
        .toBeGreaterThan(0);
    }
  });

  it('lenses a 150x100 world slice', () => {
    const r = pipWorldRect();
    expect(r.x1 - r.x0).toBeCloseTo(PIP.w / PIP.scale);
    expect(r.y1 - r.y0).toBeCloseTo(PIP.h / PIP.scale);
  });
});
