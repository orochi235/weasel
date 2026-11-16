import { describe, expect, it } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { solid, strokeOf } from '@weasel-js/core';
import { makeCtx, makeScene, ongoingInvoker } from './paintActionTestUtils';
import { setFillAction } from './setFill';
import { setFillOpacityAction } from './setFillOpacity';
import { setStrokeAction } from './setStroke';
import { setStrokeOpacityAction } from './setStrokeOpacity';
import { setStrokeWidthAction } from './setStrokeWidth';

const CASES: [Action, Record<string, unknown>][] = [
  [setFillAction, { color: '#ff0000' }],
  [setFillOpacityAction, { opacity: 0.5 }],
  [setStrokeAction, { color: '#ff0000' }],
  [setStrokeOpacityAction, { opacity: 0.5 }],
  [setStrokeWidthAction, { width: 4 }],
];

function commit(action: Action, scene: ReturnType<typeof makeScene>, params: Record<string, unknown>) {
  const ctx = makeCtx({ selectionIds: ['a'], scene, params });
  ongoingInvoker(action).start(ctx, { params }).onEnd?.(ctx, 'commit');
}

describe('a paint action setting the value a node already wears', () => {
  for (const [action, params] of CASES) {
    it(`${action.id} commits no undo entry`, () => {
      const scene = makeScene({ a: { fill: { paint: solid('#336699ff') }, stroke: strokeOf('#000000ff', 2) } });
      commit(action, scene, params);
      expect(scene.batches).toHaveLength(1);
      commit(action, scene, params);
      expect(scene.batches).toHaveLength(1);
    });
  }
});
