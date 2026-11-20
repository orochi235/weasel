import { describe, expect, it } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { solid, solidStroke } from '@weasel-js/paint';
import { makeCtx, makeScene, ongoingInvoker } from './paintActionTestUtils';
import { setFillOpacityAction } from './setFillOpacity';
import { setStrokeOpacityAction } from './setStrokeOpacity';
import { setStrokeWidthAction } from './setStrokeWidth';
import { setVertexColorAction } from './setVertexColor';

const RAMP = [1, 0, 0, 1, 0, 1, 0, 1];

function run(action: Action, start: Record<string, unknown>, move?: Record<string, unknown>) {
  const scene = makeScene({ a: { fill: { paint: solid('#336699ff') }, stroke: solidStroke('#000000ff', 2), vertexColors: RAMP } });
  const ctx = makeCtx({ selectionIds: ['a'], scene, params: start });
  const h = ongoingInvoker(action).start(ctx, { params: start });
  if (move) h.onMove?.({ ...ctx, params: move });
  h.onEnd?.(ctx, 'commit');
  return scene.get('a' as never)!.data as Record<string, { paint?: { opacity?: number }; width?: number }>;
}

describe('a paint action given a value it cannot write', () => {
  for (const action of [setFillOpacityAction, setStrokeOpacityAction]) {
    const key = action === setFillOpacityAction ? 'fill' : 'stroke';
    it(`${action.id} ignores a non-finite alpha01 at start and on a move`, () => {
      expect(run(action, { alpha01: NaN })[key]!.paint!.opacity).toBe(1);
      expect(run(action, { alpha01: 0.5 }, { alpha01: NaN })[key]!.paint!.opacity).toBe(0.5);
    });
  }

  for (const bad of [NaN, Infinity, -3]) {
    it(`setStrokeWidth ignores a width of ${bad}`, () => {
      expect(run(setStrokeWidthAction, { width: bad }).stroke!.width).toBe(2);
      expect(run(setStrokeWidthAction, { width: 4 }, { width: bad }).stroke!.width).toBe(4);
    });
  }

  for (const bad of [[1, 0, 0], [1, 0, 0, NaN], [1, 0, 0, 1, 1]]) {
    it(`setVertexColor ignores an rgba of ${JSON.stringify(bad)}`, () => {
      expect(run(setVertexColorAction, { index: 0, rgba: bad }).vertexColors).toEqual(RAMP);
      expect(run(setVertexColorAction, { index: 0, rgba: [0, 0, 0, 1] }, { rgba: bad }).vertexColors).toEqual([0, 0, 0, 1, 0, 1, 0, 1]);
    });
  }
});
