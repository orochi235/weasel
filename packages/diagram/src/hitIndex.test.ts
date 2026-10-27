/**
 * The port and edge-label layers hit-tested through their indexes answer
 * exactly what testing every region answers, over randomized scenes, views
 * and chrome states, and stop reading every participant once the index holds.
 */
import { describe, expect, it } from 'vitest';
import { createScene, documentPose, type ChromeState, type Scene, type View } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import { edgeLabelSpec } from './edgeLabel';
import { labelDragLayer, labelUnder } from './labelDragLayer';
import { portLayer, sceneParticipants } from './portLayer';
import type { ParticipantSource } from './portAffordance';

interface Rect { x: number; y: number; width: number; height: number; rotation?: number }
type Sc = Scene<unknown, 'back' | 'main', Rect>;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Diagram nodes on a coarse grid, so ports and labels often coincide, some turned, hidden, locked or on the back
 *  layer, joined by labeled edges. */
function diagram(seed: number): Sc {
  const r = rng(seed);
  const scene = createScene<unknown, 'back' | 'main', Rect>({ systemLayers: [{ id: 'back' }, { id: 'main' }] });
  const grid = (n: number) => Math.round(r() * n) * 20;
  for (let i = 0; i < 150; i++) {
    const pose: Rect = { x: grid(40), y: grid(40), width: 20 + grid(5), height: 20 + grid(3) };
    if (i % 5 === 0) pose.rotation = r() * Math.PI;
    scene.add({ id: `n${i}` as never, kind: 'mark', layer: i % 6 === 0 ? 'back' : 'main', pose, data: { diagram: {} } });
  }
  for (let i = 0; i < 60; i++) {
    const [a, b] = [`n${Math.floor(r() * 150)}`, `n${Math.floor(r() * 150)}`];
    if (a === b) continue;
    scene.add({
      id: `e${i}` as never, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: { nodeId: a }, to: { nodeId: b }, router: 'straight' } },
      dependsOn: [a as never, b as never], derivePath: EDGE_DERIVE_PATH as never,
    });
    scene.add(edgeLabelSpec(`e${i}`, 'label'.slice(0, 1 + (i % 5)), { layer: 'main', measure: () => ({ width: 20 + (i % 4) * 15, height: 10 }) }) as never);
  }
  for (const id of ['n3', 'n10', 'e4/label']) scene.setLocked(id as never, true);
  for (const id of ['n7', 'n21', 'e7/label']) scene.setHidden(id as never, true);
  scene.overrides.set('n12' as never, { pose: { x: 410, y: 410, width: 60, height: 40 } });
  scene.overrides.commit();
  return scene;
}

function state(selection: string[], paints: (layer: string) => boolean): ChromeState {
  return {
    selection, multiActive: false, boundsOf: () => null, unionBounds: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    layerIsPainted: paints,
  } as unknown as ChromeState;
}

const VIEWS: View[] = [
  { x: 0, y: 0, scale: { x: 1, y: 1 } },
  { x: 0, y: 0, scale: { x: 3, y: 0.5 } },
  { x: 0, y: 0, scale: { x: 0.2, y: 0.2 } },
] as View[];
const DIMS = { width: 800, height: 800 };

/** Points over the scene, and as many again within a few px of a node box's edge midpoints and corners. */
function points(scene: Sc, seed: number): [number, number][] {
  const r = rng(seed);
  const boxes = scene.renderOrderNodes().map((n) => n.pose).filter((p) => p.width > 0);
  const out: [number, number][] = [];
  for (let i = 0; i < 300; i++) {
    if (i % 2 === 0) {
      out.push([r() * 900 - 50, r() * 900 - 50]);
      continue;
    }
    const b = boxes[Math.floor(r() * boxes.length)]!;
    const fx = [0, 0.5, 1][Math.floor(r() * 3)]!;
    const fy = [0, 0.5, 1][Math.floor(r() * 3)]!;
    out.push([b.x + b.width * fx + (r() * 2 - 1) * 12, b.y + b.height * fy + (r() * 2 - 1) * 12]);
  }
  return out;
}

describe('portLayer through its index', () => {
  for (const seed of [1, 2, 3]) {
    it(`hits what testing every port hits (seed ${seed})`, () => {
      const scene = diagram(seed);
      const src = sceneParticipants(scene);
      let reads = 0;
      const counted: ParticipantSource<Rect> = Object.assign(() => { reads++; return src(); }, { generation: src.generation! });
      const opts = {
        shows: (node: { id: string }, s: ChromeState) => s.selection.length === 0 || s.selection.some((id) => id === node.id) || node.id.endsWith('1'),
        showsPort: (port: { id: string }) => port.id !== 'n',
      };
      const linear = portLayer<Rect>(() => src(), opts);
      const indexed = portLayer<Rect>(counted, opts);
      const states = [
        state([], () => true),
        state(['n2', 'n5', 'n8', 'n40'], (l) => l !== 'back'),
      ];
      let hits = 0;
      for (const [x, y] of points(scene, seed * 7)) {
        for (const view of VIEWS) {
          for (const s of states) {
            const want = linear.hitTest(x, y, s, view, DIMS);
            if (want) hits++;
            expect(indexed.hitTest(x, y, s, view, DIMS), `(${x}, ${y}) at ${view.scale.x}`).toEqual(want);
          }
        }
      }
      // Read once by the first test, which scans, and once to build the index on the second.
      expect(reads).toBe(2);
      expect(hits).toBeGreaterThan(100);
    });
  }

  it('reads a scene change', () => {
    const scene = diagram(4);
    const layer = portLayer<Rect>(sceneParticipants(scene));
    const s = state([], () => true);
    const view = VIEWS[0]!;
    layer.hitTest(0, 0, s, view, DIMS);
    layer.hitTest(0, 0, s, view, DIMS);
    scene.setPose('n0' as never, { x: 1000, y: 1000, width: 40, height: 40 });
    expect(layer.hitTest(1040, 1020, s, view, DIMS)).toMatchObject({ initialScratch: { nodeId: 'n0', portId: 'e' } });
    expect(layer.hitTest(1040, 1020, s, view, DIMS)).toMatchObject({ initialScratch: { nodeId: 'n0', portId: 'e' } });
  });
});

describe('labelDragLayer through its index', () => {
  for (const seed of [1, 2, 3]) {
    it(`hits what testing every label hits (seed ${seed})`, () => {
      const scene = diagram(seed);
      const linearScene = Object.assign(Object.create(scene) as Sc, { getVersion: undefined });
      const linear = labelDragLayer(linearScene as never) as ReturnType<typeof portLayer>;
      const indexed = labelDragLayer(scene as never) as ReturnType<typeof portLayer>;
      const s = state([], () => true);
      const labels = scene.renderOrderNodes().filter((n) => n.id.endsWith('/label'));
      const r = rng(seed);
      // The label poses are derived, so aim at where the scene puts them.
      const aimed = labels.map((n) => {
        const b = documentPose(scene as never, scene.get(n.id) as never) as Rect;
        return [b.x + r() * b.width, b.y + r() * b.height] as [number, number];
      });
      let hits = 0;
      for (const [x, y] of [...points(scene, seed * 11), ...aimed]) {
        const want = linear.hitTest(x, y, s, VIEWS[0]!, DIMS);
        if (want) hits++;
        expect(indexed.hitTest(x, y, s, VIEWS[0]!, DIMS), `(${x}, ${y})`).toEqual(want);
        expect(labelUnder(scene as never, { x, y })).toEqual(labelUnder(linearScene as never, { x, y }));
      }
      expect(hits).toBeGreaterThan(20);
    });
  }
});
