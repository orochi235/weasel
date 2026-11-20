import { describe, expect, it } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { solid, solidStroke } from '@weasel-js/paint';
import { makeCtx, makeScene, ongoingInvoker } from './paintActionTestUtils';
import { setFillAction } from './setFill';
import { setFillOpacityAction } from './setFillOpacity';
import { setStrokeAction } from './setStroke';
import { setStrokeOpacityAction } from './setStrokeOpacity';
import { setStrokeWidthAction } from './setStrokeWidth';

function commit(action: Action, params: Record<string, unknown>) {
  const scene = makeScene(
    { g: { fill: { paint: solid('#33669980') }, stroke: solidStroke('#00ff00ff', 3) }, a: { fill: 'inherit', stroke: 'inherit' } },
    { a: 'g' },
  );
  const ctx = makeCtx({ selectionIds: ['a'], scene, params });
  ongoingInvoker(action).start(ctx, { params }).onEnd?.(ctx, 'commit');
  return scene.get('a' as never)!.data as Record<string, unknown>;
}

describe('a paint action on a node whose paint is inherited', () => {
  it('setFill starts from the inherited fill, not the string', () => {
    expect(commit(setFillAction, { color: '#ff0000' }).fill).toEqual({ paint: solid('#ff000080') });
  });

  it('setFill with None writes a fill with no paint', () => {
    expect(commit(setFillAction, { paint: null }).fill).toEqual({});
  });

  it('setFillOpacity keeps the inherited color', () => {
    expect(commit(setFillOpacityAction, { alpha01: 1 }).fill).toEqual({ paint: { color: '#336699', opacity: 1 } });
  });

  it('setStroke keeps the inherited width', () => {
    expect(commit(setStrokeAction, { color: '#ff0000' }).stroke).toEqual(solidStroke('#ff0000ff', 3));
  });

  it('setStrokeOpacity keeps the inherited color and width', () => {
    expect(commit(setStrokeOpacityAction, { alpha01: 0.5 }).stroke).toEqual({ paint: { color: '#00ff00', opacity: 0.5 }, width: 3 });
  });

  it('setStrokeWidth keeps the inherited paint', () => {
    expect(commit(setStrokeWidthAction, { width: 5 }).stroke).toEqual(solidStroke('#00ff00ff', 5));
  });
});
