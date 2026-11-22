import { describe, expect, it } from 'vitest';
import { createArapSolver, type ArapStep } from './arap';
import { barS } from './foldCases';
import { pinWarpSolve } from './pinWarp';

describe('createArapSolver', () => {
  it('places a pinned vertex no triangle uses on its target', () => {
    const mesh = {
      vertices: Float64Array.from([0, 0, 10, 0, 0, 10, 50, 50]),
      triangles: Uint32Array.from([0, 1, 2]),
    };
    const at = createArapSolver(mesh, [0, 1, 3]).solve([5, 0, 15, 0, 70, 40]);
    expect([at[6], at[7]]).toEqual([70, 40]);
  });

  it('reports a pass that runs out of rounds tangled under the last round that ran', () => {
    const steps: ArapStep[] = [];
    pinWarpSolve(barS.shape, barS.pins, { injectiveIterations: 1, trace: (s) => steps.push(s) });
    const injective = steps.filter((s) => s.stage === 'injective');
    expect(injective.length).toBe(2);
    expect(injective.map((s) => s.round)).toEqual([1, 1]);
  });
});
