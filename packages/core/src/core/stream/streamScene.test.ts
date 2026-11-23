import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import type { AddNodeSpec } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { defaultPaintBounds } from 'canvas/defaultDrawOne';
import { sceneSubtreeCull } from 'canvas/reach/sceneVisibility';
import { reachTreeBuildCount } from 'canvas/reach/reachTree';
import { streamScene, type SceneCell, type SceneSource } from './streamScene';

type Data = { fill: unknown };
const CELL = 100;
const PER_CELL = 25;
const DIMS = { width: 800, height: 600 };
const flush = () => new Promise<void>((r) => setImmediate(r));

/** An endless grid: every cell holds 25 rects, made on request. */
function endless(): SceneSource<Data, 'main', RectPose> & { loads: SceneCell[]; inFlight: number; most: number } {
  const src = {
    cellSize: CELL, loads: [] as SceneCell[], inFlight: 0, most: 0,
    load: async (cell: SceneCell, signal: AbortSignal): Promise<AddNodeSpec<Data, 'main', RectPose>[]> => {
      src.loads.push(cell);
      src.inFlight++;
      src.most = Math.max(src.most, src.inFlight);
      await flush();
      src.inFlight--;
      if (signal.aborted) return [];
      return Array.from({ length: PER_CELL }, (_, i) => ({
        id: asNodeId(`c${cell.x}_${cell.y}_${i}`), kind: 'mark' as const, layer: 'main' as const,
        pose: { x: cell.box[0] + (i % 5) * 20, y: cell.box[1] + Math.floor(i / 5) * 20, width: 12, height: 12 },
        data: { fill: { paint: { kind: 'solid', color: 'red' } } },
      }));
    },
  };
  return src;
}

describe('a streamed scene', () => {
  it('pans across an endless world with no undo history, a bounded scene, and no index rebuild', async () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const source = endless();
    const stream = streamScene(scene, source, { maxConcurrent: 4, maxCells: 200 });
    const view = (i: number) => ({ x: i * 37, y: i * 11, scale: { x: 1, y: 1 } });
    // Let the first view load, and the visibility index build once over it.
    for (let k = 0; k < 40; k++) {
      stream.update(view(0), DIMS);
      await flush();
    }
    const cull = () => sceneSubtreeCull(scene, defaultPaintBounds as never, { x: 0, y: 0, ...DIMS })?.((() => view(0)) as never, new Set(['main']));
    expect(scene.nodes.size).toBeGreaterThanOrEqual(512);
    cull();
    const builds = reachTreeBuildCount();
    for (let i = 1; i < 400; i++) {
      stream.update(view(i), DIMS);
      await flush();
      cull();
      expect(scene.canUndo()).toBe(false);
      expect(source.most).toBeLessThanOrEqual(4);
    }
    // 400 frames past 14,000 world units: far more cells than it may hold.
    expect(source.loads.length).toBeGreaterThan(300);
    expect(stream.stats().cells).toBeLessThanOrEqual(200);
    expect(scene.nodes.size).toBeLessThanOrEqual(200 * PER_CELL);
    expect(scene.nodes.size).toBe(stream.stats().nodes);
    expect(reachTreeBuildCount()).toBe(builds);
    expect(scene.historyEntries()).toEqual([]);
    stream.dispose();
    expect(scene.nodes.size).toBe(0);
  });

  it('keeps a node a recorded edit touched past its cell\'s drop, so undo finds it', async () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const stream = streamScene(scene, endless(), { maxConcurrent: 4, maxCells: 4, margin: 0 });
    for (let k = 0; k < 20; k++) {
      stream.update({ x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
      await flush();
    }
    const id = asNodeId('c0_0_0');
    expect(scene.get(id)).toBeDefined();
    scene.setPose(id, { x: 3, y: 3, width: 12, height: 12 });
    expect(scene.canUndo()).toBe(true);
    // Far away, past the cell bound: cell 0/0 is dropped.
    for (let k = 0; k < 20; k++) {
      stream.update({ x: 50_000, y: 50_000, scale: { x: 1, y: 1 } }, DIMS);
      await flush();
    }
    expect(scene.get(asNodeId('c0_0_1'))).toBeUndefined();
    expect(() => scene.undo()).not.toThrow();
    expect(scene.get(id)?.pose).toEqual({ x: 0, y: 0, width: 12, height: 12 });
    stream.dispose();
  });

  /** A source whose cell 0/0 answers `specs`, and every other cell nothing. */
  const oneCell = (specs: () => AddNodeSpec<Data, 'main', RectPose>[]): SceneSource<Data, 'main', RectPose> => ({
    cellSize: CELL,
    load: async (cell) => (cell.x === 0 && cell.y === 0 ? specs() : []),
  });
  const box = { x: 0, y: 0, width: 12, height: 12 };
  const fill = { fill: { paint: { kind: 'solid', color: 'red' } } };
  const settle = async (stream: ReturnType<typeof streamScene>, x: number) => {
    for (let k = 0; k < 20; k++) {
      stream.update({ x, y: x, scale: { x: 1, y: 1 } }, DIMS);
      await flush();
    }
  };

  it('keeps a streamed group past its cell\'s drop when an edited node sits under it', async () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const stream = streamScene(scene, oneCell(() => [
      { id: asNodeId('p'), kind: 'group', layer: 'main', pose: box, data: fill },
      { id: asNodeId('c'), kind: 'mark', layer: 'main', parent: asNodeId('p'), pose: box, data: fill },
      { id: asNodeId('d'), kind: 'mark', layer: 'main', pose: box, data: fill },
    ]), { maxCells: 1, margin: 0 });
    await settle(stream, 0);
    scene.setPose(asNodeId('c'), { ...box, x: 5 });
    const added = scene.add({ id: asNodeId('u'), kind: 'mark', layer: 'main', pose: box, data: fill, dependsOn: [asNodeId('d')] });
    await settle(stream, 50_000);
    expect(scene.get(asNodeId('c'))?.pose).toEqual({ ...box, x: 5 });
    expect(scene.get(asNodeId('p'))).toBeDefined();
    expect(scene.get(asNodeId('d'))).toBeDefined();
    expect(scene.get(added)).toBeDefined();
    expect(stream.stats().nodes).toBe(0);
    scene.undo();
    scene.undo();
    expect(scene.get(asNodeId('c'))?.pose).toEqual(box);
    stream.dispose();
  });

  it('keeps the group an edited node was removed from, so undoing the removal finds it', async () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const stream = streamScene(scene, oneCell(() => [
      { id: asNodeId('p'), kind: 'group', layer: 'main', pose: box, data: fill },
      { id: asNodeId('c'), kind: 'mark', layer: 'main', parent: asNodeId('p'), pose: box, data: fill },
    ]), { maxCells: 1, margin: 0 });
    await settle(stream, 0);
    scene.remove(asNodeId('c'));
    await settle(stream, 50_000);
    expect(() => scene.undo()).not.toThrow();
    expect(scene.get(asNodeId('c'))?.parent).toBe(asNodeId('p'));
    stream.dispose();
  });

  it('takes back what a cell added before its load threw', async () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const errors: unknown[] = [];
    const twice = { id: asNodeId('x'), kind: 'mark' as const, layer: 'main' as const, pose: box, data: fill };
    const stream = streamScene(scene, oneCell(() => [twice, twice]), { maxCells: 1, margin: 0, onError: (_c, e) => errors.push(e) });
    await settle(stream, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(scene.get(asNodeId('x'))).toBeUndefined();
    expect(scene.canUndo()).toBe(false);
    stream.dispose();
  });
});
