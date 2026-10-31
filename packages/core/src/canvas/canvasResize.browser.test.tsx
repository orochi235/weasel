/**
 * A canvas whose host resizes shows the new size, painted, in the frame the host resized in: the browser paints
 * after its `ResizeObserver` callbacks, so the resize has to be committed and painted by the end of them. What else
 * a resize renders waits for a later task, since a resize laid out inside the callbacks outside what they observe
 * is delivered only next frame, which the browser reports as a loop error.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement, useRef, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from '../core/scene/scene';
import { useCanvasSize } from '../core/viewport/useCanvasSize';
import { pixelAt } from '../testing/canvasPixels';

const GREEN = { color: '#00ff00' };

let root: Root | null = null;
let parent: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  parent?.remove();
  root = null;
  parent = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const scene = () => createScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({
  systemLayers: [{ id: 'main' }],
});

/** A SceneCanvas sized by its consumer from `useCanvasSize` on a host, as an editor's workspace is. */
function Measured(): ReactElement {
  const host = useRef<HTMLDivElement | null>(null);
  const dims = useCanvasSize(host, { beforePaint: true });
  return createElement('div', { ref: host, style: { width: '100%', height: '100%' } },
    dims.width > 0 && createElement(SceneCanvas, { scene: scene(), width: dims.width, height: dims.height, backgroundFill: GREEN }));
}

const hosts: Record<string, () => ReactElement> = {
  'filling its parent': () => createElement(SceneCanvas, { scene: scene(), backgroundFill: GREEN }),
  'sized from useCanvasSize': () => createElement(Measured),
};

/** What the canvas shows once the browser's resize callbacks for `parent` have run. */
function atResize(canvas: HTMLCanvasElement, width: number): Promise<{ css: number; buffer: number; edge: number[] }> {
  return new Promise((resolve) => {
    const observer = new ResizeObserver(() => {
      if (parent!.getBoundingClientRect().width !== width) return;
      observer.disconnect();
      const dpr = window.devicePixelRatio;
      resolve({
        css: canvas.getBoundingClientRect().width,
        buffer: canvas.width / dpr,
        edge: pixelAt(canvas, Math.round((width - 4) * dpr), 10),
      });
    });
    observer.observe(parent!);
  });
}

describe.each(Object.keys(hosts))('a SceneCanvas %s', (name) => {
  it('is resized and painted in the frame its host resizes in', async () => {
    parent = document.createElement('div');
    parent.style.width = '200px';
    parent.style.height = '120px';
    document.body.appendChild(parent);
    root = createRoot(parent);
    flushSync(() => root!.render(hosts[name]!()));
    for (let i = 0; i < 3; i++) await frame();
    const canvas = parent.querySelector('canvas')!;
    expect(canvas.getBoundingClientRect().width).toBe(200);

    const seen = atResize(canvas, 320);
    parent.style.width = '320px';
    const { css, buffer, edge } = await seen;
    expect([css, buffer]).toEqual([320, 320]);
    expect(edge.slice(0, 3)).toEqual([0, 255, 0]);
  });
});

/** Watches `el` as a component outside the host would, and resolves once it has seen `width`. */
function watch(el: Element, width: number): Promise<void> {
  return new Promise((resolve) => {
    const observer = new ResizeObserver(() => {
      if (el.getBoundingClientRect().width !== width) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(el);
  });
}

/** A host measured with `useCanvasSize`'s default and, beside it, a bar as wide as the host's last size. */
function Beside(): ReactElement {
  const host = useRef<HTMLDivElement | null>(null);
  const dims = useCanvasSize(host);
  return createElement('div', null,
    createElement('div', { ref: host, className: 'host', style: { width: '100%', height: 40 } }),
    createElement('div', { className: 'bar', style: { width: dims.width / 2, height: 10 } }));
}

/** A filling SceneCanvas whose `onResize` sizes a bar beside it. */
function BesideFill(): ReactElement {
  const [width, setWidth] = useState(0);
  return createElement('div', null,
    createElement('div', { className: 'host', style: { width: '100%', height: 40 } },
      createElement(SceneCanvas, { scene: scene(), onResize: (s: { width: number }) => setWidth(s.width) })),
    createElement('div', { className: 'bar', style: { width: width / 2, height: 10 } }));
}

describe.each([['useCanvasSize', Beside], ['a filling SceneCanvas\'s onResize', BesideFill]] as const)(
  'a layout outside the host driven by %s',
  (_name, Component) => {
    it('resizes after the resize callbacks, with no loop error', async () => {
      parent = document.createElement('div');
      parent.style.width = '200px';
      document.body.appendChild(parent);
      root = createRoot(parent);
      flushSync(() => root!.render(createElement(Component)));
      const bar = () => parent!.querySelector('.bar')!;
      await expect.poll(() => bar().getBoundingClientRect().width).toBe(100);
      // Settled first, so only the host's observation is pending when the host resizes.
      const seen = watch(bar(), 160);
      for (let i = 0; i < 2; i++) await frame();
      parent.style.width = '320px';
      await seen;
      for (let i = 0; i < 2; i++) await frame();
    });
  },
);
