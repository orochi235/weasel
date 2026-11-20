import { describe, expect, it } from 'vitest';
import { PathBuilder, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { createEditAnchorsDepForTests as makeDep } from '@weasel-js/core/test-seams';
import { insertPathAnchorAction } from './insertPathAnchor';
import { deleteAnchorsAction } from './anchorEditing';

function line(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(100, 0);
  b.lineTo(100, 100);
  return b.build();
}

/** A path in edit mode whose extensions refuse every edit. */
function refusing(selected: number[] = []) {
  let commits = 0;
  const selections: number[][] = [];
  const dep = makeDep({
    editingId: 'p1',
    getEditablePath: () => line(),
    finishEdit: () => null,
    applyEdit: () => { commits++; },
    selectedAnchors: new Set(selected),
    setSelectedAnchors: (next) => { selections.push([...next]); },
  });
  const view = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };
  return { deps: { editAnchors: dep, view } as unknown as ActionDeps, selections, commits: () => commits };
}

describe('an anchor edit its extensions refuse', () => {
  it('leaves the selection alone when the insert does not commit', () => {
    const { deps, selections } = refusing();
    (insertPathAnchorAction.invoker as ImmediateInvoker).run(deps, { world: { x: 50, y: 0 } });
    expect(selections).toEqual([]);
  });

  it('leaves the selection alone when the delete does not commit', () => {
    const { deps, selections, commits } = refusing([1]);
    (deleteAnchorsAction.invoker as ImmediateInvoker).run(deps, {});
    expect(commits()).toBe(0);
    expect(selections).toEqual([]);
  });
});
