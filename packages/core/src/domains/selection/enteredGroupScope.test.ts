import { describe, it, expect, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import { createEnteredGroup } from 'canvas/deps/enteredGroup';
import { createEnteredGroupScope } from './enteredGroupScope';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };

function build() {
  const scene = createScene<object, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
  const outer = scene.add({ kind: 'group', layer: 'l', pose: POSE, data: {} });
  const sibling = scene.add({ kind: 'mark', layer: 'l', pose: POSE, data: {}, parent: outer });
  const inner = scene.add({ kind: 'group', layer: 'l', pose: POSE, data: {}, parent: outer });
  const deep = scene.add({ kind: 'mark', layer: 'l', pose: POSE, data: {}, parent: inner });
  const free = scene.add({ kind: 'mark', layer: 'l', pose: POSE, data: {} });
  const entered = createEnteredGroup(scene);
  const scope = createEnteredGroupScope({ entered, scene });
  return { scene, entered, scope, outer, sibling, inner, deep, free };
}

describe('createEnteredGroupScope', () => {
  it('leaves every node lit and live with nothing entered', () => {
    const { scope, outer, deep, free } = build();
    for (const id of [outer, deep, free]) {
      expect(scope.alphaFor(id)).toBe(1);
      expect(scope.isPointerInteractive(id)).toBe(true);
    }
  });

  it('dims everything outside the entered group and takes it out of hits', () => {
    const { scope, entered, outer, sibling, inner, deep, free } = build();
    entered.enter(outer);
    for (const id of [outer, sibling, inner, deep]) expect(scope.alphaFor(id)).toBe(1);
    for (const id of [sibling, inner, deep]) expect(scope.isPointerInteractive(id)).toBe(true);
    expect(scope.alphaFor(free)).toBe(0.3);
    expect(scope.isPointerInteractive(free)).toBe(false);
  });

  it('takes the entered group itself out of hits: its empty box is empty canvas inside it', () => {
    const { scope, entered, outer } = build();
    entered.enter(outer);
    expect(scope.isPointerInteractive(outer)).toBe(false);
  });

  it('scopes to the inner group of a nested pair, dimming the outer group and its other members', () => {
    const { scope, entered, outer, sibling, inner, deep } = build();
    entered.enter(inner);
    expect(scope.alphaFor(deep)).toBe(1);
    expect(scope.alphaFor(inner)).toBe(1);
    expect(scope.alphaFor(sibling)).toBe(0.3);
    expect(scope.alphaFor(outer)).toBe(0.3);
    expect(scope.isPointerInteractive(sibling)).toBe(false);
  });

  it('follows the entered group to its parent when the group is deleted', () => {
    const { scene, scope, entered, outer, inner, sibling, free } = build();
    entered.enter(inner);
    scene.remove(inner);
    expect(scope.alphaFor(sibling)).toBe(1);
    expect(scope.alphaFor(outer)).toBe(1);
    expect(scope.alphaFor(free)).toBe(0.3);
  });

  it('takes its dim from dimAlpha', () => {
    const { scene, entered, outer, free } = build();
    const scope = createEnteredGroupScope({ entered, scene, dimAlpha: 0.5 });
    entered.enter(outer);
    expect(scope.alphaFor(free)).toBe(0.5);
  });

  it('notifies and bumps its version when the entered group changes', () => {
    const { scope, entered, outer } = build();
    const fn = vi.fn();
    const off = scope.subscribe(fn);
    const before = scope.getVersion();
    entered.enter(outer);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(scope.getVersion()).toBeGreaterThan(before);
    off();
    entered.leave();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
