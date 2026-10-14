import { describe, expect, it } from 'vitest';
import {
  anchorsToPath, deleteAnchorsAt, pathToAnchors, type AnchorSet, type PolygonPath,
} from '@weasel-js/geom';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { brushDeleteAnchorsAction, BRUSH_DELETE_RADIUS_PX } from './brushDeleteAnchors';

/** An open wave through five anchors, ten apart along y = 0, every segment curved. */
function wave(): AnchorSet {
  return {
    anchors: [[0, 10, 20, 30, 40].map((x, i) => {
      const lift = i % 2 === 0 ? 4 : -4;
      return { x, y: 0, inHandle: { x: x - 3, y: -lift }, outHandle: { x: x + 3, y: lift } };
    })],
    closed: [false],
  };
}

const encode = (set: AnchorSet): PolygonPath => anchorsToPath(set.anchors, set.closed);

function setup(scale = 1) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = encode(wave());
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  const deps = { editAnchors: dep, view: { get: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }) } };
  const at = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x: x * scale, y: y * scale },
    modifiers: { alt: true, ctrl: false, meta: false, shift: false },
    deps: deps as never,
  });
  return { dep, commits, at };
}

const start = (ctx: InvocationCtx, radiusPx?: number): OngoingHandle =>
  (brushDeleteAnchorsAction.invoker as OngoingInvoker).start(
    ctx,
    radiusPx === undefined ? undefined : { params: { radiusPx } },
  );

const anchorXs = (path: unknown) => pathToAnchors(path as PolygonPath).anchors[0].map((a) => a.x);

describe('brushDeleteAnchors', () => {
  it('deletes every anchor the stroke sweeps, as one undo step on release', () => {
    const { commits, at } = setup();
    const h = start(at(8, 1), 3);
    h.onMove?.(at(15, 1));
    h.onMove?.(at(31, -1));
    expect(commits).toHaveLength(0);
    h.onEnd?.(at(31, -1), 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Brush delete anchors');
    expect(anchorXs(commits[0].path)).toEqual([0, 40]);
  });

  it('refits each gap the way deleting those anchors does', () => {
    const { commits, at } = setup();
    const h = start(at(10, 0), 3);
    h.onMove?.(at(20, 0));
    h.onEnd?.(at(20, 0), 'commit');
    const expected = wave();
    deleteAnchorsAt(expected, [1, 2]);
    expect(pathToAnchors(commits[0].path)).toEqual(pathToAnchors(encode(expected)));
  });

  it('previews the deletion while the brush is down', () => {
    const { at } = setup();
    const h = start(at(20, 0), 3);
    expect(h.previewIds?.()).toEqual(['p1']);
    expect(anchorXs(h.previewPose?.('p1'))).toEqual([0, 10, 30, 40]);
  });

  it('commits nothing on cancel', () => {
    const { commits, at } = setup();
    const h = start(at(20, 0), 3);
    h.onEnd?.(at(20, 0), 'cancel');
    expect(commits).toHaveLength(0);
  });

  it('commits nothing for a stroke that touched no anchor', () => {
    const { commits, at } = setup();
    const h = start(at(5, 20), 3);
    h.onMove?.(at(35, 20));
    h.onEnd?.(at(35, 20), 'commit');
    expect(commits).toHaveLength(0);
  });

  it('measures the brush on screen', () => {
    // 2 world units off the path is 8px at 4x: outside a 6px brush.
    const zoomed = setup(4);
    const h = start(zoomed.at(20, 2), 6);
    h.onEnd?.(zoomed.at(20, 2), 'commit');
    expect(zoomed.commits).toHaveLength(0);
    // The same brush at 1x covers it.
    const plain = setup(1);
    const h1 = start(plain.at(20, 2), 6);
    h1.onEnd?.(plain.at(20, 2), 'commit');
    expect(anchorXs(plain.commits[0].path)).toEqual([0, 10, 30, 40]);
  });

  it('shows its footprint as a brush overlay along the stroke', () => {
    const { at } = setup();
    const h = start(at(0, 30));
    h.onMove?.(at(10, 30));
    expect(h.overlay?.()).toEqual({
      kind: 'brush',
      points: [{ x: 0, y: 30 }, { x: 10, y: 30 }],
      radiusPx: BRUSH_DELETE_RADIUS_PX,
    });
  });

  it('clears the anchor selection it renumbered', () => {
    const { dep, at } = setup();
    dep.setSelectedAnchors([3]);
    const h = start(at(10, 0), 3);
    h.onEnd?.(at(10, 0), 'commit');
    expect(dep.selectedAnchors.size).toBe(0);
  });

  it('declines a drag when no path is being edited', () => {
    const dep = makeEditAnchorsDep({ editingId: '' });
    const ctx = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false }, deps: { editAnchors: dep } as never };
    expect(start(ctx)).toEqual({});
  });

  it('binds to an Alt-drag anywhere, in path-edit only', () => {
    expect(brushDeleteAnchorsAction.defaultBinding).toEqual({ kind: 'drag', mods: { alt: true } });
    expect(brushDeleteAnchorsAction.eligible).toEqual({ capability: 'edits-anchors' });
  });
});
