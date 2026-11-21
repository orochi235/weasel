import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core/engine';
import { asNodeId, type RectPose, type Scene } from '@weasel-js/core';
import { stubDepsForTests as stubDeps } from '@weasel-js/core/test-seams';
import { setFillAction } from './setFill';
import { makeSelection, ongoingInvoker } from './paintActionTestUtils';

const A = asNodeId('a');
const B = asNodeId('b');

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const id of [A, B]) scene.add({ id, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

const fillOf = (scene: Scene<unknown, string, unknown>, id: typeof A) => (scene.get(id)!.data as { fill?: unknown }).fill;

describe('a paint action given ids', () => {
  it('paints those nodes, not the selection', () => {
    const scene = makeScene();
    const params = { color: '#ff0000', ids: ['b'] };
    const deps = stubDeps({ scene, operands: makeSelection(['a']) });
    const ctx = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps, params };
    ongoingInvoker(setFillAction).start(ctx, { params }).onEnd?.(ctx, 'commit');
    expect(fillOf(scene, A)).toBeUndefined();
    expect(fillOf(scene, B)).toBeDefined();
  });

  it('is enabled with nothing selected', () => {
    const deps = stubDeps({ scene: makeScene(), operands: makeSelection([]) });
    expect(setFillAction.enabled!(deps, undefined, undefined, { ids: ['b'] })).toBe(true);
  });
});
