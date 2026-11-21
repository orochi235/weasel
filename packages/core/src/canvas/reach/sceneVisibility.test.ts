import { describe, expect, it, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { DrawCommand } from '@weasel-js/renderer';
import { buildSceneViewCommands } from '../sceneViewRender';
import { defaultDrawOne, defaultPaintBounds } from '../defaultDrawOne';
import { __withoutSubtreeCullForTest } from './sceneVisibility';
import { buildSceneLayers } from '../buildSceneLayer';
import { wireSceneSlotToScene } from '../sceneSlotWiring';
import { sceneToAdapter } from '../sceneAdapter';
import { translate } from '@weasel-js/geom';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };
type Data = { shape?: 'rect'; stroke?: unknown; background?: unknown };
type Layer = 'a' | 'b';
type S = Scene<Data, Layer, Pose>;

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STROKE = { paint: { color: '#000000' }, width: { px: 3 } };

/** Commands as JSON, with every group that holds nothing painted left out: the walk drops those for a pruned subtree. */
function painted(cmds: readonly DrawCommand[]): string {
  const strip = (c: DrawCommand): DrawCommand | null => {
    if (c.kind !== 'group') return c;
    const children = c.children.map(strip).filter((x): x is DrawCommand => x !== null);
    return children.length === 0 && !c.effects ? null : { ...c, children };
  };
  return JSON.stringify(cmds.map(strip).filter((x) => x !== null), (_k, v: unknown) => (v instanceof Float64Array || v instanceof Float32Array ? [...v] : v));
}

function frame(scene: S, view: { x: number; y: number; scale: { x: number; y: number } }) {
  const drawOne = vi.fn(defaultDrawOne) as unknown as typeof defaultDrawOne;
  const cmds = buildSceneViewCommands(scene, view, drawOne, undefined, undefined, undefined, undefined,
    { width: 400, height: 300, dpr: 1, paintBounds: defaultPaintBounds });
  const ids = (drawOne as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([n]) => (n as { id: string }).id);
  return { cmds: painted(cmds), ids };
}

/** The same frame through the scene slot: one canvas layer per scene layer, each walking for its own. */
function slotFrame(scene: S, view: { x: number; y: number; scale: { x: number; y: number } }): string {
  const cfg = wireSceneSlotToScene({ drawOne: defaultDrawOne, cull: true, paintBounds: defaultPaintBounds }, scene);
  const layers = buildSceneLayers(cfg as never, sceneToAdapter(scene) as never, undefined, () => null);
  return painted(layers.flatMap(({ layer }) => layer.draw(undefined, view, { width: 400, height: 300, dpr: 1 }) as DrawCommand[]));
}

interface Variant { parallax?: boolean; copies?: boolean }

/** A random tree: wide roots, one wide group, nested groups, some painting a box, some marks stroked. */
function randomScene(rand: () => number, variant: Variant = {}): { scene: S; ids: NodeId[]; groups: NodeId[] } {
  const scene = createScene<Data, Layer, Pose>({
    systemLayers: [{ id: 'a' }, { id: 'b', ...(variant.parallax ? { parallax: { pan: 0.5, zoom: 0.8 } } : {}) }],
  });
  const ids: NodeId[] = [];
  const groups: NodeId[] = [];
  const pose = (): Pose => ({
    x: Math.round(rand() * 4000 - 2000), y: Math.round(rand() * 4000 - 2000),
    width: 5 + Math.round(rand() * 80), height: 5 + Math.round(rand() * 80),
    ...(rand() < 0.1 ? { rotation: rand() * 6 } : {}),
  });
  for (let i = 0; i < 700; i++) {
    const parent = groups.length > 0 && rand() < 0.6 ? groups[Math.floor(rand() * Math.min(groups.length, 6))] : undefined;
    // A child may not paint below its parent's layer.
    const layer = (): Layer => (rand() < 0.3 || (parent && scene.get(parent)!.layer === 'b') ? 'b' : 'a');
    if (rand() < 0.08) {
      const copied = variant.copies && rand() < 0.3 ? { copiesFromPose: () => [translate(700, -300)] } : {};
      const g = scene.add({ kind: 'group', layer: layer(), pose: pose(), data: rand() < 0.4 ? { background: { paint: { color: '#ff0000' } } } : {}, ...(parent ? { parent } : {}), ...copied });
      groups.push(g);
      ids.push(g);
    } else {
      ids.push(scene.add({ kind: 'mark', layer: layer(), pose: pose(), data: { shape: 'rect', ...(rand() < 0.3 ? { stroke: STROKE } : {}) }, ...(parent ? { parent } : {}) }));
    }
  }
  return { scene, ids, groups };
}

function randomView(rand: () => number) {
  const s = 0.05 + rand() * 3;
  return { x: rand() * 3000 - 1500, y: rand() * 3000 - 1500, scale: { x: s, y: s } };
}

function edit(scene: S, ids: NodeId[], groups: NodeId[], rand: () => number): void {
  const live = ids.filter((id) => scene.get(id) !== undefined);
  const pick = () => live[Math.floor(rand() * live.length)]!;
  const r = rand();
  if (r < 0.4) {
    const id = pick();
    const p = scene.get(id)!.pose;
    scene.setPose(id, { ...p, x: p.x + (rand() - 0.5) * 3000, y: p.y + (rand() - 0.5) * 3000 });
  } else if (r < 0.55) {
    const id = pick();
    const p = scene.get(id)!.pose;
    scene.overrides.set(id, { pose: { ...p, x: p.x + 500 } });
  } else if (r < 0.65) {
    scene.remove(pick());
  } else if (r < 0.8) {
    const parent = groups.find((g) => scene.get(g) !== undefined);
    ids.push(scene.add({ kind: 'mark', layer: 'a', pose: { x: rand() * 400, y: rand() * 300, width: 10, height: 10 }, data: { shape: 'rect' }, ...(parent && rand() < 0.5 ? { parent } : {}) }));
  } else if (r < 0.9) {
    const id = pick();
    const to = groups.find((g) => scene.get(g) !== undefined && g !== id && !scene.ancestorsOf(g).includes(id));
    scene.move(id, rand() < 0.5 || to === undefined ? null : to);
  } else if (r < 0.92) {
    scene.setLayer(pick(), rand() < 0.5 ? 'a' : 'b');
  } else if (r < 0.96) {
    const id = pick();
    scene.reorder(id, Math.floor(rand() * 40));
  } else {
    const g = groups.find((x) => scene.get(x) !== undefined);
    if (g) scene.scroll!.set(g, { x: (rand() - 0.5) * 800, y: (rand() - 0.5) * 800 });
  }
}

describe('render visibility: a pruned walk paints what the full walk paints', () => {
  const variants: [string, Variant][] = [['plain', {}], ['a parallax layer', { parallax: true }], ['copying containers', { copies: true }]];
  for (let seed = 1; seed <= 12; seed++) {
    const [name, variant] = variants[seed % variants.length]!;
    it(`seed ${seed}, ${name}, through 30 edits`, () => {
      const rand = seeded(seed);
      const { scene, ids, groups } = randomScene(rand, variant);
      for (let step = 0; step < 30; step++) {
        const view = randomView(rand);
        const pruned = frame(scene, view);
        const full = __withoutSubtreeCullForTest(() => frame(scene, view));
        expect(pruned.cmds).toBe(full.cmds);
        // The full walk also calls the painters of nodes whose paint nothing bounds and that paint nothing here.
        expect(full.ids).toEqual(expect.arrayContaining(pruned.ids));
        expect(slotFrame(scene, view)).toBe(__withoutSubtreeCullForTest(() => slotFrame(scene, view)));
        try {
          edit(scene, ids, groups, rand);
        } catch (err) {
          // An edit the scene refuses changes nothing.
          if (!/may not render below/.test(String(err))) throw err;
        }
      }
    });
  }

  it('walks only what can reach the view of a wide, flat scene', () => {
    const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'a' }, { id: 'b' }] });
    for (let i = 0; i < 2000; i++) {
      scene.add({ kind: 'mark', layer: 'a', pose: { x: (i % 50) * 100, y: Math.floor(i / 50) * 100, width: 50, height: 50 }, data: { shape: 'rect' } });
    }
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const pruned = frame(scene, view);
    // 400×300 over a 100-pitch grid: 4 columns by 3 rows, and the edge ones.
    expect(pruned.ids.length).toBeLessThanOrEqual(5 * 4);
    expect(pruned.cmds).toBe(__withoutSubtreeCullForTest(() => frame(scene, view)).cmds);
  });

  it('paints a node moved, box unchanged, into a container already wide enough to index its children', () => {
    const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'a' }, { id: 'b' }] });
    for (let i = 0; i < 600; i++) {
      scene.add({ kind: 'mark', layer: 'a', pose: { x: 5000 + i * 10, y: 5000, width: 5, height: 5 }, data: { shape: 'rect' } });
    }
    const g = scene.add({ kind: 'group', layer: 'a', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    for (let i = 0; i < 100; i++) {
      scene.add({ kind: 'mark', layer: 'a', parent: g, pose: { x: 3000 + i * 10, y: 3000, width: 5, height: 5 }, data: { shape: 'rect' } });
    }
    const n = scene.add({ kind: 'mark', layer: 'a', pose: { x: 50, y: 50, width: 20, height: 20 }, data: { shape: 'rect' } });
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(frame(scene, view).ids).toContain(n);
    scene.move(n, g);
    expect(frame(scene, view).ids).toContain(n);
  });
});
