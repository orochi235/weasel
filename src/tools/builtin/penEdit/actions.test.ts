// src/tools/builtin/penEdit/actions.test.ts
import { describe, expect, it } from 'vitest';
import { dragAnchor } from './actions';
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
