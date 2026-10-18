/**
 * A canvas host given no `width` or `height` fills its parent: its element
 * takes the parent's box, its buffer follows at the device pixel ratio, and a
 * resize keeps the view's world-to-screen transform.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createElement, createRef, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Canvas } from './testing/BareCanvas';
import { DrawCanvas } from './DrawCanvas';
import { SceneViewCanvas } from './SceneViewCanvas';
import { SceneCanvas } from './SceneCanvas';
import type { CanvasExtensionApi } from './canvasExtension';
import { createScene } from '../core/scene/scene';
import { defaultDrawOne } from './defaultDrawOne';

const DPR = 2;

let root: Root | null = null;
let parent: HTMLDivElement | null = null;
let restoreDpr: PropertyDescriptor | undefined;

beforeEach(() => {
  restoreDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => DPR });
});

afterEach(() => {
  root?.unmount();
  parent?.remove();
  if (restoreDpr) Object.defineProperty(window, 'devicePixelRatio', restoreDpr);
  else Reflect.deleteProperty(window, 'devicePixelRatio');
  root = null;
  parent = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { await frame(); await frame(); await frame(); };

function sizeParent(width: number, height: number): void {
  parent!.style.width = `${width}px`;
  parent!.style.height = `${height}px`;
}

async function mount(element: ReactElement, into?: HTMLElement): Promise<HTMLCanvasElement> {
  parent = document.createElement('div');
  sizeParent(300, 200);
  document.body.appendChild(parent);
  if (into) parent.append(into);
  root = createRoot(into ?? parent);
  flushSync(() => root!.render(element));
  await settle();
  return parent.querySelector('canvas')!;
}

const scene = () => createScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({
  systemLayers: [{ id: 'main' }],
});
const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const hosts: Record<string, () => ReactElement> = {
  Canvas: () => createElement(Canvas, { layers: {} }),
  SceneCanvas: () => createElement(SceneCanvas, { scene: scene() }),
  DrawCanvas: () => createElement(DrawCanvas, { draw: [] }),
  SceneViewCanvas: () => createElement(SceneViewCanvas, { scene: scene(), view, drawOne: defaultDrawOne }),
};

const box = (canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();
  return [rect.width, rect.height];
};

describe.each(Object.keys(hosts))('<%s> with no width or height', (name) => {
  it('fills its parent, with the buffer at the device pixel ratio', async () => {
    const canvas = await mount(hosts[name]!());
    expect(box(canvas)).toEqual([300, 200]);
    expect([canvas.width, canvas.height]).toEqual([300 * DPR, 200 * DPR]);
  });

  it('follows its parent when the parent resizes, both ways', async () => {
    const canvas = await mount(hosts[name]!());
    sizeParent(420, 260);
    await settle();
    expect(box(canvas)).toEqual([420, 260]);
    expect([canvas.width, canvas.height]).toEqual([420 * DPR, 260 * DPR]);
    sizeParent(150, 90);
    await settle();
    expect(box(canvas)).toEqual([150, 90]);
    expect([canvas.width, canvas.height]).toEqual([150 * DPR, 90 * DPR]);
  });

  it('adds nothing to an auto-height parent, so it cannot grow it', async () => {
    const canvas = await mount(hosts[name]!());
    parent!.style.height = '';
    await settle();
    await settle();
    expect(parent!.getBoundingClientRect().height).toBe(0);
    expect(box(canvas)).toEqual([300, 0]);
  });

  it('shrinks with a flex item it fills, whose minimum is its content', async () => {
    // A column with a bar above a stage taking the rest: the shape a demo with controls has.
    const stage = document.createElement('div');
    stage.style.flex = '1';
    const canvas = await mount(hosts[name]!(), stage);
    parent!.style.display = 'flex';
    parent!.style.flexDirection = 'column';
    const bar = document.createElement('div');
    bar.style.height = '20px';
    parent!.prepend(bar);
    await settle();
    expect(box(canvas)).toEqual([300, 180]);
    sizeParent(300, 100);
    await settle();
    expect(box(canvas)).toEqual([300, 80]);
  });
});

describe('a filling canvas resized', () => {
  it('keeps its view, so the content stays put and more of the world shows', async () => {
    const ref = createRef<CanvasExtensionApi>();
    const start = { x: -40, y: 25, scale: { x: 2, y: 2 } };
    await mount(createElement(Canvas, { layers: {}, defaultView: start, ref }));
    sizeParent(500, 400);
    await settle();
    expect(ref.current!.getView()).toEqual(start);
    expect(ref.current!.getSurfaceRect()).toEqual({ x: 0, y: 0, width: 500, height: 400 });
  });

  it('reports each new size to onResize', async () => {
    const sizes: { width: number; height: number }[] = [];
    await mount(createElement(SceneCanvas, { scene: scene(), onResize: (s) => sizes.push(s) }));
    sizeParent(320, 180);
    await settle();
    expect(sizes).toEqual([{ width: 300, height: 200 }, { width: 320, height: 180 }]);
  });

  it('hands a draw function the measured size', async () => {
    const seen: { width: number; height: number }[] = [];
    await mount(createElement(DrawCanvas, { draw: (s) => { seen.push(s); return []; } }));
    expect(seen.at(-1)).toEqual({ width: 300, height: 200 });
    expect(seen.some((s) => s.width === 0 || s.height === 0)).toBe(false);
  });
});
