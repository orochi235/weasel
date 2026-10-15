/**
 * A corner widget is hit where the overlay paints it, from the one placement
 * `cornerWidgetAt` answers.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfPath, CORNER_KEYWORDS, polygonFromPoints, withCorner, type PolygonPath } from '@weasel-js/geom';
import { anchorStateFrom, buildAffordanceAt } from 'canvas/affordanceAt';
import type { ChromeState } from 'core/selection/chromeState';
import { makeEditAnchorsDep } from 'interactions/actions/testUtils';
import { cornerWidgetAt, cornerWidgetCommands, cornerWidgetFrames } from './cornerWidgets';

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

const VIEW = { x: -10, y: -10, scale: { x: 2, y: 2 } };

function affordanceAtFor(path: PolygonPath) {
  const dep = makeEditAnchorsDep({ editingId: 'sq', getEditablePath: () => path });
  return buildAffordanceAt({
    getChromeState: () => ({ selection: ['sq'], boundsOf: () => null, multiActive: false, unionBounds: null } as unknown as ChromeState),
    getView: () => VIEW,
    getAnchorState: anchorStateFrom(() => ({ get: () => dep })),
  });
}

describe('corner widgets', () => {
  it('offers one widget per corner anchor, and none on a flat one', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]);
    expect(cornerWidgetFrames(square()).map((f) => f.index)).toEqual([0, 1, 2, 3]);
    expect(cornerWidgetFrames(p).map((f) => f.index)).toEqual([0, 2, 3]);
  });

  it('sits inside the corner, 14px from the middle of its cut', () => {
    const f = cornerWidgetFrames(square())[1];
    const at = cornerWidgetAt(f, VIEW.scale);
    // At 2x, 14px is 7 world units down the bisector from (100, 0).
    expect(at.x).toBeCloseTo(100 - 7 * Math.SQRT1_2, 6);
    expect(at.y).toBeCloseTo(7 * Math.SQRT1_2, 6);
  });

  it('follows the cut as the radius grows', () => {
    const f = cornerWidgetFrames(withCorner(square(), 1, { shape: 'bevel', radius: 20 }))[1];
    const at = cornerWidgetAt(f, VIEW.scale);
    // The bevel's middle is (90, 10); the widget sits 7 further in.
    expect(at.x).toBeCloseTo(90 - 7 * Math.SQRT1_2, 6);
    expect(at.y).toBeCloseTo(10 + 7 * Math.SQRT1_2, 6);
  });

  it('is hit as `corner:N` where it is painted', () => {
    const path = square();
    const at = cornerWidgetAt(cornerWidgetFrames(path)[2], VIEW.scale);
    expect(affordanceAtFor(path)({ x: at.x, y: at.y })?.kind).toBe('corner:2');
    // The anchor itself still wins at its own point.
    expect(affordanceAtFor(path)({ x: 100, y: 100 })?.kind).toBe('anchor:2');

    const glyphs = cornerWidgetCommands(path, VIEW, { fill: '#fff', stroke: '#000' });
    const third = glyphs[2];
    if (third.kind !== 'path') throw new Error('expected a path');
    const b = boundsOfPath(third.path);
    expect(b.x + b.width / 2).toBeCloseTo((at.x - VIEW.x) * VIEW.scale.x, 3);
    expect(b.y + b.height / 2).toBeCloseTo((at.y - VIEW.y) * VIEW.scale.y, 3);
  });

  it('draws each corner-shape keyword as a glyph of its own', () => {
    const glyphs = CORNER_KEYWORDS.map((shape) => {
      const [cmd] = cornerWidgetCommands(withCorner(square(), 0, { shape, radius: 10 }), VIEW, { fill: '#fff', stroke: '#000' });
      if (cmd.kind !== 'path' || cmd.path.kind !== 'polygon') throw new Error('expected a polygon');
      return JSON.stringify([...cmd.path.commands, ...Array.from(cmd.path.coords, (v) => v.toFixed(2))]);
    });
    expect(new Set(glyphs).size).toBe(6);
  });
});
