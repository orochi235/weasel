/**
 * A fillet widget is pressed where the overlay paints it, from the one
 * placement `filletWidgetAt` answers.
 */
import { describe, expect, it } from 'vitest';
import {
  boundsOfPath, CORNER_KEYWORDS, pathToAnchors, polygonFromPoints, withCorner, type AnchorSet, type PolygonPath,
} from '@weasel-js/geom';
import {
  filletWidgetAt, filletWidgetCommands, filletWidgetFrames, createFilletWidgetsExtension, PATH_FILLETS_CHROME_ID,
} from './filletWidgets';

const extension = createFilletWidgetsExtension();

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

const VIEW = { x: -10, y: -10, scale: { x: 2, y: 2 } };

describe('fillet widgets', () => {
  it('offers one widget per corner anchor, and none on a flat one', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]);
    expect(filletWidgetFrames(square()).map((f) => f.index)).toEqual([0, 1, 2, 3]);
    expect(filletWidgetFrames(p).map((f) => f.index)).toEqual([0, 2, 3]);
  });

  it('sits inside the corner, 14px from the middle of its cut', () => {
    const f = filletWidgetFrames(square())[1];
    const at = filletWidgetAt(f, VIEW.scale);
    // At 2x, 14px is 7 world units down the bisector from (100, 0).
    expect(at.x).toBeCloseTo(100 - 7 * Math.SQRT1_2, 6);
    expect(at.y).toBeCloseTo(7 * Math.SQRT1_2, 6);
  });

  it('follows the cut as the radius grows', () => {
    const f = filletWidgetFrames(withCorner(square(), 1, { shape: 'bevel', radius: 20 }))[1];
    const at = filletWidgetAt(f, VIEW.scale);
    // The bevel's middle is (90, 10); the widget sits 7 further in.
    expect(at.x).toBeCloseTo(90 - 7 * Math.SQRT1_2, 6);
    expect(at.y).toBeCloseTo(10 + 7 * Math.SQRT1_2, 6);
  });

  it('is pressed as `fillet:N` from the middle of its cut, pushed in along the bisector, where it is painted', () => {
    const path = withCorner(square(), 2, { shape: 'bevel', radius: 20 });
    const anchors = pathToAnchors(path) as AnchorSet;
    const frame = filletWidgetFrames(path)[2];
    const part = extension.parts!({ id: 'sq', node: { pose: path, data: {} }, path, anchors })[2];
    expect(part).toMatchObject({ x: 90, y: 90, hitKind: 'fillet:2', standoff: { px: 14, normal: frame.bisector } });

    const at = filletWidgetAt(frame, VIEW.scale);
    const third = filletWidgetCommands(path, VIEW)[2];
    if (third.kind !== 'path') throw new Error('expected a path');
    const b = boundsOfPath(third.path);
    expect(b.x + b.width / 2).toBeCloseTo((at.x - VIEW.x) * VIEW.scale.x, 3);
    expect(b.y + b.height / 2).toBeCloseTo((at.y - VIEW.y) * VIEW.scale.y, 3);
  });

  it('draws each corner-shape keyword as a glyph of its own', () => {
    const glyphs = CORNER_KEYWORDS.map((shape) => {
      const [cmd] = filletWidgetCommands(withCorner(square(), 0, { shape, radius: 10 }), VIEW);
      if (cmd.kind !== 'path' || cmd.path.kind !== 'polygon') throw new Error('expected a polygon');
      return JSON.stringify([...cmd.path.commands, ...Array.from(cmd.path.coords, (v) => v.toFixed(2))]);
    });
    expect(new Set(glyphs).size).toBe(6);
  });

  it('draws and presses nothing while chrome-caps hides them', () => {
    const path = square();
    const anchors = pathToAnchors(path) as AnchorSet;
    const toScreen = (p: { x: number; y: number }) => p;
    const marks = (shown: boolean) => extension.marks!({
      id: 'sq', node: { pose: path, data: {} }, path, anchors, view: VIEW, toScreen, selected: null,
      isVisible: (id) => shown || id !== PATH_FILLETS_CHROME_ID,
    });
    expect(marks(true)).toHaveLength(4);
    expect(marks(false)).toHaveLength(0);
    expect(extension.parts!({ id: 'sq', node: { pose: path, data: {} }, path, anchors })
      .every((p) => p.chromeId === PATH_FILLETS_CHROME_ID)).toBe(true);
  });
});
