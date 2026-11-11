import { describe, expect, it } from 'vitest';
import { alignmentSnapSource } from './alignment';
import { spacingSnapSource } from './spacing';
import { moveBy, sceneOf } from './testing/session';

describe('spacingSnapSource, shrunk from the property tests', () => {
  it('drops an equal-spacing snap the other axis carries the box away from, and stays put snapped again', () => {
    // Alignment took x, and the spacing snap on y kept a gap the box no longer had there: it marked nothing, and
    // snapping the landed box again moved it 0.1875 onto the alignment line it should have met.
    const box = { x: 2.75, y: 17.5, width: 0.5, height: 14.125 };
    const others = [{ x: 6.5, y: 31.875, width: 20.625, height: 0.125 }, { x: 11, y: 6.75, width: 16.125, height: 10.625 }, { x: 0, y: 0, width: 0.125, height: 0.125 }];
    const move = (b: typeof box, dx: number) => {
      const { scene, ids } = sceneOf([b, ...others]);
      return moveBy({ sources: [alignmentSnapSource(), spacingSnapSource()], scene, ids: [ids[0]!], scale: 0.5, reachPx: 1 }).by(dx, 0).point;
    };
    const d = move(box, 24.25);
    expect(d).toEqual({ x: 24.375, y: -0.125 });
    expect(move({ ...box, x: box.x + d.x, y: box.y + d.y }, 0)).toEqual({ x: 0, y: 0 });
  });
});
