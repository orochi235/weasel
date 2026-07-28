import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { pathToAnchors, anchorsToPath } from './anchors';
import { enumerateAnchors } from 'interactions/actions/edit-anchors/geometry';
import {
  anchorAt,
  anchorCount,
  anchorsInRect,
  deleteAnchorsAt,
  editAnchorSet,
  flatAnchorIndex,
  insertAnchorOnSegment,
  locateAnchor,
  moveHandleTo,
  openSubpathAt,
  translateAnchorBy,
  type AnchorSet,
} from './anchorEdits';

/** Closed triangle, straight segments. */
function triangle() {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(10, 0);
  b.lineTo(10, 10);
  b.close();
  return b.build();
}

/** Open two-segment curve with real handles on the middle anchor. */
function curve() {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.curveTo(2, -4, 8, -4, 10, 0);
  b.curveTo(12, 4, 18, 4, 20, 0);
  return b.build();
}

/** Two subpaths: a closed triangle followed by an open segment pair. */
function compound() {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(10, 0);
  b.lineTo(10, 10);
  b.close();
  b.moveTo(50, 50);
  b.lineTo(60, 50);
  b.lineTo(60, 60);
  return b.build();
}

const decode = (p: ReturnType<typeof triangle>): AnchorSet => pathToAnchors(p) as AnchorSet;

describe('flat-index invariant', () => {
  // The whole addressing scheme rests on this: the dispatcher hands out
  // `anchor:N` from enumerateAnchors, and anchorEdits resolves N against
  // pathToAnchors. If the two walkers ever disagree, every ported action
  // edits the wrong anchor.
  for (const [name, make] of [
    ['triangle', triangle],
    ['curve', curve],
    ['compound', compound],
  ] as const) {
    it(`enumerateAnchors order matches pathToAnchors concatenation (${name})`, () => {
      const path = make();
      const flat = enumerateAnchors(path);
      const set = decode(path);
      expect(anchorCount(set)).toBe(flat.length);
      flat.forEach((a, i) => {
        const found = anchorAt(set, i);
        expect(found, `anchor ${i}`).not.toBeNull();
        expect(found!.x).toBeCloseTo(a.x, 6);
        expect(found!.y).toBeCloseTo(a.y, 6);
      });
    });
  }

  it('round-trips flat index through locateAnchor / flatAnchorIndex', () => {
    const set = decode(compound());
    for (let i = 0; i < anchorCount(set); i++) {
      const loc = locateAnchor(set, i);
      expect(loc).not.toBeNull();
      expect(flatAnchorIndex(set, loc!.sub, loc!.idx)).toBe(i);
    }
  });

  it('reports out-of-range addresses rather than clamping', () => {
    const set = decode(triangle());
    expect(locateAnchor(set, anchorCount(set))).toBeNull();
    expect(locateAnchor(set, -1)).toBeNull();
    expect(flatAnchorIndex(set, 0, 99)).toBe(-1);
    expect(anchorAt(set, 99)).toBeNull();
  });
});

describe('translateAnchorBy', () => {
  it('moves the anchor and both handles together', () => {
    const set = decode(curve());
    const before = anchorAt(set, 1)!;
    const inBefore = { ...before.inHandle! };
    const outBefore = { ...before.outHandle! };
    expect(translateAnchorBy(set, 1, 3, -2)).toBe(true);
    const after = anchorAt(set, 1)!;
    expect(after.x).toBeCloseTo(13);
    expect(after.y).toBeCloseTo(-2);
    expect(after.inHandle!.x).toBeCloseTo(inBefore.x + 3);
    expect(after.inHandle!.y).toBeCloseTo(inBefore.y - 2);
    expect(after.outHandle!.x).toBeCloseTo(outBefore.x + 3);
    expect(after.outHandle!.y).toBeCloseTo(outBefore.y - 2);
  });

  it('returns false for an unknown anchor', () => {
    expect(translateAnchorBy(decode(triangle()), 99, 1, 1)).toBe(false);
  });
});

describe('moveHandleTo', () => {
  it('mirrors the opposite handle on a smooth anchor', () => {
    const set = decode(curve());
    const a = anchorAt(set, 1)!;
    expect(moveHandleTo(set, 1, 'out', a.x + 4, a.y + 4, false)).toBe(true);
    const after = anchorAt(set, 1)!;
    expect(after.outHandle!.x).toBeCloseTo(a.x + 4);
    expect(after.inHandle!.x).toBeCloseTo(a.x - 4);
    expect(after.inHandle!.y).toBeCloseTo(a.y - 4);
  });

  it('leaves the opposite handle alone when breaking smoothness', () => {
    const set = decode(curve());
    const a = anchorAt(set, 1)!;
    const inBefore = { ...a.inHandle! };
    moveHandleTo(set, 1, 'out', a.x + 4, a.y + 4, true);
    const after = anchorAt(set, 1)!;
    expect(after.inHandle!.x).toBeCloseTo(inBefore.x);
    expect(after.inHandle!.y).toBeCloseTo(inBefore.y);
  });
});

describe('insertAnchorOnSegment', () => {
  it('inserts at the split point and returns its flat index', () => {
    const set = decode(triangle());
    const flat = insertAnchorOnSegment(set, { sub: 0, segIdx: 0, t: 0.5 });
    expect(flat).toBe(1);
    expect(anchorCount(set)).toBe(4);
    const inserted = anchorAt(set, 1)!;
    expect(inserted.x).toBeCloseTo(5);
    expect(inserted.y).toBeCloseTo(0);
  });

  it('accounts for earlier subpaths in the returned flat index', () => {
    const set = decode(compound());
    const firstSubLen = set.anchors[0].length;
    const flat = insertAnchorOnSegment(set, { sub: 1, segIdx: 0, t: 0.5 });
    expect(flat).toBe(firstSubLen + 1);
  });

  it('returns -1 for a segment that does not exist', () => {
    expect(insertAnchorOnSegment(decode(triangle()), { sub: 0, segIdx: 9, t: 0.5 })).toBe(-1);
    expect(insertAnchorOnSegment(decode(triangle()), { sub: 7, segIdx: 0, t: 0.5 })).toBe(-1);
  });
});

describe('deleteAnchorsAt', () => {
  it('deletes several anchors in one pass without index drift', () => {
    const set = decode(compound());
    const total = anchorCount(set);
    // One from each subpath, given in ascending order — the implementation
    // has to sort descending per subpath or the second splice misses.
    expect(deleteAnchorsAt(set, [0, total - 1])).toBe(true);
    expect(anchorCount(set)).toBe(total - 2);
  });

  it('drops a subpath that falls below two anchors', () => {
    const set = decode(compound());
    const firstLen = set.anchors[0].length;
    deleteAnchorsAt(set, Array.from({ length: firstLen - 1 }, (_, i) => i));
    expect(set.anchors).toHaveLength(1);
    expect(set.closed).toHaveLength(1);
    // The survivor is the second subpath, unshifted.
    expect(anchorAt(set, 0)!.x).toBeCloseTo(50);
  });

  it('returns false when nothing addressable was passed', () => {
    expect(deleteAnchorsAt(decode(triangle()), [99])).toBe(false);
    expect(deleteAnchorsAt(decode(triangle()), [])).toBe(false);
  });

  it('refuses a deletion that would leave no subpath at all', () => {
    // 3-anchor triangle, delete 2 → the survivor can't form a segment.
    // Committing that would leave an invisible node with an empty path.
    const set = decode(triangle());
    expect(deleteAnchorsAt(set, [0, 1])).toBe(false);
    expect(anchorCount(set)).toBe(3);
    expect(set.anchors).toHaveLength(1);
  });

  it('still allows emptying one subpath while another survives', () => {
    const set = decode(compound());
    const firstLen = set.anchors[0].length;
    expect(deleteAnchorsAt(set, Array.from({ length: firstLen - 1 }, (_, i) => i))).toBe(true);
    expect(set.anchors).toHaveLength(1);
  });
});

describe('openSubpathAt', () => {
  it('rotates a closed subpath so the cut anchor becomes the endpoint', () => {
    const set = decode(triangle());
    expect(set.closed[0]).toBe(true);
    expect(openSubpathAt(set, 1)).toBe(true);
    expect(set.closed[0]).toBe(false);
    expect(anchorAt(set, 0)!.x).toBeCloseTo(10);
    expect(anchorAt(set, 0)!.y).toBeCloseTo(0);
  });

  it('no-ops on an already-open subpath', () => {
    const set = decode(curve());
    expect(openSubpathAt(set, 1)).toBe(false);
  });

  it('cuts the addressed subpath, not the first one', () => {
    const set = decode(compound());
    const secondStart = set.anchors[0].length;
    // Second subpath is already open — cutting it is a no-op, and the
    // closed first subpath must be left alone.
    expect(openSubpathAt(set, secondStart)).toBe(false);
    expect(set.closed[0]).toBe(true);
  });
});

describe('anchorsInRect', () => {
  it('returns flat indices spanning subpaths', () => {
    const set = decode(compound());
    const all = anchorsInRect(set, { x: -1, y: -1, width: 100, height: 100 });
    expect(all).toEqual(Array.from({ length: anchorCount(set) }, (_, i) => i));
  });

  it('excludes anchors outside the rect', () => {
    const set = decode(compound());
    const hits = anchorsInRect(set, { x: -1, y: -1, width: 20, height: 20 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((i) => anchorAt(set, i)!.x <= 19)).toBe(true);
  });
});

describe('editAnchorSet', () => {
  it('decodes, applies, and re-encodes', () => {
    const path = triangle();
    const next = editAnchorSet(path, (set) => {
      translateAnchorBy(set, 0, 5, 5);
    });
    expect(next).not.toBeNull();
    const reread = pathToAnchors(next!);
    expect(reread.anchors[0][0].x).toBeCloseTo(5);
    expect(reread.closed[0]).toBe(true);
  });

  it('returns null when the edit reports no change', () => {
    expect(editAnchorSet(triangle(), () => false)).toBeNull();
  });

  it('preserves an unedited path through a decode/encode round trip', () => {
    const path = triangle();
    const rt = anchorsToPath(pathToAnchors(path).anchors, pathToAnchors(path).closed);
    expect(Array.from(rt.commands)).toEqual(Array.from(path.commands));
    expect(Array.from(rt.coords)).toEqual(Array.from(path.coords));
  });
});
