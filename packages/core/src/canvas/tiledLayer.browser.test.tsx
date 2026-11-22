/**
 * A scene layer marked tiled on a real canvas: once its tiles are in, it shows what the same layer
 * drawn live shows, to within resampling, and the bytes the renderer reports are the tiles the host
 * holds. jsdom has no WebGL2 to bake with.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas, createScene, readCanvasPixels, tileHostOf, type SceneCanvasApi } from '@weasel-js/core';
import type { RectPose } from 'core/scene/composePose';
import { cachedCanvasRenderer } from './canvasRenderer';

const roots: { root: Root; host: HTMLDivElement }[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) {
    r.root.unmount();
    r.host.remove();
  }
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const W = 160, H = 120, TILE = 64;

function sceneOf() {
  const scene = createScene<{ fill: unknown }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (let i = 0; i < 40; i++) {
    scene.add({
      kind: 'mark', layer: 'main', pose: { x: (i % 8) * 23 + 0.3, y: Math.floor(i / 8) * 21 + 0.6, width: 17, height: 13 },
      data: { fill: { paint: { kind: 'solid', color: `rgb(${(i * 37) % 255}, ${(i * 91) % 255}, 160)` } } },
    });
  }
  return scene;
}

async function mount(tiled: boolean) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  const api = createRef<SceneCanvasApi>();
  flushSync(() => root.render(createElement(SceneCanvas, {
    scene: sceneOf(), width: W, height: H, dpr: 1, ref: api, backgroundFill: { color: '#ffffff' },
    defaultView: { x: 0, y: 0, scale: { x: 0.83, y: 0.83 } },
    ...(tiled ? { tiles: { main: { tilePx: TILE, fadeMs: 0 } } } : {}),
  } as never)));
  // Long enough for every tile on screen to bake, a few a frame.
  for (let i = 0; i < 30; i++) await frame();
  return api.current!.surface!;
}

describe('a tiled scene layer on a real canvas', () => {
  it('shows what the live layer shows, and the renderer holds the bytes of the tiles the host holds', async () => {
    const live = await mount(false);
    const tiled = await mount(true);
    const a = (await readCanvasPixels(live, { x: 0, y: 0, width: W, height: H }))!;
    const b = (await readCanvasPixels(tiled, { x: 0, y: 0, width: W, height: H }))!;
    let sum = 0;
    for (let i = 0; i < a.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c]! - b[i + c]!));
      sum += d;
    }
    expect(sum / (W * H)).toBeLessThan(6);

    const renderer = cachedCanvasRenderer(tiled)!;
    const stats = tileHostOf(renderer)!.stats();
    expect(stats.held).toBeGreaterThan(0);
    expect(stats.liveDraws).toBe(0);
    const size = TILE + 2;
    // What the tiles take, and at most a pooled texture or a scratch buffer past it.
    expect(renderer.tiles.count).toBe(stats.held);
    expect(renderer.tiles.bytes).toBeGreaterThanOrEqual(stats.held * size * size * 4);
  });
});
