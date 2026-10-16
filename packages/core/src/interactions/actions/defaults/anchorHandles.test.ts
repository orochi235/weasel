import { describe, expect, it } from 'vitest';
import { PathBuilder, isAnchorSmooth, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { harmonizeAnchorsAction, makeHandlesSymmetricAction, retractHandlesAction } from './anchorHandles';

/** Open curve whose middle anchor (flat 1) is a lopsided corner; the ends are straight-sided. */
function corner(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.curveTo(0, 0, 40, 50, 50, 50);
  b.curveTo(50, 80, 100, 0, 100, 0);
  return b.build();
}

function setup(selected: number[]) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = corner();
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  dep.setSelectedAnchors(selected);
  return { deps: { editAnchors: dep } as unknown as ActionDeps, commits };
}

const run = (action: { invoker?: unknown }, deps: ActionDeps) =>
  (action.invoker as ImmediateInvoker).run(deps, {});

describe('retractHandlesAction', () => {
  it('retracts the selected anchor\'s handles in one commit', () => {
    const { deps, commits } = setup([1]);
    expect(retractHandlesAction.enabled!(deps)).toBe(true);
    run(retractHandlesAction, deps);
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Retract handles');
    // The neighbors keep their handles, so both segments stay curves whose
    // control at this end sits on the anchor.
    const mid = pathToAnchors(commits[0].path).anchors[0][1];
    expect(mid.inHandle).toEqual({ x: 50, y: 50 });
    expect(mid.outHandle).toEqual({ x: 50, y: 50 });
  });

  it('is disabled with no anchor selected', () => {
    const { deps } = setup([]);
    expect(retractHandlesAction.enabled!(deps)).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('is disabled, and commits nothing, once the handles are already retracted', () => {
    const { deps, commits } = setup([1]);
    run(retractHandlesAction, deps);
    expect(retractHandlesAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
    run(retractHandlesAction, deps);
    expect(commits).toHaveLength(1);
  });
});

describe('makeHandlesSymmetricAction', () => {
  it('makes the selected anchor smooth, with equal handles, in one commit', () => {
    const { deps, commits } = setup([1]);
    expect(makeHandlesSymmetricAction.enabled!(deps)).toBe(true);
    run(makeHandlesSymmetricAction, deps);
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Make handles symmetric');
    const mid = pathToAnchors(commits[0].path).anchors[0][1];
    expect(isAnchorSmooth(mid)).toBe(true);
    const inLen = Math.hypot(mid.inHandle!.x - mid.x, mid.inHandle!.y - mid.y);
    const outLen = Math.hypot(mid.outHandle!.x - mid.x, mid.outHandle!.y - mid.y);
    expect(inLen).toBeCloseTo(outLen, 3);
  });

  it('is disabled when only the open path\'s ends are selected', () => {
    const { deps } = setup([0, 2]);
    expect(makeHandlesSymmetricAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});

/** Open arch whose smooth middle anchor (flat 1) has a short in-handle and a
 *  long out-handle, so the curvature jumps there. */
function lopsidedArch(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 100);
  b.curveTo(0, 40, 80, 0, 100, 0);
  b.curveTo(180, 0, 260, 30, 260, 100);
  return b.build();
}

function harmonizeSetup(selected: number[]) {
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

describe('harmonizeAnchorsAction', () => {
  it('harmonizes the whole path while no anchor is selected, keeping the tangent', () => {
    const { deps, commits } = harmonizeSetup([]);
    expect(harmonizeAnchorsAction.enabled!(deps)).toBe(true);
    run(harmonizeAnchorsAction, deps);
    expect(commits).toHaveLength(1);
    const mid = pathToAnchors(commits[0]).anchors[0][1];
    expect(mid.inHandle!.y).toBeCloseTo(0, 4);
    expect(mid.outHandle!.y).toBeCloseTo(0, 4);
    expect(100 - mid.inHandle!.x).toBeGreaterThan(20);
    expect(harmonizeAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('edits only the selected anchors when some are, so an open end alone changes nothing', () => {
    const { deps } = harmonizeSetup([0]);
    expect(harmonizeAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});
