/**
 * Off-page markers in a real canvas: a connector cut at the page gap draws
 * nothing across it, its tag paints its box, and a double-click on the tag
 * fits the view to the far page and selects the shape there.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  PAGES_DOC_KEY, SceneCanvas, createScene, fitViewToPage, placedPagesOf, useSelection,
  type RectPose, type Scene, type SelectionApi, type View,
} from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { registerDiagramShape } from '../shape';
import { diagramOffPage } from './follow';
import { installOffPageMarkers } from './install';

type OffPageScene = Scene<unknown, 'main', RectPose>;

registerCanvasFont('sans-serif');

const W = 600;
const H = 300;
const LOOK = { style: { fontFamily: 'sans-serif', fontSize: 12 }, fill: '#ffffff', background: '#3060c0' };
const AMBIENT = [diagramOffPage().contribution];

/**
 * Two 200 by 150 pages, 200 apart: p1 spans x 0..200, p2 x 400..600. Shape a
 * sits on p1 and b on p2, and the connector between them runs along y = 75.
 */
function makeScene(): OffPageScene {
  const box = (id: string, x: number) => ({
    id, kind: 'leaf', layer: 'main', pose: { x, y: 60, width: 40, height: 30 }, data: { diagram: {}, fill: { paint: { color: '#101010' } } },
  });
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    doc: { [PAGES_DOC_KEY]: { pages: [{ id: 'p1', width: 200, height: 150 }, { id: 'p2', width: 200, height: 150 }], layout: { gap: 200 } } },
    initial: [
      box('a', 20), box('b', 420),
      {
        id: 'ab', kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {} }, stroke: { paint: { color: '#ffffff' }, width: 2 } },
        dependsOn: ['a', 'b'], derivePath: EDGE_DERIVE_PATH,
      },
    ] as never,
  });
}

let view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
let selection: SelectionApi | null = null;

function Stage({ scene }: { scene: OffPageScene }) {
  const [v, setV] = useState(view);
  view = v;
  selection = useSelection({ scene, mode: 'single' });
  return createElement(SceneCanvas<unknown, 'main', RectPose>, {
    scene, selection, features: ['draw'], width: W, height: H, view: v, onViewChange: setV,
    backgroundFill: { color: '#000000' }, ambient: AMBIENT,
  });
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let unregister: (() => void) | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  unregister?.();
  root = null;
  host = null;
  view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const b = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: b.left + x, clientY: b.top + y,
  }));
}

function doubleClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const b = canvas.getBoundingClientRect();
  for (let i = 0; i < 2; i++) {
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + x, clientY: b.top + y, detail: i + 1 }));
  }
  canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: b.left + x, clientY: b.top + y, detail: 2 }));
}

/** The color the canvas drew at a CSS point, as `#rrggbb`. */
function colorAt(canvas: HTMLCanvasElement, x: number, y: number): string {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const out = new Uint8Array(4);
  gl.readPixels(Math.round(x * dpr), Math.round(canvas.height - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return `#${[...out.slice(0, 3)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

async function mount(scene: OffPageScene): Promise<HTMLCanvasElement> {
  unregister = registerDiagramShape<RectPose>();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(Stage, { scene })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

describe('off-page markers in a real canvas', () => {
  it('draws nothing across the gap once split, paints the tag, and follows it to the far page', async () => {
    const scene = makeScene();
    installOffPageMarkers(scene, { look: () => LOOK });
    const canvas = await mount(scene);
    // Saved whole, so nothing split it on load: the line still runs across the gap.
    expect(colorAt(canvas, 300, 75)).toBe('#ffffff');

    scene.setPose('b' as never, { x: 421, y: 60, width: 40, height: 30 });
    await frame();
    await frame();
    expect(colorAt(canvas, 300, 75)).toBe('#000000');
    // The start stub runs from a's east port at x = 60 out to 84; its tag starts 2 past that.
    expect(colorAt(canvas, 70, 75)).toBe('#ffffff');
    expect(colorAt(canvas, 90, 68)).toBe('#3060c0');

    doubleClick(canvas, 90, 68);
    await frame();
    await frame();
    const p2 = placedPagesOf(scene).find((p) => p.id === 'p2')!;
    expect(view).toEqual(fitViewToPage(p2, { width: W, height: H }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { padding: 24 }));
    expect(selection!.get()).toEqual(['b']);
  });
});
