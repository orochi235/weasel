import { describe, expect, it } from 'vitest';
import { createArapSolver, type ArapStep } from './arap';
import { barS, backwardStretches, discSquash, invertedTriangles, type FoldCase } from './foldCases';
import { puppetMap } from './puppet';
import { puppetMesh } from './puppetMesh';

function solved(c: FoldCase) {
  const mesh = puppetMesh(c.shape, c.pins.map((p) => p.from));
  const pinned: number[] = [], targets: number[] = [];
  c.pins.forEach((pin, k) => {
    const v = mesh.pinVertex[k];
    if (v < 0 || pinned.includes(v)) return;
    pinned.push(v);
    targets.push(pin.to.x + mesh.vertices[2 * v] - pin.from.x, pin.to.y + mesh.vertices[2 * v + 1] - pin.from.y);
  });
  return { mesh, pinned, targets, solver: createArapSolver(mesh, pinned) };
}

describe.each([discSquash, barS])('a hard puppet warp: $name', (c) => {
  it('turns no triangle over, and lands every pin', () => {
    const { mesh, pinned, targets, solver } = solved(c);
    const at = solver.solve(targets);
    expect(invertedTriangles(mesh, at)).toBe(0);
    pinned.forEach((v, k) => {
      expect(at[2 * v]).toBe(targets[2 * k]);
      expect(at[2 * v + 1]).toBe(targets[2 * k + 1]);
    });
  });

  it('runs no stretch of the outline backwards', () => {
    expect(backwardStretches(c, puppetMap(c.shape, c.pins))).toBe(0);
  });

  it('folds without the injective pass, which is what the pass is for', () => {
    const { mesh, targets, solver } = solved(c);
    expect(invertedTriangles(mesh, solver.solve(targets, { iterations: 0, injectiveIterations: 0 }))).toBeGreaterThan(0);
  });
});

describe('the solve trace', () => {
  it('reports each stage in order, the last step being the result', () => {
    const { targets, solver } = solved(discSquash);
    const steps: ArapStep[] = [];
    const at = solver.solve(targets, { iterations: 3, trace: (s) => steps.push(s) });
    const stages = steps.map((s) => `${s.stage} ${s.round}`);
    expect(stages.slice(0, 5)).toEqual(['similarity 1', 'rigid 1', 'local-global 1', 'local-global 2', 'local-global 3']);
    expect(steps.slice(5).every((s, i) => s.stage === 'injective' && s.round === i + 1)).toBe(true);
    expect(Array.from(steps[steps.length - 1].vertices)).toEqual(Array.from(at));
  });

  it('gives the two linear steps alone at no iterations', () => {
    const { targets, solver } = solved(barS);
    const steps: ArapStep[] = [];
    const at = solver.solve(targets, { iterations: 0, injectiveIterations: 0, trace: (s) => steps.push(s) });
    expect(steps.map((s) => s.stage)).toEqual(['similarity', 'rigid']);
    expect(Array.from(steps[1].vertices)).toEqual(Array.from(at));
  });
});

it('leaves a mesh at rest where it is', () => {
  const { mesh, pinned, solver } = solved(barS);
  const at = solver.solve(pinned.flatMap((v) => [mesh.vertices[2 * v], mesh.vertices[2 * v + 1]]));
  at.forEach((x, i) => expect(x).toBeCloseTo(mesh.vertices[i], 9));
});
