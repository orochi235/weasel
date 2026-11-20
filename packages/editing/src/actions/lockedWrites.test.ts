/** A selected envelope whose source is locked: every command that would rewrite that source is disabled as
 *  locked, and its run leaves the scene as it was rather than throwing from the lock guard. */
import { describe, expect, it } from 'vitest';
import type { Action, ImmediateInvoker, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { NodeId, RectPose } from '@weasel-js/core';
import '@weasel-js/core';
import { makeBooleanGroup } from './pathfinder/booleanGroupAction';
import { flipAction } from './flip/action';
import { alignRightAction } from './align/action';
import { distributeHorizontalAction } from './distribute/action';
import { nudgeRightAction } from './edit/nudge';
import { swapAction } from './swap/action';
import { rotateAction } from './rotate/action';
import { transformAgainAction } from './transformAgain/action';
import { recordTransform } from '@weasel-js/core';

function makeScene() {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: { x: 30, y: 0, width: 10, height: 10 }, data: {} });
  const group = makeBooleanGroup(scene as never, [a, b])!;
  scene.setLocked(b, true);
  const other = scene.add({ kind: 'mark', layer: 'main', pose: { x: 100, y: 50, width: 40, height: 10 }, data: {} });
  const left = scene.add({ kind: 'mark', layer: 'main', pose: { x: -400, y: 50, width: 40, height: 10 }, data: {} });
  const far = scene.add({ kind: 'mark', layer: 'main', pose: { x: 500, y: 50, width: 40, height: 10 }, data: {} });
  return { scene, group, b, ids: [left, group, far] as NodeId[], pair: [group, other] as NodeId[] };
}

const CASES: Array<[string, Action, Record<string, unknown>, 'ids' | 'pair']> = [
  ['flip', flipAction, { axis: 'x', pivot: 'union' }, 'pair'],
  ['align', alignRightAction, {}, 'pair'],
  ['distribute', distributeHorizontalAction, {}, 'ids'],
  ['nudge', nudgeRightAction, {}, 'pair'],
  ['swap', swapAction, {}, 'pair'],
];

describe('commands over an envelope with a locked source', () => {
  it.each(CASES)('%s is disabled as locked and its run changes nothing', (_name, action, params, which) => {
    const made = makeScene();
    const { scene, b } = made;
    const deps = { scene, operands: { get: () => made[which], set: () => {} } };
    expect(action.enabled?.(deps as never, undefined, undefined, params as never)).toBe(ActionDisabledReason.Locked);
    const before = scene.get(b)!.pose;
    expect(() => (action.invoker as ImmediateInvoker).run(deps as never, params as never)).not.toThrow();
    expect(scene.get(b)!.pose).toEqual(before);
  });

  it('transform again of a nudge is disabled as locked', () => {
    const { scene, pair } = makeScene();
    recordTransform(scene, { kind: 'translate', dx: 5, dy: 0 }, pair);
    const deps = { scene, operands: { get: () => pair, set: () => {} } };
    expect(transformAgainAction.enabled?.(deps as never)).toBe(ActionDisabledReason.Locked);
    expect(() => (transformAgainAction.invoker as ImmediateInvoker).run(deps as never, undefined as never)).not.toThrow();
  });

  it('a rotate drag does not start', () => {
    const { scene, group } = makeScene();
    const ctx = {
      world: { x: 50, y: 50 }, screen: { x: 50, y: 50 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { scene, operands: { get: () => [group], set: () => {} } },
    } as unknown as InvocationCtx;
    const invoker = rotateAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    expect(invoker.start(ctx, undefined).onEnd).toBeUndefined();
  });
});
