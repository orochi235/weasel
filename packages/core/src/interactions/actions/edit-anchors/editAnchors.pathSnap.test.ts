import { describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { pathSnapSource } from 'domains/paths/pathSnap/pathSnapSource';
import { gridSource, sceneOfPaths, sessionDep } from 'domains/snap/testing/sessionDep';
import type { SnapSource } from 'domains/snap/types';
import type { SnapDep } from '../snapDep';
import { editAnchorsAction } from './action';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';

const square = pathFromD('M0 0 H100 V100 H0 Z') as PolygonPath;
const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

/** Drag the square's anchor 2, at (100, 100), to `to`, snapping through `snap`
 *  when one is given; the committed path. */
function dragAnchor2To(
  to: { x: number; y: number },
  opts: {
    others?: string[]; snap?: boolean; sources?: SnapSource[]; shift?: boolean; ctrl?: boolean; via?: { x: number; y: number };
  } = {},
): PolygonPath | null {
  const scene = sceneOfPaths([square, ...(opts.others ?? []).map((d) => pathFromD(d) as PolygonPath)]);
  const [editingId] = [...scene.nodes.keys()];
  const snap: SnapDep | undefined = opts.snap === false
    ? undefined
    : sessionDep(scene, opts.sources ?? [pathSnapSource({ kinds: { nearest: false } })]);
  let committed: PolygonPath | null = null;
  const dep = makeEditAnchorsDep({
    editingId: editingId!,
    getEditablePath: () => square,
    applyEdit: (_id, path) => { committed = path as PolygonPath; },
  });
  const at = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { ...KEYS, shift: opts.shift === true, ctrl: opts.ctrl === true },
    deps: stubDeps({ selection: [editingId], editAnchors: dep, ...(snap ? { snap } : {}) }),
    drag: { start: { x: 100, y: 100 }, current: { x, y }, delta: { x: x - 100, y: y - 100 }, affordance: { kind: 'anchor:2' } },
  });
  const handle = (editAnchorsAction.invoker as OngoingInvoker).start(at(100, 100), undefined);
  if (opts.via) handle.onMove!(at(opts.via.x, opts.via.y));
  handle.onMove!(at(to.x, to.y));
  handle.onEnd!(at(to.x, to.y), 'commit');
  return committed;
}

const anchor2 = (p: PolygonPath) => Array.from(p.coords).slice(4, 6);

describe('an anchor drag snapping', () => {
  it("lands on another of the path's anchors", () => {
    expect(anchor2(dragAnchor2To({ x: 3, y: 2 })!)).toEqual([0, 0]);
  });

  it('does not snap to where the dragged anchor began, nor to its own segments', () => {
    expect(anchor2(dragAnchor2To({ x: 100, y: 97 })!)).toEqual([100, 97]);
  });

  it("lands on another path's midpoint", () => {
    expect(anchor2(dragAnchor2To({ x: 203, y: 48 }, { others: ['M200 0 L200 100'] })!)).toEqual([200, 50]);
  });

  it('snaps back onto a target it began on, once dragged off it', () => {
    const out = dragAnchor2To({ x: 102, y: 98 }, { others: ['M100 100 L200 200'], via: { x: 130, y: 130 } })!;
    expect(anchor2(out)).toEqual([100, 100]);
  });

  it('is not snapped while Ctrl is held', () => {
    expect(anchor2(dragAnchor2To({ x: 113, y: 103 }, { sources: [gridSource(30)] })!)).toEqual([120, 90]);
    expect(anchor2(dragAnchor2To({ x: 113, y: 103 }, { sources: [gridSource(30)], ctrl: true })!)).toEqual([113, 103]);
  });

  it('holds to the axes through its press while Shift is held, with or without a snap dep', () => {
    expect(anchor2(dragAnchor2To({ x: 130, y: 103 }, { shift: true })!)).toEqual([130, 100]);
    expect(anchor2(dragAnchor2To({ x: 130, y: 103 }, { shift: true, snap: false })!)).toEqual([130, 100]);
  });
});
