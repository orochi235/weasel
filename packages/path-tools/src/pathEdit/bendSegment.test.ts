import { describe, expect, it } from 'vitest';
import { PathBuilder, anchorSymmetry, cubicPointAt, pathToAnchors, type Affine, type AnchorSet, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { createEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import type { EditAnchorsDep } from '@weasel-js/core';
import { bendSegmentAction } from './bendSegment';
import { createKitSettingsStore } from '@weasel-js/react';

/** Open straight line from (0, 0) to (100, 0). */
function line(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(100, 0);
  return b.build();
}

function setup(finishEdit?: EditAnchorsDep['finishEdit'], start: PolygonPath = line(), transforms?: readonly Affine[]) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = start;
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    ...(finishEdit ? { finishEdit } : {}),
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  const view = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };
  const pathSymmetry = transforms ? { transforms: () => transforms } : undefined;
  return { deps: { editAnchors: dep, view, pathSymmetry } as unknown as InvocationCtx['deps'], commits };
}

const at = (deps: InvocationCtx['deps'], x: number, y: number): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps,
});

const ongoing = bendSegmentAction.invoker as OngoingInvoker;

describe('bendSegmentAction', () => {
  it('bends the mirror image of the segment under a pathSymmetry dep', () => {
    const across50: Affine = [-1, 0, 0, 1, 100, 0];
    const kite = new PathBuilder().moveTo(50, 0).lineTo(80, 40).lineTo(50, 100).lineTo(20, 40).close().build();
    const { deps, commits } = setup(undefined, kite, [across50]);
    const handle = ongoing.start(at(deps, 65, 20), {});
    handle.onMove!(at(deps, 75, 10));
    handle.onEnd!(at(deps, 75, 10), 'commit');
    expect(commits).toHaveLength(1);
    expect(anchorSymmetry(pathToAnchors(commits[0].path) as AnchorSet, across50, 1e-3)).not.toBeNull();
  });

  it('commits nothing when the drag ends back on its press point', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 50, 2), {});
    handle.onMove!(at(deps, 50, 32));
    handle.onMove!(at(deps, 50, 2));
    handle.onEnd!(at(deps, 50, 2), 'commit');
    expect(commits).toHaveLength(0);
  });

  it('bends the segment so the pressed point follows the pointer, in one commit', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 50, 2), {});
    handle.onMove!(at(deps, 50, 32));
    expect(commits).toHaveLength(0);
    handle.onEnd!(at(deps, 50, 32), 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Bend segment');
    const [a, b] = pathToAnchors(commits[0].path).anchors[0];
    const mid = cubicPointAt(a, a.outHandle!, b.inHandle!, b, 0.5);
    expect(mid.x).toBeCloseTo(50, 3);
    expect(mid.y).toBeCloseTo(30, 3);
  });

  it('previews the bent path while dragging and commits nothing on cancel', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 50, 0), {});
    expect(handle.previewIds!()).toBeNull();
    handle.onMove!(at(deps, 50, 20));
    expect([...handle.previewIds!()!]).toEqual(['p1']);
    handle.onEnd!(at(deps, 50, 20), 'cancel');
    expect(commits).toHaveLength(0);
    expect(handle.previewIds!()).toBeNull();
  });

  it('keeps the last frame an extension could finish, and commits that', () => {
    // Refuses any bend that takes the segment's midpoint past y = 25.
    const { deps, commits } = setup((_id, p) => {
      const [a, b] = pathToAnchors(p as PolygonPath).anchors[0];
      const mid = a.outHandle && b.inHandle ? cubicPointAt(a, a.outHandle, b.inHandle, b, 0.5) : { y: 0 };
      return mid.y > 25 ? null : { path: p, others: [] };
    });
    const handle = ongoing.start(at(deps, 50, 0), {});
    handle.onMove!(at(deps, 50, 20));
    handle.onMove!(at(deps, 50, 40));
    handle.onEnd!(at(deps, 50, 40), 'commit');
    expect(commits).toHaveLength(1);
    const [a, b] = pathToAnchors(commits[0].path).anchors[0];
    expect(cubicPointAt(a, a.outHandle!, b.inHandle!, b, 0.5).y).toBeCloseTo(20, 3);
  });

  it('reaches a segment as far as targets.segmentHitPx', () => {
    const { deps } = setup();
    expect(bendSegmentAction.enabled!(deps, { x: 50, y: 12 })).toBe(ActionDisabledReason.NotApplicable);
    const kitSettings = createKitSettingsStore({ targets: { segmentHitPx: 16 } });
    expect(bendSegmentAction.enabled!({ ...deps, kitSettings }, { x: 50, y: 12 })).toBe(true);
  });

  it('claims a press on a segment and leaves the rest to other drags', () => {
    const { deps } = setup();
    expect(bendSegmentAction.enabled!(deps, { x: 50, y: 3 })).toBe(true);
    expect(bendSegmentAction.enabled!(deps, { x: 50, y: 40 })).toBe(ActionDisabledReason.NotApplicable);
    // An anchor is the anchor drag's, not a segment's.
    expect(bendSegmentAction.enabled!(deps, { x: 0, y: 0 })).toBe(ActionDisabledReason.NotApplicable);
    expect(ongoing.start(at(deps, 50, 40), {})).toEqual({});
  });
});
