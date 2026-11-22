import { describe, expect, it } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { solid, solidStroke } from '@weasel-js/paint';
import { makeCtx, makeScene, ongoingInvoker } from './paintActionTestUtils';
import { setFillAction } from './setFill';
import { setStrokeAction } from './setStroke';

const gradient = {
  kind: 'linear-gradient' as const,
  from: { x: 0, y: 0 },
  to: { x: 10, y: 0 },
  stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
  units: 'local' as const,
};

function run(action: Action, invocation: Record<string, unknown>, binding: Record<string, unknown>, moves: Record<string, unknown>[] = []) {
  const scene = makeScene({ a: { fill: { paint: solid('#336699ff') }, stroke: solidStroke('#00ff00ff', 3) } });
  const ctx = makeCtx({ selectionIds: ['a'], scene, params: invocation });
  const h = ongoingInvoker(action).start(ctx, { params: binding });
  for (const params of moves) h.onMove?.({ ...ctx, params });
  h.onEnd?.(ctx, 'commit');
  return scene.get('a' as never)!.data as Record<string, unknown>;
}

describe("a color paint action's params from the invocation and the binding", () => {
  it("setFill takes the invocation's color over the binding's paint", () => {
    expect(run(setFillAction, { color: '#ff0000ff' }, { paint: gradient }).fill).toEqual({ paint: solid('#ff0000ff') });
  });

  it("setStroke takes the invocation's color over the binding's None", () => {
    expect(run(setStrokeAction, { color: '#ff0000ff' }, { paint: null }).stroke).toEqual(solidStroke('#ff0000ff', 3));
  });
});
