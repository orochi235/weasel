import { describe, expect, it } from 'vitest';
import { pathToAnchors, type PolygonPath, type SpiroPoint } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { spiroNodeData } from './spiroShape';
import { spiroSegmentPress } from './spiroInsertPoint';

const points: SpiroPoint[] = [
  { x: 0, y: 0, kind: 'corner' },
  { x: 100, y: 0, kind: 'corner' },
  { x: 200, y: 0, kind: 'corner' },
];

function setup() {
  const { path, representation } = spiroNodeData([{ points, closed: false }]);
  const shape = { pose: path as unknown, data: { representation } as unknown };
  const edits: PolygonPath[] = [];
  const dep = makeEditAnchorsDep({
    editingId: 'n',
    getNodeShape: () => shape,
    getOutlinePath: () => path,
    getEditablePath: () => path,
    applyEdit: (_id, p) => { edits.push(p as PolygonPath); },
  });
  return { deps: { editAnchors: dep } as unknown as InvocationCtx['deps'], dep, edits };
}

const at = (deps: InvocationCtx['deps'], x: number, y: number) =>
  ({ world: { x, y }, screen: { x, y }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps }) as InvocationCtx;

describe('a press on a spiro curve in path edit', () => {
  it('adds a point between the two it lands between, and selects it', () => {
    const { deps, dep, edits } = setup();
    const handle = spiroSegmentPress(deps, { x: 50, y: 0 })!();
    handle.onMove!(at(deps, 50, 20));
    handle.onEnd!(at(deps, 50, 20), 'commit');
    expect(edits).toHaveLength(1);
    expect(pathToAnchors(edits[0]).anchors[0].map((a) => [a.x, a.y])).toEqual([[0, 0], [50, 20], [100, 0], [200, 0]]);
    expect([...dep.selectedAnchors]).toEqual([1]);
  });

  it('leaves the anchor selection as it was when canceled', () => {
    const { deps, dep, edits } = setup();
    dep.setSelectedAnchors([2]);
    const handle = spiroSegmentPress(deps, { x: 50, y: 0 })!();
    handle.onMove!(at(deps, 50, 20));
    handle.onEnd!(at(deps, 50, 20), 'cancel');
    expect(edits).toHaveLength(0);
    expect([...dep.selectedAnchors]).toEqual([2]);
  });
});
