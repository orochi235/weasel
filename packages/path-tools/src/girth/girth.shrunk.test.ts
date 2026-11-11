/** Counterexamples `girth.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { polylineFromPoints, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { createScene, defaultCommitAdapter, IDENTITY_POSE_COMPOSITION, type Op, type Scene } from '@weasel-js/core';
import { createGirthActions, GIRTH_CLEAR_ID } from './girthActions';
import { anchorNormals } from './widthEdit';

describe('girth counterexamples', () => {
  it("gives an open end with a retracted handle the normal of the curve's tangent there", () => {
    const path = { kind: 'polygon', commands: Uint8Array.from([0, 2]), coords: Float32Array.from([0, 0, 0, 0, 0, -1, 0, -1]), fillRule: 'nonzero' } as PolygonPath;
    const [first, last] = anchorNormals(path);
    expect(Math.abs(first!.y)).toBeLessThan(1e-12);
    expect(Math.abs(first!.x)).toBe(1);
    expect(Math.abs(last!.x)).toBe(1);
  });

  it('disables clearing a width point with no click and no set point under the press', () => {
    const scene = createScene<unknown, 'main', PolygonPath>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', pose: polylineFromPoints([{ x: -100, y: 0 }, { x: -90, y: 0 }]) as PolygonPath, data: { stroke: { paint: { kind: 'solid', color: '#000' }, width: 1 } } });
    const loose = scene as unknown as Scene<unknown, string, unknown>;
    const deps = { scene: loose, view: { get: () => ({ scale: { x: 1, y: 1 } }) }, applyOps: (ops: Op[], label?: string) => scene.applyBatch(ops, label ?? '', defaultCommitAdapter(loose)) } as never;
    const clear = createGirthActions({ focus: () => null, setFocus: () => {}, reachPx: () => 6 }).find((a) => a.id === GIRTH_CLEAR_ID)!;
    expect(clear.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
    expect(clear.enabled!(deps, undefined, undefined, { press: { x: -100, y: 0.5 } })).toBe(ActionDisabledReason.NotApplicable);
    expect(clear.enabled!(deps, { x: -100, y: 0.5 })).toBe(true);
    const at = scene.historyIndex();
    (clear.invoker as ImmediateInvoker).run(deps, { press: { x: -100, y: 0.5 } });
    expect(scene.historyIndex()).toBe(at);
  });
});
