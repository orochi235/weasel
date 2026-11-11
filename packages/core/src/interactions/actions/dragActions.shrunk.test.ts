/** Counterexamples `dragActions.pbt.test.ts` and `dragLaws.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, it, expect } from 'vitest';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { cloneAction } from './clone/action';
import { insertAction } from './insert/action';
import { areaSelectAction } from './defaults/areaSelect';
import { lassoSelectAction } from './lasso-select/action';
import type { ActionDeps } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { depsOf, makeScene } from './pbt.fixture';
import { assertFinite, drive } from './drag.pbt.fixture';

const unit = { x: 0, y: 0, width: 1, height: 1 };

describe('ongoing actions, shrunk counterexamples', () => {
  it('a resize dragged to a point that is no number neither throws nor writes', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'mark', layer: 'main', pose: unit, data: {} });
    scene.setSelection([a]);
    const at = scene.historyIndex();
    drive(resizeAction, depsOf(scene), { start: { x: 0, y: 0 }, path: [{ x: Number.NaN, y: Number.NaN }], reason: 'commit', handle: 0 });
    expect(scene.get(a)!.pose).toEqual(unit);
    expect(scene.historyIndex()).toBe(at);
  });

  it('a resize of a group holding a locked node does not start', () => {
    const scene = makeScene();
    const g = scene.add({ kind: 'group', layer: 'main', pose: unit, data: {} });
    const c = scene.add({ kind: 'mark', layer: 'main', pose: unit, data: {}, parent: g });
    scene.add({ kind: 'mark', layer: 'main', pose: unit, data: {}, parent: g });
    scene.setLocked(c, true);
    scene.setSelection([g]);
    const at = scene.historyIndex();
    expect(drive(resizeAction, depsOf(scene), { start: { x: 0, y: 0 }, path: [{ x: 5, y: 7 }], reason: 'commit', handle: 0 })).toBeNull();
    expect(scene.get(c)!.pose).toEqual(unit);
    expect(scene.historyIndex()).toBe(at);
  });

  for (const [name, action] of [['move', moveAction], ['rotate', rotateAction], ['clone', cloneAction]] as const) {
    it(`a ${name} past a point that is no number commits the last frame that was`, () => {
      const scene = makeScene();
      const a = scene.add({ kind: 'mark', layer: 'main', pose: unit, data: {} });
      scene.setSelection([a]);
      drive(action, depsOf(scene), { start: { x: 0, y: 1 }, path: [{ x: 1, y: 0 }, { x: 0, y: Number.NaN }], reason: 'commit' });
      const moved = [...scene.nodes.values()].at(-1)!.pose;
      assertFinite(moved, name);
      expect(moved).not.toEqual(unit);
    });
  }

  it('a turned node moved out near the double range and resized writes nothing that is not finite', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'mark', layer: 'main', pose: unit, data: {} });
    scene.setSelection([a]);
    const deps = depsOf(scene);
    drive(rotateAction, deps, { start: { x: 0, y: 1 }, path: [{ x: 1, y: 0 }], reason: 'commit' });
    drive(moveAction, deps, { start: { x: 0, y: 0 }, path: [{ x: 1e308, y: 0 }], reason: 'commit' });
    drive(resizeAction, deps, { start: { x: 0, y: 0 }, path: [{ x: 0, y: 0 }], reason: 'commit', handle: 0 });
    assertFinite(scene.get(a)!.pose, 'resize');
  });

  it('an insert ending on a point that is no number lands where the last that was left it', () => {
    const calls: unknown[] = [];
    const deps = { insert: { commit: (b: unknown) => { calls.push(b); return 'n' as NodeId; } } } as unknown as ActionDeps;
    drive(insertAction, deps, { start: { x: 0, y: 0 }, path: [{ x: 10, y: 10 }, { x: Number.NaN, y: 3 }], reason: 'commit', opts: { params: { kind: 'rect' } } });
    expect(calls).toEqual([{ x: 0, y: 0, width: 10, height: 10 }]);
  });

  for (const [name, action, key] of [['marquee', areaSelectAction, 'areaSelect'], ['lasso', lassoSelectAction, 'lassoSelect']] as const) {
    it(`a ${name} ending on a point that is no number takes what the last that was took`, () => {
      let selected: string[] = [];
      // A region that is not a finite rect meets nothing.
      const hitTestArea = (r: { x: number; y: number; width: number; height: number }) =>
        ([r.x, r.y, r.width, r.height].every(Number.isFinite) ? ['a'] : []);
      const deps = { [key]: { hitTestArea, getSelection: () => selected, setSelection: (ids: string[]) => { selected = ids; } } } as unknown as ActionDeps;
      const path = [{ x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: Infinity, y: 3 }];
      drive(action, deps, { start: { x: 0, y: 0 }, path, reason: 'commit' });
      expect(selected).toEqual(['a']);
    });
  }
});
