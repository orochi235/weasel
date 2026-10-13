/**
 * Every canvas host's element takes its CSS size from the kit's class, at any
 * device pixel ratio, and a consumer class that sizes the element wins.
 * `<MinimapCanvas>` renders a `<SceneViewCanvas>`, so that case covers it.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Canvas } from './testing/BareCanvas';
import { DrawCanvas } from './DrawCanvas';
import { SceneViewCanvas } from './SceneViewCanvas';
import { createScene } from '../core/scene/scene';
import { defaultDrawOne } from './defaultDrawOne';

const W = 120;
const H = 60;
const DPR = 2;
const CONSUMER_CLASS = 'canvas-host-size-test-wide';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let sheet: HTMLStyleElement | null = null;
let restoreDpr: PropertyDescriptor | undefined;

beforeEach(() => {
  restoreDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => DPR });
  sheet = document.createElement('style');
  sheet.textContent = `.${CONSUMER_CLASS} { width: 300px; height: 90px; }`;
  document.head.appendChild(sheet);
});

afterEach(() => {
  root?.unmount();
  host?.remove();
  sheet?.remove();
  if (restoreDpr) Object.defineProperty(window, 'devicePixelRatio', restoreDpr);
  else Reflect.deleteProperty(window, 'devicePixelRatio');
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Mounted and painted: `<Canvas>` sizes its buffer on its first frame. */
async function mount(element: ReactElement): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(element));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

const scene = () => createScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({
  systemLayers: [{ id: 'main' }],
});
const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const hosts: Record<string, (className?: string) => ReactElement> = {
  Canvas: (className) => createElement(Canvas, { width: W, height: H, layers: {}, className }),
  DrawCanvas: (className) => createElement(DrawCanvas, { width: W, height: H, draw: [], className }),
  SceneViewCanvas: (className) => createElement(SceneViewCanvas, {
    scene: scene(), view, width: W, height: H, drawOne: defaultDrawOne, className,
  }),
};

const cssSize = (canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();
  return [rect.width, rect.height];
};

describe.each(Object.keys(hosts))('<%s> element size', (name) => {
  it('is its width and height props in CSS pixels, with the buffer at the device pixel ratio', async () => {
    const canvas = await mount(hosts[name]!());
    expect([canvas.width, canvas.height]).toEqual([W * DPR, H * DPR]);
    expect(cssSize(canvas)).toEqual([W, H]);
  });

  it('yields to a consumer class that sizes the element', async () => {
    const canvas = await mount(hosts[name]!(CONSUMER_CLASS));
    expect(cssSize(canvas)).toEqual([300, 90]);
    expect([canvas.width, canvas.height]).toEqual([W * DPR, H * DPR]);
  });
});
