import { describe, expect, it, vi } from 'vitest';
import { enterEditMode, exitEditMode, commitEditAsOp } from './scratch';
import { PathBuilder } from 'features/paths/builder';
import type { PenScratch } from '../usePenTool';

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

describe('commitEditAsOp', () => {
  it('returns null when scratch is not dirty', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    expect(commitEditAsOp(scratch)).toBeNull();
  });

  it('emits a SetPathOp with the current anchor geometry when dirty', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    scratch.edit!.anchors[0][0] = { x: 5, y: 5 };
    scratch.edit!.dirty = true;
    const op = commitEditAsOp(scratch);
    expect(op).not.toBeNull();
    const setPath = vi.fn();
    op!.apply({ setPath });
    expect(setPath).toHaveBeenCalledWith('a', expect.objectContaining({
      params: undefined,
      closed: false,
    }));
  });

  it('on a parametric trapdoor, op replaces path and clears params', () => {
    const scratch = freshScratch();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    enterEditMode(scratch, { objId: 'a', path, closed: true, params: { sides: 4 } as never, isParametric: true });
    scratch.edit!.anchors[0][0] = { x: 1, y: 1 };
    scratch.edit!.dirty = true;
    const op = commitEditAsOp(scratch);
    const setPath = vi.fn();
    op!.apply({ setPath });
    const call = setPath.mock.calls[0]?.[1] as { params: unknown; path: { kind: string } };
    expect(call.params).toBeUndefined();
    expect(call.path.kind).toBe('polygon');
  });
});

describe('commitEditAsOp: undo correctness', () => {
  it('op.invert() restores the entry-time path/closed', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    scratch.edit!.anchors[0][1] = { x: 100, y: 0 };
    scratch.edit!.dirty = true;
    const op = commitEditAsOp(scratch)!;
    const setPath = vi.fn();
    op.apply({ setPath });
    op.invert().apply({ setPath });
    const restored = setPath.mock.calls[1]?.[1] as { path: { commands: ArrayLike<number>; coords: ArrayLike<number> } };
    // PATH_M=0, PATH_L=1
    expect(Array.from(restored.path.commands)).toEqual([0, 1]);
    expect(Array.from(restored.path.coords)).toEqual([0, 0, 10, 0]);
  });
});
