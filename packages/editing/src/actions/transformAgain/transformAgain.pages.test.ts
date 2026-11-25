/** Transform Again leaves a selected page where it is, as the nudge, move, rotate, and resize it repeats do. */
import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import type { AnyScene } from '@weasel-js/core/engine';
import { lastTransform, recordTransform, type RepeatableTransform } from '@weasel-js/core';
import { pagedSceneForTests as pagedScene, PAGE_AForTests as PAGE_A, ON_PAGEForTests as ON_PAGE } from '@weasel-js/core/test-seams';
import { transformAgainAction } from './action';
import { rotateAction } from '../rotate/action';

function rig(t: RepeatableTransform) {
  const { scene } = pagedScene();
  const s = scene as unknown as AnyScene;
  let held: string[] = [PAGE_A, ON_PAGE];
  const operands = { get: () => held, set: (next: string[]) => { held = next; } };
  const deps = { scene: s, operands, resizePolicy: { constraints: [], expandIds: (x: string[]) => x } };
  recordTransform(s, t, [ON_PAGE]);
  const page = scene.get(PAGE_A)!.pose;
  const shape = scene.get(ON_PAGE)!.pose;
  (transformAgainAction.invoker as ImmediateInvoker).run(deps as never);
  return { s, page, shape, now: (id: string) => scene.get(id as never)!.pose };
}

describe('Transform Again with a page selected', () => {
  it.each<RepeatableTransform>([
    { kind: 'translate', dx: 5, dy: 0 },
    { kind: 'rotate', angle: 0.3, pivot: 'union' },
    { kind: 'rotate', angle: 0.3, pivot: 'each' },
    { kind: 'scale', to: { x: 0, y: 0, width: 2, height: 1.5 }, anchor: { x: 'min', y: 'min' } },
  ])('repeats $kind on the content alone', (t) => {
    const { s, page, shape, now } = rig(t);
    expect(now(PAGE_A)).toEqual(page);
    expect(now(ON_PAGE)).not.toEqual(shape);
    expect(lastTransform(s)).toEqual(t);
  });
});

describe('a rotate drag with a page selected', () => {
  it('turns the content alone', () => {
    const { scene } = pagedScene();
    const page = scene.get(PAGE_A)!.pose;
    const shape = scene.get(ON_PAGE)!.pose;
    const operands = { get: () => [PAGE_A, ON_PAGE], set: () => {} };
    const at = (x: number, y: number) => ({
      world: { x, y }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      drag: { start: { x: 300, y: 15 }, current: { x, y }, delta: { x: x - 300, y: y - 15 } },
      deps: { operands, scene },
    }) as unknown as InvocationCtx;
    const handle = (rotateAction.invoker as OngoingInvoker).start(at(300, 15), undefined);
    handle.onMove!(at(100, 215));
    handle.onEnd!(at(100, 215), 'commit');
    expect(scene.get(PAGE_A)!.pose).toEqual(page);
    expect(scene.get(ON_PAGE)!.pose).not.toEqual(shape);
    expect(lastTransform(scene as unknown as AnyScene)).toMatchObject({ kind: 'rotate' });
  });
});
