import { describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { asNodeId } from 'core/scene/types';
import { createPathSnapper } from 'features/paths/pathSnap/pathSnapper';
import type { SnapDep } from '../snapDep';
import { editAnchorsAction } from './action';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';

const square = pathFromD('M0 0 H100 V100 H0 Z') as PolygonPath;

function dragAnchor2To(to: { x: number; y: number }): PolygonPath | null {
  const scene = {
    nodes: new Map([[asNodeId('node-a'), { id: asNodeId('node-a'), kind: 'leaf' as const, layer: 'default', parent: null, pose: square, data: {} }]]),
    layers: [{ id: 'default' }],
    getVersion: () => 1,
  };
  const snapper = createPathSnapper(scene as never);
  snapper.configure({ kinds: { nearest: false } });
  const snap: SnapDep = {
    point: (p) => p,
    toTargets: (p, at) => snapper.snap(p, at, { x: 1, y: 1 }),
  };
  let committed: PolygonPath | null = null;
  const dep = makeEditAnchorsDep({
    getEditablePath: () => square,
    applyEdit: (_id, path) => { committed = path as PolygonPath; },
  });
  const at = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({ selection: ['node-a'], editAnchors: dep, snap }),
    drag: { start: { x: 100, y: 100 }, current: { x, y }, delta: { x: x - 100, y: y - 100 }, affordance: { kind: 'anchor:2' } },
  });
  const handle = (editAnchorsAction.invoker as OngoingInvoker).start(at(100, 100), undefined);
  handle.onMove!(at(to.x, to.y));
  handle.onEnd!(at(to.x, to.y), 'commit');
  return committed;
}

describe('an anchor drag snapping to its own path', () => {
  it("lands on another of the path's anchors", () => {
    const out = dragAnchor2To({ x: 3, y: 2 })!;
    expect(Array.from(out.coords).slice(4, 6)).toEqual([0, 0]);
  });

  it('does not snap to where the dragged anchor began, nor to its own segments', () => {
    const out = dragAnchor2To({ x: 100, y: 97 })!;
    expect(Array.from(out.coords).slice(4, 6)).toEqual([100, 97]);
  });
});
