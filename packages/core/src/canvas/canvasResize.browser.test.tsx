/**
 * A canvas whose host resizes shows the new size, painted, in the frame the host resized in: the browser paints
 * after its `ResizeObserver` callbacks, so the resize has to be committed and painted by the end of them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement, useRef, type ReactElement } from 'react';
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
  const dims = useCanvasSize(host);
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
