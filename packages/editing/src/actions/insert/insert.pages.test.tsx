/** An insert in a paged scene, through the insert dep `<SceneCanvas>` sources. */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createActionDeps, type BindingOptions, type InvocationCtx } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useInsertDepSource } from '../../deps/insert';
import { sceneToAdapter, insertParent } from '@weasel-js/core';
import { ON_PAGEForTests as ON_PAGE, PAGE_AForTests as PAGE_A, PAGE_BForTests as PAGE_B, pagedSceneForTests as pagedScene } from '@weasel-js/core/test-seams';
import type { NodeId, RectPose } from '@weasel-js/core';
import { insertAction } from './action';
import { insertRepositionAction } from './repositionAction';
import { sessionDepForTests as sessionDep } from '@weasel-js/core/test-seams';
import type { InsertLive } from '@weasel-js/core/engine';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

function draw(from: { x: number; y: number }, to: { x: number; y: number }, pasteboard = false, locked: NodeId[] = []) {
  const { scene } = pagedScene({ pasteboard });
  for (const id of locked) scene.setLocked(id, true);
  const adapter = sceneToAdapter(scene);
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(scene as never, adapter as never);
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  const deps = createActionDeps(insertAction, reg);
  const invoker = insertAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const ctx = { world: from, screen: from, modifiers: MODS, deps } as unknown as InvocationCtx;
  const handle = invoker.start(ctx, { params: { kind: 'rect' } } as BindingOptions);
  handle.onMove!({ ...ctx, world: to });
  handle.onEnd!({ ...ctx, world: to }, 'commit');
  const made = [...scene.nodes.values()].find((n) => n.kind === 'mark' && n.id !== ON_PAGE)!;
  return { node: made, pose: made.pose as RectPose };
}

describe('insertAction in a paged scene', () => {
  it('puts a rect drawn in the gap in the nearer page, with part of it on that page', () => {
    // The gap between page a (0..100) and page b (110..210).
    const { node, pose } = draw({ x: 102, y: 20 }, { x: 107, y: 40 });
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 99, y: 20, width: 5, height: 20 });
  });

  it('puts a rect drawn on a locked page on the nearest page that is not', () => {
    const { node, pose } = draw({ x: 150, y: 20 }, { x: 170, y: 40 }, false, [PAGE_B]);
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 99, y: 20 });
  });

  it('puts one drawn in the gap at the top of the tree with the pasteboard on', () => {
    const { node, pose } = draw({ x: 102, y: 20 }, { x: 107, y: 40 }, true);
    expect(node.parent).toBeNull();
    expect(pose).toMatchObject({ x: 102, y: 20 });
  });
});

describe('insertParent in a paged scene', () => {
  it('passes a page that refuses the insert for the next nearest one, and the top of the tree after that', () => {
    const { scene } = pagedScene();
    const at = { x: 20, y: 20 };
    expect(insertParent(scene as never, null, undefined, at)).toBe(PAGE_A);
    expect(insertParent(scene as never, null, (parent) => parent !== PAGE_A, at)).toBe(PAGE_B);
    expect(insertParent(scene as never, null, () => false, at)).toBeNull();
  });
});

describe('insertAction carried across pages by Space', () => {
  it('lands in the page it was carried onto, and snaps in that page\'s scope from then on', () => {
    const { scene } = pagedScene({});
    const adapter = sceneToAdapter(scene);
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(scene as never, adapter as never);
      reg = useDepRegistry();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const told: Array<string | undefined> = [];
    const spy = { id: 'spy', roles: ['pointer'], *collect(q: { parent?: string }) { told.push(q.parent); } };
    const snap = sessionDep(scene as never, [spy as never]);
    const insertLive: InsertLive = { gesture: null };
    const deps = { ...createActionDeps(insertAction, reg), scene, snap, insertLive };
    const ctx = (world: { x: number; y: number }) => ({ world, screen: world, modifiers: MODS, deps }) as unknown as InvocationCtx;
    const invoker = insertAction.invoker!;
    if (invoker.timing !== 'ongoing' || insertRepositionAction.invoker?.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctx({ x: 20, y: 20 }), { params: { kind: 'rect' } } as BindingOptions);
    handle.onMove!(ctx({ x: 40, y: 40 }));
    const space = insertRepositionAction.invoker.start(ctx({ x: 0, y: 0 }), undefined);
    handle.onMove!(ctx({ x: 170, y: 40 }));
    space.onEnd!(ctx({ x: 170, y: 40 }), 'commit');
    told.length = 0;
    handle.onMove!(ctx({ x: 180, y: 50 }));
    handle.onEnd!(ctx({ x: 180, y: 50 }), 'commit');
    const made = [...scene.nodes.values()].find((n) => n.kind === 'mark' && n.id !== ON_PAGE)!;
    expect(made.parent).toBe(PAGE_B);
    expect(told.length).toBeGreaterThan(0);
    expect(new Set(told)).toEqual(new Set([PAGE_B]));
  });
});

describe('the insert dep in a paged scene', () => {
  it('puts the node in the container under ends.site, wherever its start is', () => {
    const { scene } = pagedScene({ pasteboard: true });
    const adapter = sceneToAdapter(scene);
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(scene as never, adapter as never);
      reg = useDepRegistry();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const bounds = { x: 115, y: 10, width: 10, height: 10 };
    const id = reg.get('insert')!.commit(bounds, { kind: 'rect' }, { start: { x: 115, y: 10 }, end: { x: 125, y: 20 }, site: { x: 95, y: 10 } });
    expect(scene.get(id as NodeId)?.parent).toBe(PAGE_A);
  });
});
