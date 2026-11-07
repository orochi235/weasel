/**
 * A canvas's `backend` on a real browser: which renderer its first paint
 * builds, and that a WebGPU canvas paints and picks. The browser project
 * launches Chromium with `--enable-unsafe-webgpu`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas, createScene, scenePickIds, type SceneCanvasApi } from '@weasel-js/core';
import { registerProgram, type DrawCommand } from '@weasel-js/renderer';
import type { RectPose } from 'core/scene/composePose';
import { DrawCanvas } from './DrawCanvas';
import { cachedCanvasRenderer } from './canvasRenderer';
import { CanvasBackendProvider } from './canvasBackendContext';
import type { CanvasBackend } from './canvasBackend';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Frames until `ready` holds, or fail after `max`. */
async function until(ready: () => boolean, max = 60): Promise<void> {
  for (let i = 0; i < max && !ready(); i++) await frame();
  expect(ready()).toBe(true);
}

function mount(node: ReactNode): void {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(node));
}

const RED: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 40, height: 40 }, fill: { paint: { kind: 'solid', color: '#ff0000' } } },
];

/** A `<DrawCanvas>` asking for `backend`, and the backend its renderer took. */
async function drawnWith(backend: CanvasBackend | undefined, ambient?: CanvasBackend): Promise<string> {
  const canvasRef = createRef<HTMLCanvasElement>();
  const canvas = createElement(DrawCanvas, { draw: RED, width: 40, height: 40, dpr: 1, canvasRef, backend });
  mount(ambient ? createElement(CanvasBackendProvider, { value: ambient }, canvas) : canvas);
  await until(() => cachedCanvasRenderer(canvasRef.current!) !== undefined);
  const renderer = cachedCanvasRenderer(canvasRef.current!)!;
  await until(() => renderer.lastFrameStats().drawCalls > 0);
  return renderer.backend;
}

describe('a canvas\'s backend', () => {
  it('is WebGL 2 unless asked otherwise', async () => {
    expect(await drawnWith(undefined)).toBe('webgl2');
  });

  it('paints with WebGPU when asked, once the device arrives', async () => {
    expect(await drawnWith('webgpu')).toBe('webgpu');
  });

  it('takes the nearest provider\'s backend', async () => {
    expect(await drawnWith(undefined, 'webgpu')).toBe('webgpu');
  });

  it('picks by ids on WebGPU', async () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const left = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 100 }, data: {} });
    const api = createRef<SceneCanvasApi>();
    const drawOne = ((_: unknown, pose: RectPose): DrawCommand[] => [
      { kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { kind: 'solid', color: '#0000ff' } } },
    ]) as never;
    mount(createElement(SceneCanvas, {
      scene, width: 100, height: 100, dpr: 1, ref: api, backend: 'webgpu', layers: { scene: { drawOne } },
    } as never));
    const painted = () => {
      const surface = api.current?.surface;
      return !!surface && (cachedCanvasRenderer(surface)?.lastFrameStats().drawCalls ?? 0) > 0;
    };
    await until(painted);
    expect(cachedCanvasRenderer(api.current!.surface!)!.backend).toBe('webgpu');
    const ids = scenePickIds(scene);
    expect(ids.nodeOf(await api.current!.pickAt(20, 50))).toBe(left);
    expect(ids.nodeOf(await api.current!.pickAt(80, 50))).toBeNull();
    // A pick that must answer at once cannot read a WebGPU frame.
    expect(api.current!.readIdsSync({ x: 20, y: 50, width: 0, height: 0 })).toBeNull();
  });

  it('auto takes WebGPU until a program without WGSL is registered', async () => {
    expect(await drawnWith('auto')).toBe('webgpu');
    root!.unmount();
    host!.remove();
    root = null;
    host = null;
    registerProgram('canvas-backend-glsl-only', { glsl: { frag: `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }
` } });
    expect(await drawnWith('auto')).toBe('webgl2');
  });
});
