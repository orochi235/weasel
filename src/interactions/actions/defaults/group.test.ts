/**
 * Tests for groupAction / ungroupAction descriptors and groupAction behavior.
 */
import { describe, it, expect } from 'vitest';
import { groupAction, ungroupAction } from './group';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { ImmediateInvoker } from '../invoker';

describe('groupAction (descriptor)', () => {
  it('id="group", label="Group"', () => {
    expect(groupAction.id).toBe('group');
    expect(groupAction.label).toBe('Group');
  });

  it('defaultBinding = { kind: "key", key: "g", mods: { mod: true } }', () => {
    expect(groupAction.defaultBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(groupAction.invoker?.timing).toBe('immediate');
  });
});

describe('ungroupAction (descriptor)', () => {
  it('id="ungroup", label="Ungroup"', () => {
    expect(ungroupAction.id).toBe('ungroup');
    expect(ungroupAction.label).toBe('Ungroup');
  });

  it('defaultBinding = { kind: "key", key: "g", mods: { mod: true, shift: true } }', () => {
    expect(ungroupAction.defaultBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true, shift: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(ungroupAction.invoker?.timing).toBe('immediate');
  });
});

// ---------------------------------------------------------------------------
// Behavior tests
// ---------------------------------------------------------------------------

type Layer = 'main';
interface Data { label?: string }

function makeScene() {
  return createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
}

/** Minimal selection stub backed by a mutable id list. */
function makeSelection(ids: NodeId[]) {
  let current = [...ids];
  return {
    get: () => [...current],
    set: (next: NodeId[]) => { current = [...next]; },
    current,
  };
}

describe('groupAction.run', () => {
  it('wraps a same-layer 2-node selection in a container holding both ids in order, with the union AABB pose', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    const sel = selection.get();
    expect(sel).toHaveLength(1);
    const containerId = sel[0]!;
    const container = scene.get(containerId)!;
    expect(container.kind).toBe('container');
    expect(scene.childrenOf(containerId)).toEqual([a, b]);
    expect(container.pose).toEqual({ x: 0, y: 0, width: 30, height: 40 });
  });

  it('leaves member poses unchanged (absolute-pose model)', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    const selection = makeSelection([a, b]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.get(a)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(scene.get(b)!.pose).toEqual({ x: 20, y: 30, width: 10, height: 10 });
  });

  it('no-ops on an empty selection (no nodes added)', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const before = scene.nodes.size;
    const selection = makeSelection([]);

    (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.nodes.size).toBe(before);
    expect(selection.get()).toEqual([]);
  });
});
