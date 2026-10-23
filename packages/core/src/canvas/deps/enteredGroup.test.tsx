import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import { createEnteredGroup, useEnteredGroupDepSource } from './enteredGroup';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };

function build() {
  const scene = createScene<object, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
  const outer = scene.add({ kind: 'group', layer: 'l', pose: POSE, data: {} });
  const inner = scene.add({ kind: 'group', layer: 'l', pose: POSE, data: {}, parent: outer });
  const mark = scene.add({ kind: 'mark', layer: 'l', pose: POSE, data: {}, parent: inner });
  return { scene, outer, inner, mark };
}

describe('createEnteredGroup', () => {
  it('starts outside every group', () => {
    const { scene } = build();
    expect(createEnteredGroup(scene).get()).toBeNull();
  });

  it('enters a group and leaves to the group above, then to none', () => {
    const { scene, outer, inner } = build();
    const e = createEnteredGroup(scene);
    e.enter(inner);
    expect(e.get()).toBe(inner);
    e.leave();
    expect(e.get()).toBe(outer);
    e.leave();
    expect(e.get()).toBeNull();
    e.leave();
    expect(e.get()).toBeNull();
  });

  it('ignores an id that is not a group in the scene', () => {
    const { scene, mark } = build();
    const e = createEnteredGroup(scene);
    e.enter(mark);
    e.enter('nope' as NodeId);
    expect(e.get()).toBeNull();
  });

  it('answers the nearest surviving group above one that left the scene', () => {
    const { scene, outer, inner } = build();
    const e = createEnteredGroup(scene);
    e.enter(inner);
    scene.remove(inner);
    expect(e.get()).toBe(outer);
    scene.remove(outer);
    expect(e.get()).toBeNull();
  });

  it('is not moved by undo, and is back on the group when undo restores it', () => {
    const { scene, outer, inner } = build();
    const e = createEnteredGroup(scene);
    e.enter(inner);
    scene.setPose(inner, { ...POSE, x: 5 });
    scene.history.undo();
    expect(e.get()).toBe(inner);
    scene.remove(inner);
    expect(e.get()).toBe(outer);
    scene.history.undo();
    expect(e.get()).toBe(inner);
  });

  it('notifies on enter, leave and when the answer changes with the scene', () => {
    const { scene, outer, inner } = build();
    const e = createEnteredGroup(scene);
    const fn = vi.fn();
    const off = e.subscribe(fn);
    e.enter(inner);
    expect(fn).toHaveBeenCalledTimes(1);
    scene.setPose(inner, { ...POSE, x: 5 });
    expect(fn).toHaveBeenCalledTimes(1);
    scene.remove(inner);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(e.get()).toBe(outer);
    e.leave();
    expect(fn).toHaveBeenCalledTimes(3);
    off();
    e.enter(outer);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('useEnteredGroupDepSource', () => {
  it('publishes one store for the life of the scene as the enteredGroup dep', () => {
    const { scene, inner } = build();
    let reg!: DepRegistry;
    function Wire() {
      useEnteredGroupDepSource(scene);
      reg = useDepRegistry();
      return null;
    }
    const { rerender } = render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    reg.get('enteredGroup')!.enter(inner);
    rerender(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    expect(reg.get('enteredGroup')!.get()).toBe(inner);
  });
});
