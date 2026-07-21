/**
 * `buildDepsFromRequires` wiring coverage.
 *
 * The builtin transform actions read `deps.geometryProjection` (the opt-in
 * data-geometry sync seam). Reading a dep is only half the contract — it must
 * also appear in the action's `requires`, or the dispatcher never resolves it
 * and the seam silently no-ops (the WeaselDraw flip-corruption bug: a resize
 * past the opposite edge left a raw negative-height pose because the sync
 * never ran). These tests go through the real `buildDepsFromRequires` path
 * that the action unit tests bypass with hand-rolled `ctx.deps`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildDepsFromRequires } from './buildDeps';
import type { DepRegistry } from './depRegistry';
import type { Action } from './registry';
import { moveAction } from './defaults/move';
import { resizeAction } from './defaults/resize';
import { flipAction } from './defaults/flip';
import {
  nudgeUpAction,
  nudgeDownAction,
  nudgeLeftAction,
  nudgeRightAction,
} from './defaults/nudge';

const PROJECTION = { token: 'geometry-projection-stub' };

function stubRegistry(): DepRegistry {
  return {
    register: () => () => {},
    get: (name) =>
      (name === 'geometryProjection' ? PROJECTION : {}) as ReturnType<DepRegistry['get']>,
  } as DepRegistry;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('builtin transform actions declare geometryProjection', () => {
  const actions: [string, Action][] = [
    ['move', moveAction],
    ['resize', resizeAction],
    ['flip', flipAction],
    ['nudgeUp', nudgeUpAction],
    ['nudgeDown', nudgeDownAction],
    ['nudgeLeft', nudgeLeftAction],
    ['nudgeRight', nudgeRightAction],
  ];

  it.each(actions)('%s receives the dep through buildDepsFromRequires', (_name, action) => {
    const deps = buildDepsFromRequires(action, stubRegistry());
    expect(deps.geometryProjection).toBe(PROJECTION);
  });
});

describe('undeclared dep reads (dev builds)', () => {
  const action = { id: 'test-action', requires: ['selection'] } as unknown as Action;

  it('throws, so the gesture fails visibly instead of silently degrading', () => {
    const deps = buildDepsFromRequires(action, stubRegistry());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => (deps as Record<string, unknown>).geometryProjection).toThrow(
      /action "test-action" read deps\.geometryProjection/,
    );
  });

  it('still warns before throwing (console trail survives a caught throw)', () => {
    const deps = buildDepsFromRequires(action, stubRegistry());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      void (deps as Record<string, unknown>).geometryProjection;
    } catch {
      /* expected */
    }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('did not declare it'));
  });

  it('declared reads stay quiet even when the registry has no entry', () => {
    const deps = buildDepsFromRequires(action, {
      register: () => () => {},
      get: () => undefined,
    } as unknown as DepRegistry);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((deps as Record<string, unknown>).selection).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
