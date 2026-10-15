import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { pathToAnchors } from './anchors';
import { readAnchorFields, writeAnchorField } from './anchorFields';

const path = () => new PathBuilder().moveTo(0, 0).curveTo(10, 0, 20, 10, 20, 20).lineTo(0, 20).build();

describe('readAnchorFields', () => {
  it('shows a shared value, null where the anchors differ, and no handles for several', () => {
    const set = pathToAnchors(path());
    expect(readAnchorFields(set, [1, 2])).toEqual({ x: null, y: 20 });
    expect(readAnchorFields(set, [])).toEqual({});
  });

  it("gives a lone anchor its handles' position, angle, and length", () => {
    const f = readAnchorFields(pathToAnchors(path()), [0]);
    expect(f).toMatchObject({ x: 0, y: 0, outX: 10, outY: 0, outAngle: 0, outLength: 10 });
    expect(f).not.toHaveProperty('inX');
    const g = readAnchorFields(pathToAnchors(path()), [1]);
    // The in handle at (20, 10) points straight up from (20, 20) as drawn.
    expect(g.inAngle).toBeCloseTo(90);
    expect(g.inLength).toBeCloseTo(10);
  });
});

describe('writeAnchorField', () => {
  it('sets every selected anchor to a value, carrying its handles', () => {
    const set = pathToAnchors(path());
    expect(writeAnchorField(set, [1, 2], 'x', { to: 5 })).toBe(true);
    expect(set.anchors[0].map((a) => a.x)).toEqual([0, 5, 5]);
    expect(set.anchors[0][1].inHandle).toEqual({ x: 5, y: 10 });
  });

  it('offsets each by its own amount', () => {
    const set = pathToAnchors(path());
    writeAnchorField(set, [0, 2], 'y', { by: -5 });
    expect(set.anchors[0].map((a) => a.y)).toEqual([-5, 20, 15]);
    expect(writeAnchorField(set, [0], 'y', { by: 0 })).toBe(false);
  });

  it('turns a handle about its anchor keeping its length, and stretches it keeping its angle', () => {
    const set = pathToAnchors(path());
    writeAnchorField(set, [0], 'outAngle', { to: 90 });
    expect(set.anchors[0][0].outHandle!.x).toBeCloseTo(0);
    expect(set.anchors[0][0].outHandle!.y).toBeCloseTo(-10);
    writeAnchorField(set, [0], 'outLength', { by: 5 });
    expect(set.anchors[0][0].outHandle!.y).toBeCloseTo(-15);
  });

  it('skips an anchor without the handle, and leaves the other handle alone', () => {
    const set = pathToAnchors(path());
    expect(writeAnchorField(set, [2], 'inX', { to: 3 })).toBe(false);
    writeAnchorField(set, [1], 'inX', { to: 3 });
    expect(set.anchors[0][1].inHandle).toEqual({ x: 3, y: 10 });
    expect(set.anchors[0][1].outHandle).toBeUndefined();
  });
});
