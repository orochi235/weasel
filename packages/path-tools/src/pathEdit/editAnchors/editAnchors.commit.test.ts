import { describe, it, expect } from 'vitest';
import type { AffordanceHit, InvocationCtx } from '@weasel-js/routing';
import type { EditAnchorsDep } from '@weasel-js/core';
import { createEditAnchorsDepForTests as makeDep, stubDepsForTests as stubDeps } from '@weasel-js/core/test-seams';
import { PATH_L, PATH_M, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { editAnchorsAction } from './editAnchors';

const triangle = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 5, 10]),
  fillRule: 'nonzero',
});

function drag(dep: EditAnchorsDep, extra: Record<string, unknown> = {}, shift = false) {
  const invoker = editAnchorsAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('ongoing');
  const affordance: AffordanceHit = { kind: 'anchor:0', targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift },
    deps: stubDeps({ operands: ['node-a'], editAnchors: dep, ...extra }),
    drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, affordance },
  };
  const handle = invoker.start(ctx, undefined);
  const to = (x: number, y: number) => handle.onMove!({ ...ctx, world: { x, y } });
  return { to, end: () => handle.onEnd!(ctx, 'commit') };
}

describe('editAnchors commit', () => {
  it('commits nothing for a drag released where it was pressed', () => {
    const path = triangle();
    const applied: unknown[] = [];
    const dep = makeDep({ getStorageKind: () => 'pose', getNodeShape: () => null, getEditablePath: () => path, applyEdit: (...a) => { applied.push(a); } });
    const d = drag(dep);
    d.to(40, 40);
    d.to(0, 0);
    d.end();
    expect(applied).toEqual([]);
  });
});
