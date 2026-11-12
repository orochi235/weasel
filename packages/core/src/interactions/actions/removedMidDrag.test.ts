import { describe, it, expect } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { asNodeId } from 'core/scene/types';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { depsOf, makeScene } from './pbt.fixture';
import { dragCtx, handleAffordance } from './drag.pbt.fixture';

const A = asNodeId('a');
const B = asNodeId('b');

describe('a selected node removed mid-drag', () => {
  const cases: [string, Action, ReturnType<typeof handleAffordance> | undefined][] = [
    ['move', moveAction as Action, undefined],
    ['resize', resizeAction as Action, handleAffordance(0)],
    ['rotate', rotateAction as Action, undefined],
  ];
  for (const [name, action, aff] of cases) {
    it(`${name} still commits the rest of the selection`, () => {
      const scene = makeScene();
      scene.add({ id: A, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
      scene.add({ id: B, kind: 'mark', layer: 'main', pose: { x: 20, y: 0, width: 10, height: 10 }, data: {} });
      scene.setSelection([A, B]);
      const deps = depsOf(scene);
      const start = { x: 5, y: 5 };
      const end = { x: 2, y: 25 };
      const inv = action.invoker;
      if (!inv || inv.timing !== 'ongoing') throw new Error(`${name} is not ongoing`);
      const handle = inv.start(dragCtx(deps, start, start, aff), undefined);
      handle.onMove?.(dragCtx(deps, start, { x: 4, y: 15 }, aff));
      const was = scene.get(B)?.pose;
      scene.remove(A);
      handle.onMove?.(dragCtx(deps, start, end, aff));
      handle.onEnd?.(dragCtx(deps, start, end, aff), 'commit');
      expect(scene.get(B)?.pose).not.toEqual(was);
      expect(scene.overrides.ids()).toEqual([]);
    });
  }
});
