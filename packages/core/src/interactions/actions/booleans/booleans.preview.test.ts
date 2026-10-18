/** `previewBooleanOp`: what an operation would make, with nothing minted or committed. */
import { describe, it, expect, vi } from 'vitest';
import { boundsOfPath, pathFromD, type Path } from '@weasel-js/geom';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { NodeId } from 'core/scene/types';
import { applyBooleanOp, previewBooleanOp, type BooleansAdapter } from './booleans';
import { rootsTree } from 'core/adapters/testing/rootsTree';
import type { TransientPath } from 'canvas/pathOverlay';
import { pathfinderCropAction, pathfinderUnionAction } from './action';

const RED = { color: '#f00' };
const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });

function harness(sources: { id: string; path: Path; paint?: PathPaint }[]) {
  const by = new Map(sources.map((s, i) => [s.id, { ...s, z: i }]));
  const createPathNode = vi.fn((path: Path) => ({ id: 'made', path }));
  const applyOps = vi.fn();
  const adapter: BooleansAdapter = {
    ...rootsTree(),
    getSelection: () => sources.map((s) => s.id as NodeId),
    getWorldPath: (id) => by.get(id)?.path,
    getPaint: (id) => by.get(id)?.paint,
    compareZ: (a, b) => by.get(a)!.z - by.get(b)!.z,
    createPathNode,
    applyOps,
  };
  return { adapter, createPathNode, applyOps };
}

describe('previewBooleanOp', () => {
  it('answers the pieces an operation would make, and mints and commits nothing', () => {
    const h = harness([{ id: 'a', path: rect(0, 0, 10, 10) }, { id: 'mask', path: rect(5, 0, 20, 20) }]);
    const preview = previewBooleanOp(h.adapter, 'crop');
    expect(preview.kind).toBe('pieces');
    if (preview.kind !== 'pieces') return;
    expect(preview.pieces.map((p) => [p.sourceId, boundsOfPath(p.path).x, boundsOfPath(p.path).width]))
      .toEqual([['a', 5, 5]]);
    expect(h.createPathNode).not.toHaveBeenCalled();
    expect(h.applyOps).not.toHaveBeenCalled();
  });

  it('carries the paint a counted stroke leaves a piece', () => {
    const h = harness([
      { id: 'box', path: rect(0, 0, 100, 100), paint: { fill: { paint: RED } } },
      { id: 'line', path: pathFromD('M-20 50 L120 50'), paint: { fill: null, stroke: { paint: RED, width: 10 } } },
    ]);
    const preview = previewBooleanOp(h.adapter, 'intersect', { strokes: 'unfilled' });
    expect(preview.kind === 'pieces' && preview.pieces.map((p) => p.paint)).toEqual([{ fill: { paint: RED } }]);
  });

  it('answers what applying would, where there is nothing to make', () => {
    const one = harness([{ id: 'a', path: rect(0, 0, 10, 10) }]);
    expect(previewBooleanOp(one.adapter, 'subtract')).toEqual(applyBooleanOp(one.adapter, 'subtract'));
    const apart = harness([{ id: 'a', path: rect(0, 0, 10, 10) }, { id: 'b', path: rect(50, 0, 10, 10) }]);
    expect(previewBooleanOp(apart.adapter, 'intersect')).toEqual({ kind: 'noop', reason: 'empty-result' });
  });

  it('previews the paths applying then commits', () => {
    const h = harness([{ id: 'a', path: rect(0, 0, 10, 10) }, { id: 'b', path: rect(5, 5, 10, 10) }]);
    const preview = previewBooleanOp(h.adapter, 'divide');
    applyBooleanOp(h.adapter, 'divide');
    expect(preview.kind === 'pieces' && preview.pieces.map((p) => p.path))
      .toEqual(h.createPathNode.mock.calls.map(([path]) => path));
  });
});

describe('a Pathfinder action\'s preview', () => {
  it('shows the pieces it would make on the previewPaths dep, and takes them down', () => {
    const h = harness([{ id: 'a', path: rect(0, 0, 10, 10) }, { id: 'mask', path: rect(5, 0, 20, 20) }]);
    const hide = vi.fn();
    const show = vi.fn((_paths: readonly TransientPath[]) => hide);
    const stop = pathfinderCropAction.preview!({ booleansAdapter: h.adapter, previewPaths: { show } });
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0].map((p) => boundsOfPath(p.path).x)).toEqual([5]);
    expect(h.applyOps).not.toHaveBeenCalled();
    expect(pathfinderCropAction.requires).toContain('previewPaths');
    (stop as () => void)();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('shows nothing with too few paths selected or no dep to draw on', () => {
    const one = harness([{ id: 'a', path: rect(0, 0, 10, 10) }]);
    const show = vi.fn(() => () => {});
    expect(pathfinderUnionAction.preview!({ booleansAdapter: one.adapter, previewPaths: { show } })).toBeUndefined();
    expect(show).not.toHaveBeenCalled();
    const two = harness([{ id: 'a', path: rect(0, 0, 10, 10) }, { id: 'b', path: rect(5, 0, 10, 10) }]);
    expect(pathfinderUnionAction.preview!({ booleansAdapter: two.adapter })).toBeUndefined();
  });
});
