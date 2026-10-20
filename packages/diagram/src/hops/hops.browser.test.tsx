/**
 * Line jumps as the renderer draws them: the upper connector bows over the
 * lower one at their crossing, a drag hides the hops on what it moves, and the
 * release puts them back where the connectors now cross.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createScene, SceneCanvas, useSelection, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { registerDiagramShape } from '../shape';
import { HOPS_DOC_KEY } from './types';
import { useHops } from './useHops';

type HopScene = Scene<unknown, 'main', RectPose>;

const W = 600;
const H = 400;
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DARK = { paint: { color: '#101010' } };
const INK = { paint: { color: '#ffffff' }, width: 2 };

const box = (id: string, x: number, y: number) =>
  ({ id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width: 100, height: 60 }, data: { diagram: {}, fill: DARK } });

const connector = (id: string, from: string, to: string) => ({
  id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {} }, stroke: INK }, dependsOn: [from as never, to as never], derivePath: EDGE_DERIVE_PATH,
});

/** `cd` runs down x = 250 from y = 60 to 300; `ab`, drawn after it, runs along y = 180 from x = 100 to 400. */
function makeScene(): HopScene {
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [
      box('a', 0, 150), box('b', 400, 150), box('c', 200, 0), box('d', 200, 300),
      connector('cd', 'c', 'd'), connector('ab', 'a', 'b'),
    ] as never,
  });
}

function Hops({ scene }: { scene: HopScene }): null {
  useHops(scene);
  return null;
}

function Stage({ scene }: { scene: HopScene }) {
  const selection = useSelection({ scene, mode: 'single' });
  return createElement(SceneCanvas<unknown, 'main', RectPose>, {
    scene, selection, features: ['view', 'pick', 'move'], width: W, height: H, view: VIEW, onViewChange: () => {},
    backgroundFill: { color: '#000000' },
  }, createElement(Hops, { scene }));
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
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async () => { await frame(); await frame(); };

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const b = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: b.left + x, clientY: b.top + y,
  }));
}

/** Whether any pixel within a pixel of a CSS point is lit on the black ground. */
function inked(canvas: HTMLCanvasElement, x: number, y: number): boolean {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const side = Math.ceil(3 * dpr);
  const out = new Uint8Array(side * side * 4);
  gl.readPixels(Math.round((x - 1) * dpr), Math.round(canvas.height - (y + 1) * dpr), side, side, gl.RGBA, gl.UNSIGNED_BYTE, out);
  for (let i = 0; i < out.length; i += 4) if (out[i]! + out[i + 1]! + out[i + 2]! > 60) return true;
  return false;
}

/** Whether `ab` shows a hop of radius 10 centered at `x` on y = 180: ink on its half circle, none on the line it left. */
const hopAt = (canvas: HTMLCanvasElement, x: number) => inked(canvas, x + 7, 173) && !inked(canvas, x - 5, 180);
/** Whether `ab` runs straight through `x`: ink on the line, none where a hop would bow. */
const straightAt = (canvas: HTMLCanvasElement, x: number) => inked(canvas, x - 5, 180) && !inked(canvas, x + 7, 173);

const hopsOf = (scene: HopScene) => (scene.get('ab' as never)!.data as { diagram: DiagramEdge }).diagram.hops;

describe('line jumps on a canvas', () => {
  it('bows the upper connector over the crossing, hides it through a drag, and hops the new crossing on release', async () => {
    unregister = registerDiagramShape<RectPose>();
    const scene = makeScene();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root!.render(createElement(Stage, { scene })));
    await frames();
    const canvas = host.querySelector('canvas')!;
    expect(straightAt(canvas, 250)).toBe(true);

    scene.doc.set(HOPS_DOC_KEY, { size: 10 });
    await frames();
    expect(hopAt(canvas, 250)).toBe(true);

    // Drag c 40 to the right: cd runs from (290, 60) to (250, 300), crossing y = 180 at x = 270.
    pointer(canvas, 'pointermove', 250, 30);
    pointer(canvas, 'pointerdown', 250, 30);
    for (let i = 1; i <= 4; i++) {
      pointer(canvas, 'pointermove', 250 + i * 10, 30);
      await frames();
    }
    expect(straightAt(canvas, 250)).toBe(true);
    expect(inked(canvas, 277, 173)).toBe(false);
    expect(hopsOf(scene)).toHaveLength(1);

    pointer(canvas, 'pointerup', 290, 30);
    await frames();
    expect(hopsOf(scene)![0]!.at.x).toBeCloseTo(270, 3);
    expect(hopAt(canvas, 270)).toBe(true);
    expect(straightAt(canvas, 250)).toBe(true);
  });
});
