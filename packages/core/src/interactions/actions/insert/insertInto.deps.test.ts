/** Insert admission through the deps bag the dispatcher builds, which surfaces only what an action `requires`. */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import { buildDepsFromRequires } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { gridSource, sessionDep } from 'domains/snap/testing/sessionDep';
import type { SnapBegin, SnapDep } from '../snapDep';
import { insertAction } from './action';
import { placeAction } from './placeAction';

const MARK = asNodeId('m');

function registry() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: MARK, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 } });
  const inner = sessionDep(scene as never, [gridSource(1)]);
  const begun: SnapBegin[] = [];
  const snap: SnapDep = { begin: (req) => { begun.push(req); return inner.begin(req); } };
  const sources: Record<string, unknown> = {
    scene,
    snap,
    insert: { commit: () => null },
    insertInto: { get: () => MARK },
    canDropInto: (parent: string) => parent === MARK,
  };
  const reg = { get: (name: string) => sources[name], register: () => () => {} } as unknown as DepRegistry;
  return { reg, begun };
}

describe('an insert into a mark that canDropInto admits', () => {
  it('snaps a drawn insert in that mark', () => {
    const { reg, begun } = registry();
    const deps = buildDepsFromRequires(insertAction, reg);
    const invoker = insertAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const ctx = { world: { x: 5, y: 5 }, screen: { x: 5, y: 5 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps };
    invoker.start(ctx as unknown as InvocationCtx, { params: { kind: 'rect' } } as BindingOpts);
    expect(begun.at(-1)?.parent).toBe(MARK);
  });

  it('snaps a placed insert in that mark', () => {
    const { reg, begun } = registry();
    const deps = buildDepsFromRequires(placeAction, reg);
    const invoker = placeAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected immediate');
    invoker.run(deps, { kind: 'rect', world: { x: 5, y: 5 }, size: { width: 10, height: 10 } });
    expect(begun.at(-1)?.parent).toBe(MARK);
  });
});
