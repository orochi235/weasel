/**
 * A canvas's `backend` on a real browser: which renderer its first paint
 * builds, and that a WebGPU canvas paints and reads its ids back.
 *
 * Runs in the `browser (gpu)` instance: without the GPU, headless Chromium
 * cannot present a WebGPU canvas and loses every tab's (docs/traps/testing.md).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerProgram, type DrawCommand, type WeaselRenderer } from '@weasel-js/renderer';
import { CanvasBackendProvider } from '@weasel-js/core';
import { leaseCanvasRenderer, useCanvasRenderer } from '@weasel-js/core/testing/canvas';
import type { CanvasBackend } from './canvasBackend';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const SIZE = { width: 40, height: 40, dpr: 1 };

const rect = (x: number, pickId: number): DrawCommand => ({
  kind: 'group', pickId,
  children: [{ kind: 'path', path: { kind: 'rect', x, y: 0, width: 20, height: 40 }, fill: { paint: { kind: 'solid', color: '#ff0000' } } }],
} as DrawCommand);

const releases: (() => void)[] = [];
let root: Root | null = null;

afterEach(() => {
  for (const release of releases.splice(0)) release();
  root?.unmount();
  root = null;
});

/** The renderer a paint into a fresh detached canvas builds for `backend`, once it can. */
async function painted(backend: () => CanvasBackend, commands: DrawCommand[] = [rect(0, 1)]): Promise<WeaselRenderer> {
  const lease = leaseCanvasRenderer({ backend });
  releases.push(() => lease.release());
  const canvas = document.createElement('canvas');
  for (let i = 0; i < 30; i++) {
    if (lease.paint(canvas, commands, VIEW, SIZE)) return lease.bind(canvas, SIZE)!;
    await frame();
  }
  throw new Error('the canvas never painted');
}

describe('a canvas\'s backend', () => {
  it('is WebGL 2 unless asked otherwise', async () => {
    const lease = leaseCanvasRenderer();
    releases.push(() => lease.release());
    const canvas = document.createElement('canvas');
    expect(lease.paint(canvas, [rect(0, 1)], VIEW, SIZE)).toBe(true);
    expect(lease.bind(canvas, SIZE)!.backend).toBe('webgl2');
  });

  it('paints with WebGPU when asked, waiting for the device first', async () => {
    expect((await painted(() => 'webgpu')).backend).toBe('webgpu');
  });

  it('takes the nearest provider\'s backend', async () => {
    const canvas = document.createElement('canvas');
    let renderer: WeaselRenderer | null = null;
    function Surface() {
      const lease = useCanvasRenderer();
      useEffect(() => {
        let live = true;
        const attempt = () => {
          if (!live) return;
          if (lease.paint(canvas, [rect(0, 1)], VIEW, SIZE)) renderer = lease.bind(canvas, SIZE);
          else requestAnimationFrame(attempt);
        };
        attempt();
        return () => { live = false; };
      }, [lease]);
      return null;
    }
    const host = document.createElement('div');
    root = createRoot(host);
    flushSync(() => root!.render(createElement(CanvasBackendProvider, { value: 'webgpu' }, createElement(Surface))));
    for (let i = 0; i < 30 && !renderer; i++) await frame();
    expect(renderer!.backend).toBe('webgpu');
  });

  it('reads the ids of a WebGPU frame back asynchronously', async () => {
    const commands = [rect(0, 7), rect(20, 9)];
    const renderer = await painted(() => 'webgpu', commands);
    const at = async (x: number) => (await renderer.renderIdsAsync(commands, undefined, { rect: { x, y: 20, width: 0, height: 0 } })).data[0];
    expect([await at(10), await at(30)]).toEqual([7, 9]);
  });

  it('auto takes WebGPU until a program without WGSL is registered', async () => {
    expect((await painted(() => 'auto')).backend).toBe('webgpu');
    registerProgram('canvas-backend-glsl-only', { glsl: { frag: `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }
` } });
    expect((await painted(() => 'auto')).backend).toBe('webgl2');
  });
});
