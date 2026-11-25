/**
 * A layout child dragged out of its container in a paged scene lands by the
 * page rule: on the page under it, or, off every page with the pasteboard off,
 * back on its own page with part of it showing.
 */
import { describe, expect, it } from 'vitest';
import type { BindingOptions, InvocationCtx } from '@weasel-js/routing';
import { asNodeId, type RectPose } from '@weasel-js/core';
import { PAGE_AForTests as PAGE_A, PAGE_BForTests as PAGE_B, pagedSceneForTests as pagedScene } from '@weasel-js/core/test-seams';
import type { LayoutStrategy } from '@weasel-js/core/engine';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const G = asNodeId('g');
const N = asNodeId('n');
const stack = { childPoses: () => new Map() } as unknown as LayoutStrategy<unknown>;

function release(dx: number, pasteboard: boolean) {
  const { scene } = pagedScene({ pasteboard });
  scene.add({ id: G, kind: 'group', layer: 'ink', parent: PAGE_A, pose: { x: 0, y: 0, width: 40, height: 40 }, data: {} });
  scene.add({ id: N, kind: 'mark', layer: 'ink', parent: G, pose: { x: 5, y: 10, width: 20, height: 10 }, data: {} });
  const from = { x: 15, y: 15 };
  const deps = { operands: { get: () => [N] }, scene, layout: { getLayout: (id: string) => (id === G ? stack : null) } };
  const base = { world: from, modifiers: MODS, deps };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params: {} } as BindingOptions);
  const to = { x: from.x + dx, y: from.y };
  const at = { ...base, world: to, drag: { start: from, current: to, delta: { x: dx, y: 0 } } } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
  return scene.get(N)!;
}

describe('moveAction — a layout child let go outside its container in a paged scene', () => {
  it('keeps one let go off every page on its page, with part of it on, with the pasteboard off', () => {
    const node = release(400, false);
    expect(node.parent).toBe(PAGE_A);
    expect((node.pose as RectPose).x).toBe(99);
  });

  it('lands one let go on another page on that page', () => {
    const node = release(150, false);
    expect(node.parent).toBe(PAGE_B);
    expect((node.pose as RectPose).x).toBe(45);
  });

  it('makes one let go off every page a root with the pasteboard on', () => {
    expect(release(400, true).parent).toBe(null);
  });
});
