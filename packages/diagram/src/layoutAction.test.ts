import { describe, it, expect } from 'vitest';
import { createScene, type InvocationCtx, type Scene } from '@weasel-js/core';
import { buildGraph } from './graph';
import { layered } from './layered';
import { planOf } from './layout';
import { LAYOUTS, applyLayout, createLayoutAction } from './layoutAction';
import { sceneParticipants } from './portLayer';
import { routesOf } from './routeWrites';

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
      id: id as never, kind: id === 'b' ? 'group' : 'mark', layer: 'main',
      pose: { ...START[id]!, width: 100, height: 40 }, data: { diagram: {} },
    });
  }
  for (const [from, to] of [['a', 'b'], ['b', 'c']]) {
    scene.add({
      kind: 'mark', layer: 'main',
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
      kind: 'mark', layer: 'main', parent: 'b' as never,
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

describe('routes', () => {
  /** `chain()` plus `a → c`, which spans `b`'s rank, and a label on it. */
  function spanning(): { scene: Scene<Data, 'main', Rect>; long: string; label: string } {
    const scene = chain();
    const long = scene.add({
      kind: 'mark', layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {} } },
      dependsOn: ['a', 'c'] as never,
    });
    const label = scene.add({
      kind: 'mark', layer: 'main',
      pose: { x: 0, y: 0, width: 60, height: 16 },
      data: { diagram: { label: { at: 'mid' } } },
      dependsOn: [long] as never,
    });
    return { scene, long, label };
  }
  const lay = (scene: Scene<Data, 'main', Rect>): number => {
    const graph = graphOf(scene);
    const plan = planOf(layered, graph);
    return applyLayout(scene, plan.moves, { routes: routesOf(graph, plan) });
  };
  const trait = (scene: Scene<Data, 'main', Rect>, id: string) =>
    (scene.get(id as never)!.data as { diagram: Record<string, unknown> }).diagram;
  /** Halfway along the label's rank, between the route's first two waypoints. */
  const roomOf = (scene: Scene<Data, 'main', Rect>, long: string) => {
    const [a, b] = trait(scene, long)['waypoints'] as { x: number; y: number }[];
    return { near: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 } };
  };

  it('routes a long edge round the rank it crosses, and marks the route layout\'s', () => {
    const { scene, long } = spanning();
    lay(scene);
    const edge = trait(scene, long);
    // Two a rank: the label's, then `b`'s.
    expect(edge['waypoints']).toHaveLength(4);
    expect(edge['laidOut']).toEqual(edge['waypoints']);
    // Beside `b`, not through it.
    const b = scene.get('b' as never)!.pose;
    const x = (edge['waypoints'] as { x: number }[])[2]!.x;
    expect(x < b.x || x > b.x + b.width).toBe(true);
  });

  it('stations the label in the room left for it', () => {
    const { scene, long, label } = spanning();
    lay(scene);
    expect(trait(scene, label)['label']).toEqual({ at: roomOf(scene, long) });
  });

  it('writes nothing on a second run', () => {
    const { scene } = spanning();
    lay(scene);
    const settled = scene.historyEntries().length;
    expect(lay(scene)).toBe(0);
    expect(scene.historyEntries().length).toBe(settled);
  });

  it('leaves a route someone edited, and the label on it, alone', () => {
    const { scene, long, label } = spanning();
    lay(scene);
    const room = roomOf(scene, long);
    const mine = [{ x: -400, y: 0 }];
    scene.update(long as never, { data: { diagram: { ...trait(scene, long), waypoints: mine } } });
    scene.setPose('a' as never, { x: 900, y: 900, width: 100, height: 40 });
    lay(scene);
    expect(trait(scene, long)['waypoints']).toEqual(mine);
    expect(trait(scene, label)['label']).toEqual({ at: room });
  });

  it('takes its route back off an edge that no longer spans a rank', () => {
    const { scene, long, label } = spanning();
    lay(scene);
    // Without `b → c`, `c` sits a rank after `a`; without its label, `a → c`
    // gets no rank of the label's own between them, and spans nothing.
    scene.remove(scene.renderOrderNodes().find((n) => {
      const deps = (n as { dependsOn?: unknown }).dependsOn;
      return Array.isArray(deps) && deps[0] === 'b' && deps[1] === 'c';
    })!.id);
    scene.remove(label as never);
    lay(scene);
    expect(trait(scene, long)['waypoints']).toBeUndefined();
    expect(trait(scene, long)['laidOut']).toBeUndefined();
  });

  it('leaves a locked layer alone rather than throwing', () => {
    const { scene, long } = spanning();
    scene.setLayerLocked('main', true);
    expect(lay(scene)).toBe(0);
    expect(trait(scene, long)['waypoints']).toBeUndefined();
    expect(scene.get('a' as never)!.pose).toMatchObject(START['a']!);
  });

  it('takes layered\'s routes back when a layout that routes nothing runs', () => {
    const { scene, long, label } = spanning();
    lay(scene);
    const graph = graphOf(scene);
    const plan = planOf(LAYOUTS['tree']!, graph);
    applyLayout(scene, plan.moves, { routes: routesOf(graph, plan) });
    expect(trait(scene, long)['waypoints']).toBeUndefined();
    expect(trait(scene, long)['laidOut']).toBeUndefined();
    expect(trait(scene, label)['label']).toEqual({ at: 'mid' });
  });

  it('stations only the first label on an edge, the one it left room for', () => {
    const { scene, long, label } = spanning();
    const second = scene.add({
      kind: 'mark', layer: 'main',
      pose: { x: 0, y: 0, width: 60, height: 16 },
      data: { diagram: { label: { at: 'mid' } } },
      dependsOn: [long] as never,
    });
    lay(scene);
    expect(trait(scene, label)['label']).toEqual({ at: roomOf(scene, long) });
    expect(trait(scene, second)['label']).toEqual({ at: 'mid' });
  });

  it('leaves an edge someone routed out of the ranks it crosses, so a re-run moves nothing', () => {
    // `s → t` is bent by hand at x 500, between `l` at 0 and `r` at 1000 in
    // the rank it crosses. Placement packs `r` in toward `l`, past 500, so a
    // bend counted as the edge's place there would reorder the next run.
    const scene = createScene<Data, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
    const at = { s: [500, 0], l: [0, 200], r: [1000, 200], t: [500, 400] } as const;
    for (const [id, [x, y]] of Object.entries(at)) {
      scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: { x, y, width: 100, height: 40 }, data: { diagram: {} } });
    }
    const edge = (from: string, to: string, waypoints?: { x: number; y: number }[]) => scene.add({
      kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, ...(waypoints ? { waypoints } : {}) } },
      dependsOn: [from, to] as never,
    });
    edge('s', 'l'); edge('s', 'r'); edge('l', 't'); edge('r', 't');
    edge('s', 't', [{ x: 550, y: 200 }, { x: 550, y: 240 }]);
    lay(scene);
    expect(lay(scene)).toBe(0);
  });

  it('leaves a label put at an end where it is', () => {
    const { scene, label } = spanning();
    scene.update(label as never, { data: { diagram: { label: { at: 'end' } } } });
    lay(scene);
    expect(trait(scene, label)['label']).toEqual({ at: 'end' });
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

  it('ships layered, tree, force, chain, and radial under stable keys', () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual(['chain', 'force', 'layered', 'radial', 'tree']);
  });
});
