/** An insert in a paged scene, through the insert dep `<SceneCanvas>` sources. */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildDepsFromRequires, type BindingOptions, type InvocationCtx } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useInsertDepSource } from 'canvas/deps/insert';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { ON_PAGE, PAGE_A, PAGE_B, pagedScene } from 'core/pages/pagedFixture';
import { insertParent } from './parent';
import type { NodeId, RectPose } from 'core/scene/types';
import { insertAction } from './action';

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
  const deps = buildDepsFromRequires(insertAction, reg);
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
