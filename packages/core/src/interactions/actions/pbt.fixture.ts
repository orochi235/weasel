/**
 * fast-check helpers shared by the interaction actions' property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { ActionDeps } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { RectPose } from 'core/geometry/rectPose';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

export type TestScene = Scene<Record<string, never>, 'main' | 'top', RectPose>;

export function makeScene(): TestScene {
  return createScene<Record<string, never>, 'main' | 'top'>({ systemLayers: [{ id: 'main' }, { id: 'top' }] }) as TestScene;
}

/** The deps an immediate action reads, over a real scene and its own selection. */
export function depsOf(scene: TestScene): ActionDeps {
  return {
    scene,
    selection: {
      get: () => [...scene.getSelection()],
      set: (next: readonly NodeId[]) => scene.setSelection([...next]),
    },
  } as unknown as ActionDeps;
}

/** A rect pose on a coarse grid, so every align and nudge lands exactly. */
export const rectPose: fc.Arbitrary<RectPose> = fc.record({
  x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 1, max: 60 }), height: fc.integer({ min: 1, max: 60 }),
});

/** A tally of what a property exercised, so a run whose inputs all fell through fails rather than passes. */
export function tally(): { count(what: string): void; get(what: string): number; dump(): string } {
  const m = new Map<string, number>();
  return {
    count: (what) => { m.set(what, (m.get(what) ?? 0) + 1); },
    get: (what) => m.get(what) ?? 0,
    dump: () => JSON.stringify([...m].sort()),
  };
}
