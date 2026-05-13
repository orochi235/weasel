// src/tools/builtin/penEdit/actions.test.ts
import { describe, expect, it } from 'vitest';
import { dragAnchor, dragHandle, selectAnchor, addAnchorOnSegment, deleteAnchors, scissorsAtAnchor, marqueeSelect, nudgeSelectedAnchors } from './actions';
import type { PenScratch } from '../useUserPenTool';

function editingScratch(anchors: { x: number; y: number; inHandle?: { x: number; y: number }; outHandle?: { x: number; y: number } }[][]): PenScratch {
  return {
    mode: 'edit',
    finishedSubpaths: [], current: null, cursor: null,
    draggingHandleAt: null, closeHintActive: false,
    _pendingDown: null, _lastClick: null,
    edit: {
      objId: 'a',
      anchors,
      closed: anchors.map(() => false),
      selectedAnchors: new Set(),
      activeHandle: null,
      dirty: false,
      preConvert: null,
    },
  };
}

describe('dragAnchor', () => {
  it('moves the targeted anchor and translates its handles by the same delta', () => {
    const scratch = editingScratch([[
      { x: 10, y: 10, inHandle: { x: 5, y: 10 }, outHandle: { x: 15, y: 10 } },
    ]]);
    dragAnchor(scratch, { sub: 0, idx: 0, dx: 20, dy: 5 });
    expect(scratch.edit!.anchors[0][0]).toEqual({
      x: 30, y: 15,
      inHandle: { x: 25, y: 15 },
      outHandle: { x: 35, y: 15 },
    });
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    dragAnchor(scratch, { sub: 0, idx: 0, dx: 1, dy: 0 });
    expect(scratch.edit!.dirty).toBe(true);
  });
});

describe('dragHandle', () => {
  it('moves only the targeted handle in corner mode (alt or non-smooth)', () => {
    const scratch = editingScratch([[
      { x: 50, y: 50, inHandle: { x: 40, y: 50 }, outHandle: { x: 60, y: 50 } },
    ]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 70, toY: 55, breakSmoothness: true });
    const a = scratch.edit!.anchors[0][0];
    expect(a.outHandle).toEqual({ x: 70, y: 55 });
    expect(a.inHandle).toEqual({ x: 40, y: 50 });
  });

  it('mirrors the opposite handle in smooth mode', () => {
    const scratch = editingScratch([[
      { x: 50, y: 50, inHandle: { x: 40, y: 50 }, outHandle: { x: 60, y: 50 } },
    ]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 70, toY: 60, breakSmoothness: false });
    const a = scratch.edit!.anchors[0][0];
    expect(a.outHandle).toEqual({ x: 70, y: 60 });
    expect(a.inHandle).toEqual({ x: 2*50 - 70, y: 2*50 - 60 });
  });

  it('does not mirror when the opposite handle does not exist', () => {
    const scratch = editingScratch([[
      { x: 50, y: 50, outHandle: { x: 60, y: 50 } },
    ]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 70, toY: 60, breakSmoothness: false });
    expect(scratch.edit!.anchors[0][0].inHandle).toBeUndefined();
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 20, toY: 0, breakSmoothness: false });
    expect(scratch.edit!.dirty).toBe(true);
  });
});

describe('selectAnchor', () => {
  it('replaces selection by default', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    selectAnchor(scratch, { sub: 0, idx: 1, additive: false });
    expect([...scratch.edit!.selectedAnchors]).toEqual(['0:1']);
  });

  it('adds to selection when additive=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    selectAnchor(scratch, { sub: 0, idx: 1, additive: true });
    expect([...scratch.edit!.selectedAnchors].sort()).toEqual(['0:0', '0:1']);
  });

  it('removes from selection when additive=true and already selected', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    selectAnchor(scratch, { sub: 0, idx: 0, additive: true });
    expect([...scratch.edit!.selectedAnchors]).toEqual([]);
  });

  it('does not set dirty (selection is not a mutation of geometry)', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    selectAnchor(scratch, { sub: 0, idx: 0, additive: false });
    expect(scratch.edit!.dirty).toBe(false);
  });
});

describe('addAnchorOnSegment', () => {
  it('inserts a new anchor between two existing anchors on a straight segment', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    addAnchorOnSegment(scratch, { sub: 0, segIdx: 0, t: 0.5 });
    const sub = scratch.edit!.anchors[0];
    expect(sub).toHaveLength(3);
    expect(sub[1]).toEqual(expect.objectContaining({ x: 50, y: 0 }));
  });

  it('splits a cubic segment via De Casteljau and sets handles on the new anchor + neighbors', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, outHandle: { x: 33, y: 100 } },
      { x: 100, y: 0, inHandle: { x: 66, y: 100 } },
    ]]);
    addAnchorOnSegment(scratch, { sub: 0, segIdx: 0, t: 0.5 });
    const sub = scratch.edit!.anchors[0];
    expect(sub).toHaveLength(3);
    expect(sub[1].x).toBeCloseTo(49.625, 5);
    expect(sub[1].y).toBeCloseTo(75, 5);
    expect(sub[1].inHandle).toBeDefined();
    expect(sub[1].outHandle).toBeDefined();
    expect(sub[0].outHandle).not.toEqual({ x: 33, y: 100 });
    expect(sub[2].inHandle).not.toEqual({ x: 66, y: 100 });
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    addAnchorOnSegment(scratch, { sub: 0, segIdx: 0, t: 0.5 });
    expect(scratch.edit!.dirty).toBe(true);
  });
});

describe('deleteAnchors', () => {
  it('removes interior anchor and fits a new cubic through the surviving anchors', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, outHandle: { x: 10, y: 0 } },
      { x: 50, y: 50 },
      { x: 100, y: 0, inHandle: { x: 90, y: 0 } },
    ]]);
    deleteAnchors(scratch, ['0:1']);
    const sub = scratch.edit!.anchors[0];
    expect(sub).toHaveLength(2);
    expect(sub[0].x).toBe(0);
    expect(sub[1].x).toBe(100);
    expect(sub[0].outHandle).toBeDefined();
    expect(sub[1].inHandle).toBeDefined();
  });

  it('removes endpoint anchor and drops the adjacent segment', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]]);
    deleteAnchors(scratch, ['0:2']);
    expect(scratch.edit!.anchors[0]).toHaveLength(2);
  });

  it('clears the deleted anchor from selection', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    deleteAnchors(scratch, ['0:0']);
    expect(scratch.edit!.selectedAnchors.has('0:0')).toBe(false);
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]]);
    deleteAnchors(scratch, ['0:1']);
    expect(scratch.edit!.dirty).toBe(true);
  });
});

describe('scissorsAtAnchor', () => {
  it('opens a closed subpath at the clicked anchor (closed → false)', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]]);
    scratch.edit!.closed = [true];
    scissorsAtAnchor(scratch, { sub: 0, idx: 1 });
    expect(scratch.edit!.closed).toEqual([false]);
  });

  it('rotates anchors so the cut point sits at the start of the array', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]]);
    scratch.edit!.closed = [true];
    scissorsAtAnchor(scratch, { sub: 0, idx: 2 });
    expect(scratch.edit!.anchors[0].map(a => a.x)).toEqual([10, 0, 0, 10]);
  });

  it('is a no-op on an already-open subpath', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.closed = [false];
    scissorsAtAnchor(scratch, { sub: 0, idx: 0 });
    expect(scratch.edit!.closed).toEqual([false]);
    expect(scratch.edit!.dirty).toBe(false);
  });

  it('sets dirty=true on actual open', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.closed = [true];
    scissorsAtAnchor(scratch, { sub: 0, idx: 0 });
    expect(scratch.edit!.dirty).toBe(true);
  });
});

describe('marqueeSelect', () => {
  it('selects anchors whose points fall inside the world-space rect', () => {
    const scratch = editingScratch([[
      { x: 5, y: 5 },
      { x: 15, y: 15 },
      { x: 0, y: 0 },
    ]]);
    marqueeSelect(scratch, { x: 0, y: 0, width: 10, height: 10, additive: false });
    expect([...scratch.edit!.selectedAnchors].sort()).toEqual(['0:0', '0:2']);
  });

  it('replaces existing selection by default', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:1');
    marqueeSelect(scratch, { x: -5, y: -5, width: 10, height: 10, additive: false });
    expect([...scratch.edit!.selectedAnchors]).toEqual(['0:0']);
  });

  it('adds to selection when additive=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:1');
    marqueeSelect(scratch, { x: -5, y: -5, width: 10, height: 10, additive: true });
    expect([...scratch.edit!.selectedAnchors].sort()).toEqual(['0:0', '0:1']);
  });
});

describe('nudgeSelectedAnchors', () => {
  it('translates selected anchors by (dx, dy)', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 },
    ]]);
    scratch.edit!.selectedAnchors.add('0:0');
    scratch.edit!.selectedAnchors.add('0:2');
    nudgeSelectedAnchors(scratch, { dx: 1, dy: 0 });
    expect(scratch.edit!.anchors[0][0].x).toBe(1);
    expect(scratch.edit!.anchors[0][1].x).toBe(10);
    expect(scratch.edit!.anchors[0][2].x).toBe(21);
  });

  it('translates handles along with their anchor', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, inHandle: { x: -5, y: 0 }, outHandle: { x: 5, y: 0 } },
    ]]);
    scratch.edit!.selectedAnchors.add('0:0');
    nudgeSelectedAnchors(scratch, { dx: 3, dy: 4 });
    const a = scratch.edit!.anchors[0][0];
    expect(a).toEqual({
      x: 3, y: 4,
      inHandle: { x: -2, y: 4 },
      outHandle: { x: 8, y: 4 },
    });
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    nudgeSelectedAnchors(scratch, { dx: 1, dy: 0 });
    expect(scratch.edit!.dirty).toBe(true);
  });

  it('is a no-op when no anchors are selected', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    nudgeSelectedAnchors(scratch, { dx: 1, dy: 0 });
    expect(scratch.edit!.anchors[0][0].x).toBe(0);
    expect(scratch.edit!.dirty).toBe(false);
  });
});
