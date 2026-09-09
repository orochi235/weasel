import { describe, it, expect } from 'vitest';
import { createScene, type InvocationCtx, type Scene } from '@weasel-js/core';
import { buildGraph } from './graph';
import { layered } from './layered';
import { LAYOUTS, applyLayout, createLayoutAction } from './layoutAction';
import { sceneParticipants } from './portLayer';

interface Data { diagram?: unknown }
interface Rect { x: number; y: number; width: number; height: number; rotation?: number }

/** Where `chain` starts: scattered, so a layout has all three to move. */
const START: Readonly<Record<string, { x: number; y: number }>> = {
  a: { x: 500, y: 300 },
  b: { x: 0, y: 0 },
  c: { x: 900, y: 100 },
};

/** `a → b → c`. */
function chain(): Scene<Data, 'main', Rect> {
  const scene = createScene<Data, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  for (const id of ['a', 'b', 'c']) {
    scene.add({
      // `b` is a container so the cascade has something to carry.
      id: id as never, kind: id === 'b' ? 'container' : 'leaf', layer: 'main',
      pose: { ...START[id]!, width: 100, height: 40 }, data: { diagram: {} },
    });
  }
  for (const [from, to] of [['a', 'b'], ['b', 'c']]) {
    scene.add({
      kind: 'leaf', layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {} } },
      dependsOn: [from, to] as never,
    });
  }
  return scene;
}

const graphOf = (scene: Scene<Data, 'main', Rect>) =>
  buildGraph<Rect>(sceneParticipants(scene as never));

describe('applyLayout', () => {
  it('moves the whole diagram in one undo entry', () => {
    const scene = chain();
    const before = scene.historyEntries().length;
    expect(applyLayout(scene, layered(graphOf(scene)))).toBe(3);
    expect(scene.historyEntries().length).toBe(before + 1);

    const laid = ['a', 'b', 'c'].map((id) => scene.get(id as never)!.pose.y);
    expect(scene.undo()).toBe(true);
    expect(['a', 'b', 'c'].map((id) => scene.get(id as never)!.pose.y))
      .toEqual(['a', 'b', 'c'].map((id) => START[id]!.y));
    expect(laid[2]).toBeGreaterThan(laid[0]!);
  });

  it('writes nothing at all when the layout has nothing to do', () => {
    const scene = chain();
    applyLayout(scene, layered(graphOf(scene)));
    const settled = scene.historyEntries().length;
    expect(applyLayout(scene, layered(graphOf(scene)))).toBe(0);
    expect(scene.historyEntries().length).toBe(settled);
  });

  it('translates a pose rather than replacing it', () => {
    const scene = chain();
    scene.setPose('b' as never, { ...START['b']!, width: 100, height: 40, rotation: 0.5 });
    applyLayout(scene, layered(graphOf(scene)));
    const b = scene.get('b' as never)!.pose;
    expect(b.rotation).toBe(0.5);
    expect([b.width, b.height]).toEqual([100, 40]);
  });

  // `setPose` is absolute and does not cascade, so a built body would walk out
  // from under its own label rows — invisibly, since nothing about the rows is
  // wrong on their own.
  it('takes a container\'s children along with it', () => {
    const scene = chain();
    const label = scene.add({
      kind: 'leaf', layer: 'main', parent: 'b' as never,
      pose: { x: START['b']!.x + 10, y: START['b']!.y + 10, width: 30, height: 12 },
      data: {},
    });
    const before = scene.get(label)!.pose;
    applyLayout(scene, layered(graphOf(scene)));
    const b = scene.get('b' as never)!.pose;
    expect(scene.get(label)!.pose.x - b.x).toBe(before.x - START['b']!.x);
    expect(scene.get(label)!.pose.y - b.y).toBe(before.y - START['b']!.y);
  });

  it('skips an id the scene no longer holds', () => {
    const scene = chain();
    const result = new Map([['gone', { x: 10, y: 10 }], ['a', { x: 10, y: 10 }]]);
    expect(applyLayout(scene, result)).toBe(1);
  });
});

describe('createLayoutAction', () => {
  const run = (action: ReturnType<typeof createLayoutAction>, scene: unknown): void => {
    const invoker = action.invoker as { run: (deps: InvocationCtx['deps']) => void };
    invoker.run({ scene } as InvocationCtx['deps']);
  };

  it('lays the scene out through the named algorithm', () => {
    const scene = chain();
    run(createLayoutAction<Rect>({
      source: sceneParticipants(scene as never),
      algorithm: 'tree',
    }), scene);
    expect(scene.get('c' as never)!.pose.y).toBeGreaterThan(scene.get('a' as never)!.pose.y);
  });

  it('takes a layout of the consumer\'s own', () => {
    const scene = chain();
    run(createLayoutAction<Rect>({
      source: sceneParticipants(scene as never),
      algorithm: () => new Map([['a', { x: 42, y: 99 }]]),
    }), scene);
    expect(scene.get('a' as never)!.pose).toMatchObject({ x: 42, y: 99 });
  });

  it('does nothing without a scene dep', () => {
    const scene = chain();
    const action = createLayoutAction<Rect>({ source: sceneParticipants(scene as never) });
    expect(() => run(action, undefined)).not.toThrow();
    expect(scene.get('a' as never)!.pose.y).toBe(START['a']!.y);
  });

  it('ships layered, tree and force under stable keys', () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual(['force', 'layered', 'tree']);
  });
});
