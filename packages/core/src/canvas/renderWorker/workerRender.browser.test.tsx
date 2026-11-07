/**
 * `<SceneViewCanvas worker>` paints its scene from a worker: the canvas is handed over with
 * `transferControlToOffscreen`, and the page sends the worker scene changes, never draw commands.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement, createRef, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneViewCanvas, asNodeId, createScene, type FollowedClock, type WorkerCanvasHandle } from '@weasel-js/core';
import { createClock } from '@weasel-js/clock';
import { bitmapSrc } from '@weasel-js/renderer';

type Pose = { x: number; y: number; width: number; height: number };
const solid = (color: string) => ({ fill: { paint: { kind: 'solid' as const, color } } });
type Data = Record<string, unknown>;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function pixel(handle: WorkerCanvasHandle, x: number, y: number): Promise<number[] | null> {
  const bitmap = await handle.snapshot();
  if (!bitmap) return null;
  const c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
  c.drawImage(bitmap, 0, 0);
  return [...c.getImageData(x, y, 1, 1).data];
}

/** Wait, a frame at a time, until the pixel at (x, y) is `rgb`. */
async function until(handle: WorkerCanvasHandle, x: number, y: number, rgb: number[]): Promise<number[] | null> {
  let last: number[] | null = null;
  for (let i = 0; i < 300; i++) {
    last = await pixel(handle, x, y);
    if (last && rgb.every((c, k) => Math.abs(last![k]! - c) <= 8) && last[3]! > 240) return last;
    await frame();
  }
  return last;
}

interface MountOptions {
  alphaFor?: (id: string) => number;
  clock?: FollowedClock;
  /** Data for the two nodes, `a` at the left and `b` at the right. */
  a?: Data;
  b?: Data;
}

function mount({ alphaFor, clock, a = solid('#ff0000'), b = solid('#00ff00') }: MountOptions = {}) {
  const scene = createScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: asNodeId('a'), kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 30, height: 30 }, data: a },
      { id: asNodeId('b'), kind: 'mark', layer: 'main', pose: { x: 60, y: 10, width: 30, height: 30 }, data: b },
    ],
  });
  const sent: unknown[] = [];
  const start = () => {
    const worker = new Worker(new URL('./testing/sceneRender.worker.ts', import.meta.url), { type: 'module' });
    const post = worker.postMessage.bind(worker) as (m: unknown, t: Transferable[]) => void;
    worker.postMessage = ((m: unknown, t: Transferable[] = []) => { sent.push(m); post(m, t); }) as Worker['postMessage'];
    return worker;
  };
  const handle = createRef<WorkerCanvasHandle>();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(StrictMode, null, createElement(SceneViewCanvas<Data, 'main', Pose>, {
    scene, view: VIEW, width: 100, height: 50, dpr: 1, worker: start, workerRef: handle, alphaFor, clock,
  }))));
  return { scene, sent, handle, canvas: host.querySelector('canvas')! };
}

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const FRAME_KEYS = new Set(['type', 'scene', 'overrides', 'view', 'size', 'layers', 'cull', 'extraCommands', 'scroll', 'alpha']);

describe('a scene view painted by a worker', () => {
  it('draws into the transferred canvas, and the page sends only what changed', async () => {
    const { scene, sent, handle, canvas } = mount();
    expect(await until(handle.current!, 25, 25, [255, 0, 0])).toEqual([255, 0, 0, 255]);
    expect(await until(handle.current!, 75, 25, [0, 255, 0])).toEqual([0, 255, 0, 255]);
    // The page holds no context on the canvas: it was handed to the worker.
    expect(() => canvas.getContext('2d')).toThrow();
    expect(sent.filter((m) => (m as { type: string }).type === 'init')).toHaveLength(1);

    const before = sent.length;
    scene.update(asNodeId('b'), { data: solid('#0000ff') });
    expect(await until(handle.current!, 75, 25, [0, 0, 255])).toEqual([0, 0, 255, 255]);

    const frames = sent.filter((m) => (m as { type: string }).type === 'frame') as Record<string, unknown>[];
    for (const f of frames) {
      for (const key of Object.keys(f)) expect(FRAME_KEYS).toContain(key);
      expect(f.extraCommands ?? null).toBeNull();
    }
    const later = sent.slice(before).filter((m) => (m as { scene?: unknown }).scene) as { scene: { nodes?: { id: string }[]; reset?: unknown } }[];
    expect(later.length).toBeGreaterThan(0);
    for (const f of later) {
      expect(f.scene.reset).toBeUndefined();
      expect(f.scene.nodes!.map((n) => n.id)).toEqual(['b']);
    }
  });

  it('follows a moved node', async () => {
    const { scene, handle } = mount();
    expect(await until(handle.current!, 25, 25, [255, 0, 0])).toEqual([255, 0, 0, 255]);
    scene.setPose(asNodeId('a'), { x: 10, y: 10, width: 10, height: 10 });
    const cleared = await (async () => {
      for (let i = 0; i < 300; i++) {
        const p = await pixel(handle.current!, 25, 25);
        if (p && p[3]! < 16) return p;
        await frame();
      }
      return null;
    })();
    expect(cleared).not.toBeNull();
    expect(await until(handle.current!, 15, 15, [255, 0, 0])).toEqual([255, 0, 0, 255]);
  });

  it('dims a node by the alpha the page computes', async () => {
    const { handle } = mount({ alphaFor: (id) => (id === 'b' ? 0 : 1) });
    expect(await until(handle.current!, 25, 25, [255, 0, 0])).toEqual([255, 0, 0, 255]);
    expect((await pixel(handle.current!, 75, 25))![3]).toBeLessThan(16);
  });

  it('plays a worker animation on the page clock, through seeks forward and back', async () => {
    const clock = createClock({ duration: 1000 });
    const { handle } = mount({ clock, a: { shape: 'rect', ...solid('#ffffff') } });
    expect(await until(handle.current!, 25, 25, [255, 255, 255])).toEqual([255, 255, 255, 255]);
    handle.current!.animator.play('red-to-blue', { id: 'a' });
    clock.clock.sync(0);
    expect(await until(handle.current!, 25, 25, [255, 0, 0])).toEqual([255, 0, 0, 255]);
    clock.clock.seek(500);
    const mid = await (async () => {
      for (let i = 0; i < 300; i++) {
        const p = await pixel(handle.current!, 25, 25);
        if (p && p[0]! < 235 && p[2]! > 20) return p;
        await frame();
      }
      return null;
    })();
    expect(mid![0]).toBeGreaterThan(20);
    expect(mid![2]).toBeLessThan(235);
    // Back short of the start, where the tween would end: it plays backward and keeps running.
    clock.clock.seek(50);
    const back = await (async () => {
      for (let i = 0; i < 300; i++) {
        const p = await pixel(handle.current!, 25, 25);
        if (p && p[0]! > 215 && p[2]! < 40) return p;
        await frame();
      }
      return null;
    })();
    expect(back).not.toBeNull();
    clock.clock.seek(1000);
    expect(await until(handle.current!, 25, 25, [0, 0, 255])).toEqual([0, 0, 255, 255]);
  });

  it('draws a bitmap the page made, under the name the page gave it', async () => {
    const paper = new OffscreenCanvas(8, 8);
    const c = paper.getContext('2d')!;
    c.fillStyle = '#ffff00';
    c.fillRect(0, 0, 8, 8);
    const made = paper.transferToImageBitmap();
    const { handle } = mount({ b: { image: { src: bitmapSrc(made) } } });
    expect(await until(handle.current!, 75, 25, [255, 255, 0])).toEqual([255, 255, 0, 255]);
    // The page's own bitmap stays whole: the worker was sent a copy.
    expect(made.width).toBe(8);
  });
});
