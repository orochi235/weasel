import { describe, expect, it } from 'vitest';
import { penEditHitOverride } from './hitOverride';
import type { PenScratch } from '../usePenTool';

const view = { x: 0, y: 0, scale: { x: 1, y: 1 } } as const;

function editingScratch(anchors: { x: number; y: number; outHandle?: { x: number; y: number }; inHandle?: { x: number; y: number } }[][]): PenScratch {
  return {
    mode: 'edit',
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
    _pendingDown: null,
    _lastClick: null,
    edit: {
      objId: 'a',
      anchors,
      closed: anchors.map(() => false),
      selectedAnchors: new Set(),
      activeHandle: null,
      dirty: false,
      preConvert: null,
      original: { path: null as never, closed: false },
      marquee: null,
    },
  };
}

describe('penEditHitOverride', () => {
  it('returns null when not in edit mode', () => {
    const scratch: PenScratch = {
      mode: 'create', finishedSubpaths: [], current: null, cursor: null,
      draggingHandleAt: null, closeHintActive: false, _pendingDown: null,
      _lastClick: null, edit: null,
    };
    const r = penEditHitOverride({
      worldX: 0, worldY: 0, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });

  it('returns anchor hit when pointer is within hit radius of an anchor', () => {
    const scratch = editingScratch([[{ x: 50, y: 50 }]]);
    const r = penEditHitOverride({
      worldX: 52, worldY: 51, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'anchor', extra: { sub: 0, idx: 0 } });
  });

  it('returns null when pointer is far from any anchor', () => {
    const scratch = editingScratch([[{ x: 50, y: 50 }]]);
    const r = penEditHitOverride({
      worldX: 500, worldY: 500, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });

  it('prefers anchor over handle when both are in range', () => {
    const scratch = editingScratch([[{ x: 50, y: 50, outHandle: { x: 52, y: 52 } }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    const r = penEditHitOverride({
      worldX: 51, worldY: 51, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'anchor', extra: { sub: 0, idx: 0 } });
  });

  it('returns handle hit when pointer is near a handle of a selected anchor', () => {
    const scratch = editingScratch([[{ x: 50, y: 50, outHandle: { x: 80, y: 50 } }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    const r = penEditHitOverride({
      worldX: 79, worldY: 50, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'handle', extra: { sub: 0, idx: 0, side: 'out' } });
  });

  it('does not hit unselected anchors handles', () => {
    const scratch = editingScratch([[{ x: 50, y: 50, outHandle: { x: 80, y: 50 } }]]);
    const r = penEditHitOverride({
      worldX: 79, worldY: 50, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });
});

describe('penEditHitOverride: segments', () => {
  it('returns segment hit when pointer is near a straight segment', () => {
    // Two anchors, no handles → straight line.
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    const r = penEditHitOverride({
      worldX: 50, worldY: 1, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'segment', extra: { sub: 0, segIdx: 0, t: expect.any(Number) } });
  });

  it('returns segment hit when pointer is near a cubic segment', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, outHandle: { x: 33, y: 100 } },
      { x: 100, y: 0, inHandle: { x: 66, y: 100 } },
    ]]);
    // Midpoint of this curve is at (50, 75). Pointer just above midpoint.
    const r = penEditHitOverride({
      worldX: 50, worldY: 73, scratch, view, modifiers: {} as never,
    });
    expect(r?.target).toBe('segment');
  });

  it('does not hit when pointer is far from the segment', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    const r = penEditHitOverride({
      worldX: 50, worldY: 50, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });
});
