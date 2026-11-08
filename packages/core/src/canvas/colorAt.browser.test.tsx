/**
 * `<SceneCanvas>`'s `colorAt` dep samples exactly: chrome painted over a node — here a selection-handle
 * square on a layer above the scene — shows on the canvas, and the sample still answers the node's own
 * color. jsdom has no WebGL2 to redraw with.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas, createScene, readCanvasPixels, type RenderLayer, type SceneCanvasApi } from '@weasel-js/core';
import { useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RectPose } from 'core/scene/composePose';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { await frame(); await frame(); await frame(); };

const drawOne = ((_node: unknown, pose: RectPose): DrawCommand[] => [
  { kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { kind: 'solid', color: '#ff0000' } } },
]) as never;

/** A handle-sized square at (40, 40), on a layer of the canvas's own above the scene. */
const handle: RenderLayer<unknown> = {
  id: 'handle', label: 'Handle', space: 'screen',
  draw: () => [{ kind: 'path', path: { kind: 'rect', x: 36, y: 36, width: 8, height: 8 }, fill: { paint: { kind: 'solid', color: '#0000ff' } } }],
};

function Capture({ onRegistry }: { onRegistry: (r: DepRegistry) => void }) {
  onRegistry(useDepRegistry());
  return null;
}

describe('colorAt on a real canvas', () => {
  it('answers the node under a handle drawn over it, not the handle', async () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 60, height: 60 }, data: {} });
    const api = createRef<SceneCanvasApi>();
    let registry!: DepRegistry;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root!.render(createElement(SceneCanvas, {
      scene, width: 100, height: 100, dpr: 2, ref: api,
      layers: { scene: { drawOne }, handle: { layer: handle, after: 'scene' } },
    } as never, createElement(Capture, { onRegistry: (r: DepRegistry) => { registry = r; } }))));
    await settle();

    // The canvas shows the handle at (40, 40)…
    const shown = await readCanvasPixels(api.current!.surface!, { x: 80, y: 80, width: 1, height: 1 });
    expect(Array.from(shown!)).toEqual([0, 0, 255, 255]);

    // …and the sample there is the node's own red; off the node, nothing.
    const colorAt = registry.get('colorAt')!;
    expect(await colorAt({ x: 40, y: 40 })).toBe('#ff0000');
    expect(await colorAt({ x: 90, y: 90 })).toBeNull();
  });
});
