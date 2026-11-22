import { describe, it, expect } from 'vitest';
import { ActionDisabledReason } from '@weasel-js/routing';
import { setVertexColorAction } from './setVertexColor';
import { makeScene, makeCtx, ongoingInvoker } from './paintActionTestUtils';

const getInvoker = () => ongoingInvoker(setVertexColorAction);
const RAMP = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];

describe('setVertexColorAction', () => {
  it('recolors the one anchor it names and leaves the rest, as one undo entry', () => {
    const scene = makeScene({ a: { vertexColors: RAMP } });
    const params = { index: 1, rgba: [0, 0, 0, 0.5] };
    const ctx = makeCtx({ selectionIds: ['a'], scene, params });
    getInvoker().start(ctx, { params }).onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set vertex color']);
    expect((scene.updates[0]!.data as { vertexColors: number[] }).vertexColors).toEqual([1, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 1, 1]);
  });

  it('clamps each channel to 0..1, as the opacity actions clamp alpha', () => {
    const scene = makeScene({ a: { vertexColors: RAMP } });
    const params = { index: 0, rgba: [2, -1, 0.5, 5] };
    const ctx = makeCtx({ selectionIds: ['a'], scene, params });
    getInvoker().start(ctx, { params }).onEnd?.(ctx, 'commit');
    expect((scene.updates[0]!.data as { vertexColors: number[] }).vertexColors.slice(0, 4)).toEqual([1, 0, 0.5, 1]);
  });

  it('leaves out a node with no vertex colors, or too few anchors for the index', () => {
    const scene = makeScene({ plain: {}, short: { vertexColors: RAMP } });
    const params = { index: 5, rgba: [0, 0, 0, 1] };
    const ctx = makeCtx({ selectionIds: ['plain', 'short'], scene, params });
    getInvoker().start(ctx, { params }).onEnd?.(ctx, 'commit');
    expect(scene.updates).toEqual([]);
  });
});

describe('setVertexColorAction enabled', () => {
  const deps = (nodes: Record<string, object>) => makeCtx({ selectionIds: Object.keys(nodes), scene: makeScene(nodes) }).deps;
  const enabled = (nodes: Record<string, object>) => setVertexColorAction.enabled!(deps(nodes), undefined, undefined, undefined);

  it('is off where no selected node has vertex colors', () => {
    expect(enabled({ plain: {} })).toBe(ActionDisabledReason.NotApplicable);
  });

  it('is on where one selected node has them', () => {
    expect(enabled({ plain: {}, ramp: { vertexColors: RAMP } })).toBe(true);
  });
});
