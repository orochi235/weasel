import { describe, expect, it } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { lengthenPathAction } from './lengthenPath';

/** Open path (0, 0) → (100, 0) → (100, 50): anchors 0, 1, 2. */
function elbow(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(100, 0);
  b.lineTo(100, 50);
  return b.build();
}

/** Open path ending in a curve heading +y at (100, 100). */
function curl(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.curveTo(55, 0, 100, 45, 100, 100);
  return b.build();
}

function setup(path: PolygonPath = elbow(), editingId = 'p1') {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = path;
  const dep = makeEditAnchorsDep({
    editingId,
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  const view = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };
  return { dep, deps: { editAnchors: dep, view } as unknown as InvocationCtx['deps'], commits };
}

const at = (
  deps: InvocationCtx['deps'],
  x: number,
  y: number,
  anchor: number,
  shift = false,
): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift },
  deps,
  drag: {
    start: { x, y },
    current: { x, y },
    delta: { x: 0, y: 0 },
    affordance: { kind: `anchor:${anchor}` },
  } as unknown as InvocationCtx['drag'],
});

const ongoing = lengthenPathAction.invoker as OngoingInvoker;

describe('lengthenPathAction', () => {
  it('drags the last anchor out along its segment, in one commit', () => {
    const { deps, commits, dep } = setup();
    const handle = ongoing.start(at(deps, 100, 50, 2), {});
    handle.onMove!(at(deps, 107, 70, 2));
    handle.onMove!(at(deps, 103, 80, 2));
    expect(commits).toHaveLength(0);
    handle.onEnd!(at(deps, 103, 80, 2), 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Lengthen path');
    // Straight on: the pointer's sideways drift does not bend the segment.
    expect(pathToAnchors(commits[0].path).anchors[0]).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 },
    ]);
    expect([...dep.selectedAnchors]).toEqual([2]);
  });

  it('trims when dragged back into the path', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 0, 0, 0), {});
    handle.onMove!(at(deps, 30, 2, 0));
    handle.onEnd!(at(deps, 30, 2, 0), 'commit');
    expect(commits[0].label).toBe('Shorten path');
    expect(pathToAnchors(commits[0].path).anchors[0][0]).toEqual({ x: 30, y: 0 });
  });

  it('follows the end curvature while Shift is held, read live', () => {
    const { deps, commits } = setup(curl());
    const handle = ongoing.start(at(deps, 100, 100, 1), {});
    handle.onMove!(at(deps, 100, 140, 1));
    const straight = pathToAnchors(handle.previewPose!('p1') as PolygonPath).anchors[0];
    expect(straight.at(-1)!.x).toBeCloseTo(100, 3);
    handle.onMove!(at(deps, 100, 140, 1, true));
    handle.onEnd!(at(deps, 100, 140, 1, true), 'commit');
    const curved = pathToAnchors(commits[0].path).anchors[0];
    // The curl turns toward -x, so continuing it does too.
    expect(curved.at(-1)!.x).toBeLessThan(99);
    expect(curved.at(-1)!.inHandle).toBeDefined();
  });

  it('takes its unmodified mode from a `mode` param, read on every move, and Shift flips it', () => {
    const { deps } = setup(curl());
    let mode = 'curvature';
    const handle = ongoing.start(at(deps, 100, 100, 1), { params: () => ({ mode }) });
    const endX = () => pathToAnchors(handle.previewPose!('p1') as PolygonPath).anchors[0].at(-1)!.x;
    handle.onMove!(at(deps, 100, 140, 1));
    expect(endX()).toBeLessThan(99);
    handle.onMove!(at(deps, 100, 140, 1, true));
    expect(endX()).toBeCloseTo(100, 3);
    mode = 'tangent';
    handle.onMove!(at(deps, 100, 140, 1));
    expect(endX()).toBeCloseTo(100, 3);
  });

  it('commits nothing on cancel', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 100, 50, 2), {});
    handle.onMove!(at(deps, 100, 90, 2));
    expect([...handle.previewIds!()!]).toEqual(['p1']);
    handle.onEnd!(at(deps, 100, 90, 2), 'cancel');
    expect(commits).toHaveLength(0);
    expect(handle.previewIds!()).toBeNull();
  });

  it('turns down a press on an inner anchor, and is only enabled over an open end', () => {
    const { deps } = setup();
    expect(ongoing.start(at(deps, 100, 0, 1), {})).toEqual({});
    expect(lengthenPathAction.enabled!(deps, { x: 100, y: 52 })).toBe(true);
    expect(lengthenPathAction.enabled!(deps, { x: 100, y: 0 })).toBe(ActionDisabledReason.NotApplicable);
    expect(lengthenPathAction.enabled!(deps, { x: 50, y: 30 })).toBe(ActionDisabledReason.NotApplicable);
  });

  it('drags only with a path open', () => {
    const { deps } = setup(elbow(), '');
    expect(ongoing.start(at(deps, 100, 50, 2), {})).toEqual({});
    expect(lengthenPathAction.enabled!(deps, { x: 100, y: 52 })).toBe(ActionDisabledReason.NotApplicable);
  });

  it('binds nothing itself: the Lengthen tool binds it', () => {
    expect(lengthenPathAction.defaultBinding).toBeUndefined();
  });
});
