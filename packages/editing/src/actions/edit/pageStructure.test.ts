/**
 * The paint actions and nudge act on the operands less pages and the page run, as group,
 * ungroup and duplicate do.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core/engine';
import { asNodeId, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { stubDepsForTests as stubDeps } from '@weasel-js/core/test-seams';
import { nudgeRightAction } from './nudge';
import { setFillAction } from './setFill';
import { makeSelection, ongoingInvoker } from './paintActionTestUtils';

const PAGE = asNodeId('page');
const A = asNodeId('a');

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: PAGE, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 500, height: 500 }, page: {} } as never);
  scene.add({ id: A, kind: 'mark', layer: 'main', parent: PAGE, data: {}, pose: { x: 10, y: 10, width: 20, height: 20 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

const deps = (scene: Scene<unknown, string, unknown>, ids: NodeId[]) =>
  stubDeps({ scene, operands: makeSelection(ids as unknown as string[]) });

describe('page structure among the operands', () => {
  it('setFill paints the content and not the page', () => {
    const scene = makeScene();
    const params = { color: '#ff0000' };
    const ctx = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: deps(scene, [PAGE, A]), params };
    ongoingInvoker(setFillAction).start(ctx, { params }).onEnd?.(ctx, 'commit');
    expect((scene.get(PAGE)!.data as { fill?: unknown }).fill).toBeUndefined();
    expect((scene.get(A)!.data as { fill?: unknown }).fill).toBeDefined();
  });

  it('setFill is off with only a page selected', () => {
    const scene = makeScene();
    expect(setFillAction.enabled!(deps(scene, [PAGE]), undefined, undefined, undefined)).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('nudge moves the content and not the page', () => {
    const scene = makeScene();
    (nudgeRightAction.invoker as ImmediateInvoker).run({ scene, operands: { get: () => [PAGE, A] } } as never, { magnitude: 'small' });
    expect((scene.get(PAGE)!.pose as RectPose).x).toBe(0);
    expect((scene.get(A)!.pose as RectPose).x).toBe(11);
  });

  it('nudge is off with only a page selected', () => {
    const scene = makeScene();
    expect(nudgeRightAction.enabled!(deps(scene, [PAGE]), undefined, undefined, { magnitude: 'small' })).toBe(ActionDisabledReason.SelectionRequired);
  });
});
