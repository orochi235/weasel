import { describe, expect, it } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ActionDeps, type ImmediateInvoker } from '@weasel-js/routing';
import { createEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { fairAnchorsAction } from './fairing';

function lopsidedArch(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 100);
  b.curveTo(0, 40, 80, 0, 100, 0);
  b.curveTo(180, 0, 260, 30, 260, 100);
  return b.build();
}

function fairSetup(selected: number[]) {
  const commits: PolygonPath[] = [];
  let current = lopsidedArch();
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath) => {
      current = worldPath as PolygonPath;
      commits.push(current);
    },
  });
  dep.setSelectedAnchors(selected);
  return { deps: { editAnchors: dep } as unknown as ActionDeps, commits };
}

const run = (action: { invoker?: unknown }, deps: ActionDeps) =>
  (action.invoker as ImmediateInvoker).run(deps, {});

describe('fairAnchorsAction', () => {
  it('fairs the whole path while no anchor is selected, keeping the tangent', () => {
    const { deps, commits } = fairSetup([]);
    expect(fairAnchorsAction.enabled!(deps)).toBe(true);
    run(fairAnchorsAction, deps);
    expect(commits).toHaveLength(1);
    const mid = pathToAnchors(commits[0]).anchors[0][1];
    expect(mid.inHandle!.y).toBeCloseTo(0, 4);
    expect(mid.outHandle!.y).toBeCloseTo(0, 4);
    expect(100 - mid.inHandle!.x).toBeGreaterThan(20);
    expect(fairAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('edits only the selected anchors when some are, so an open end alone changes nothing', () => {
    const { deps } = fairSetup([0]);
    expect(fairAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});
