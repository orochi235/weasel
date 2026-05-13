import { describe, expect, it } from 'vitest';
import { enterEditMode, exitEditMode } from './scratch';
import { PathBuilder } from 'features/paths/builder';
import type { PenScratch } from '../useUserPenTool';

function freshScratch(): PenScratch {
  return {
    mode: 'create',
    finishedSubpaths: [], current: null, cursor: null,
    draggingHandleAt: null, closeHintActive: false,
    _pendingDown: null, _lastClick: null, edit: null,
  };
}

describe('enterEditMode', () => {
  it('flips mode to edit and derives anchors from the obj path', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    enterEditMode(scratch, {
      objId: 'a',
      path,
      closed: false,
      params: undefined,
      isParametric: false,
    });
    expect(scratch.mode).toBe('edit');
    expect(scratch.edit?.objId).toBe('a');
    expect(scratch.edit?.anchors).toEqual([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 },
    ]]);
    expect(scratch.edit?.preConvert).toBeNull(); // not parametric
  });

  it('snapshots preConvert when obj is parametric', () => {
    const scratch = freshScratch();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    enterEditMode(scratch, {
      objId: 'a',
      path,
      closed: true,
      params: { sides: 4 } as never,
      isParametric: true,
    });
    expect(scratch.edit?.preConvert).toEqual({
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      closed: true,
      params: { sides: 4 },
    });
  });

  it('starts dirty=false and with empty selection', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    expect(scratch.edit?.dirty).toBe(false);
    expect(scratch.edit?.selectedAnchors.size).toBe(0);
  });
});

describe('exitEditMode', () => {
  it('clears edit branch and flips mode back to create', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    exitEditMode(scratch);
    expect(scratch.mode).toBe('create');
    expect(scratch.edit).toBeNull();
  });
});
