import { describe, expect, it } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { bridgeAnchorsAction } from './bridge';

/** Two open lines in one path: (0,0)→(10,0) and (20,10)→(30,10). Flat 0..3. */
function twoLines(): PolygonPath {
  return new PathBuilder().moveTo(0, 0).lineTo(10, 0).moveTo(20, 10).lineTo(30, 10).build();
}

function setup(path: PolygonPath, selected: number[]) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = path;
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  dep.setSelectedAnchors(selected);
  return { deps: { editAnchors: dep } as never, dep, commits };
}

const run = (a: { invoker?: unknown }, deps: never, params?: Record<string, unknown>) =>
  (a.invoker as ImmediateInvoker).run(deps, params);

describe('bridgeAnchorsAction', () => {
  it('bridges the selected ends with a curve of the tension asked for, in one commit', () => {
    const { deps, dep, commits } = setup(twoLines(), [1, 2]);
    expect(bridgeAnchorsAction.enabled!(deps)).toBe(true);
    run(bridgeAnchorsAction, deps, { tension: 0.25 });
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Bridge anchors');
    const [joined] = pathToAnchors(commits[0].path).anchors;
    const gap = Math.hypot(10, 10);
    expect(joined[1].outHandle!.x).toBeCloseTo(10 + gap / 4, 4);
    expect(joined[2].inHandle!.x).toBeCloseTo(20 - gap / 4, 4);
    expect(dep.selectedAnchors.size).toBe(0);
  });
});
