/**
 * `<SceneCanvas worker>`: the scene layers paint from a worker, the layers below and above them
 * on the page, each run its own canvas in one stack; picking reads the worker's frame a round
 * trip away.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas, asNodeId, createScene, scenePickIds, type SceneCanvasApi } from '@weasel-js/core';

type Pose = { x: number; y: number; width: number; height: number };
const solid = (color: string) => ({ fill: { paint: { kind: 'solid' as const, color } } });
const rectLayer = (id: string, color: string, r: Pose) => ({
  id, label: id,
  draw: () => [{ kind: 'path' as const, path: { kind: 'rect' as const, ...r }, ...solid(color) }],
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function pixel(api: SceneCanvasApi, x: number, y: number): Promise<number[] | null> {
  const bitmap = await api.worker!.snapshot();
  if (!bitmap) return null;
  const c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
  c.drawImage(bitmap, 0, 0);
  return [...c.getImageData(x, y, 1, 1).data];
}

async function until(api: SceneCanvasApi, x: number, y: number, rgb: number[]): Promise<number[] | null> {
  let last: number[] | null = null;
  for (let i = 0; i < 300; i++) {
    last = await pixel(api, x, y);
    if (last && rgb.every((c, k) => Math.abs(last![k]! - c) <= 8) && last[3]! > 240) return last;
    await frame();
  }
  return last;
}

/** Wait, a frame at a time, until the node the page's numbering names at (x, y) is `want`. */
async function pickedUntil(api: SceneCanvasApi, scene: object, x: number, y: number, want: string | null) {
  let last: string | null = null;
  for (let i = 0; i < 300; i++) {
    last = scenePickIds(scene).nodeOf(await api.pickAt(x, y));
    if (last === want) return last;
    await frame();
  }
  return last;
}

function mount(layers: Record<string, unknown>, sceneLayers: string[] = ['main'], before?: (scene: object) => void) {
  const scene = createScene<ReturnType<typeof solid>, string, Pose>({
    systemLayers: sceneLayers.map((id) => ({ id })),
    initial: sceneLayers.map((layer, i) => ({
      id: asNodeId(`n${i}`), kind: 'mark' as const, layer, pose: { x: 10 + 40 * i, y: 10, width: 30, height: 30 }, data: solid('#ff0000'),
    })),
  });
  before?.(scene);
  let started = 0;
  const start = () => {
    started++;
    return new Worker(new URL('./testing/sceneRender.worker.ts', import.meta.url), { type: 'module' });
  };
  const ref = createRef<SceneCanvasApi>();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(SceneCanvas<ReturnType<typeof solid>, string, Pose>, {
    scene, width: 100, height: 50, dpr: 1, worker: start, ref, layers: layers as never,
  })));
  return { scene, ref, canvases: () => [...host!.querySelectorAll('canvas')], started: () => started };
}

describe('a scene canvas painted partly by a worker', () => {
  it('stacks a page canvas under the scene and one over it, and composes all three', async () => {
    const { ref, canvases, started } = mount({
      under: { layer: rectLayer('under', '#0000ff', { x: 0, y: 0, width: 100, height: 50 }), before: 'scene' },
      over: { layer: rectLayer('over', '#00ff00', { x: 30, y: 30, width: 10, height: 10 }), after: 'scene' },
    });
    const api = ref.current!;
    expect(api.worker).not.toBeNull();
    expect(canvases()).toHaveLength(3);
    expect(started()).toBe(1);
    // The middle canvas is the worker's: the page cannot open a context on it.
    expect(() => canvases()[1]!.getContext('2d')).toThrow();
    expect(await until(api, 20, 20, [255, 0, 0])).toEqual([255, 0, 0, 255]);
    expect(await until(api, 35, 35, [0, 255, 0])).toEqual([0, 255, 0, 255]);
    expect(await until(api, 80, 40, [0, 0, 255])).toEqual([0, 0, 255, 255]);
  });

  it('picks the worker-painted node a round trip away, and answers a synchronous read with null', async () => {
    const { ref } = mount({
      over: { layer: rectLayer('over', '#00ff00', { x: 60, y: 30, width: 10, height: 10 }), after: 'scene' },
    });
    const api = ref.current!;
    expect(await until(api, 20, 20, [255, 0, 0])).toEqual([255, 0, 0, 255]);
    const node = await api.pickAt(20, 20);
    expect(node).not.toBe(0);
    expect(await api.pickAt(90, 45)).toBe(0);
    const ids = await api.readIds({ x: 10, y: 10, width: 80, height: 1 });
    expect(new Set(ids.data)).toEqual(new Set([node, 0]));
    expect(api.readIdsSync({ x: 20, y: 20, width: 0, height: 0 })).toBeNull();
  });

  it('picks in the page\'s numbering across workers, and after an insert and a remove', async () => {
    const { ref, scene } = mount({
      mid: { layer: rectLayer('mid', '#00ff00', { x: 0, y: 45, width: 100, height: 5 }), after: 'scene:a' },
    }, ['a', 'b'], (s) => { scenePickIds(s).idOf('n1'); });
    const api = ref.current!;
    expect(await pickedUntil(api, scene, 20, 20, 'n0')).toBe('n0');
    expect(await pickedUntil(api, scene, 60, 20, 'n1')).toBe('n1');
    scene.add({ id: asNodeId('n2'), kind: 'mark', layer: 'b', pose: { x: 85, y: 10, width: 10, height: 30 }, data: solid('#ff0000') });
    expect(await pickedUntil(api, scene, 90, 20, 'n2')).toBe('n2');
    scene.remove(asNodeId('n0'));
    expect(await pickedUntil(api, scene, 20, 20, null)).toBeNull();
    expect(scenePickIds(scene).nodeOf(await api.pickAt(60, 20))).toBe('n1');
    expect(scenePickIds(scene).nodeOf(await api.pickAt(90, 20))).toBe('n2');
  });

  it('gives each part of a scene cut by a page layer a worker of its own', async () => {
    const { ref, canvases, started } = mount({
      mid: { layer: rectLayer('mid', '#00ff00', { x: 0, y: 0, width: 100, height: 50 }), after: 'scene:a' },
    }, ['a', 'b']);
    const api = ref.current!;
    expect(canvases()).toHaveLength(4);
    expect(started()).toBe(2);
    // Scene layer a sits under the page's green; scene layer b paints over it.
    expect(await until(api, 20, 20, [0, 255, 0])).toEqual([0, 255, 0, 255]);
    expect(await until(api, 60, 20, [255, 0, 0])).toEqual([255, 0, 0, 255]);
  });
});
