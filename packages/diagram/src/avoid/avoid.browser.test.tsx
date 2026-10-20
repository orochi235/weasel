/**
 * Avoid routing through a real drag: each frame previews the connector around
 * the shape being dragged onto it, and the release commits the route the last
 * frame showed. jsdom cannot see a preview frame, which only the renderer draws.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createScene, SceneCanvas, useSelection, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { registerDiagramShape } from '../shape';
import { useAvoidRouting } from './useAvoidRouting';

type AvoidScene = Scene<unknown, 'main', RectPose>;

const W = 600;
const H = 400;
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DARK = { paint: { color: '#101010' } };

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {}, fill: DARK } });

/**
 * a and b side by side, joined along y = 180. The wall starts below the line;
 * dragged up to y = 140..260 it covers it, and the cheapest way round is over
 * its top, along y = 130 (the wall's top less the clearance).
 */
function makeScene(): AvoidScene {
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [
      box('a', 0, 150), box('b', 400, 150), box('wall', 200, 280, 60, 120),
      {
        id: 'ab' as never, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {}, router: 'avoid', route: [] }, stroke: { paint: { color: '#ffffff' }, width: 2 } },
        dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH,
      },
    ] as never,
  });
}

function Routing({ scene }: { scene: AvoidScene }): null {
  useAvoidRouting(scene);
  return null;
}

function Stage({ scene }: { scene: AvoidScene }) {
  const selection = useSelection({ scene, mode: 'single' });
  return createElement(SceneCanvas<unknown, 'main', RectPose>, {
    scene, selection, features: ['view', 'pick', 'move'], width: W, height: H, view: VIEW, onViewChange: () => {},
    backgroundFill: { color: '#000000' },
  }, createElement(Routing, { scene }));
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

const routeOf = (scene: AvoidScene) => (scene.get('ab' as never)!.data as { diagram: DiagramEdge }).diagram.route;

describe('avoid routing under a real drag', () => {
  it('previews the reroute frame by frame, writes nothing until the release, and commits what it showed', async () => {
    unregister = registerDiagramShape<RectPose>();
    const scene = makeScene();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root!.render(createElement(Stage, { scene })));
    await frame();
    await frame();
    const canvas = host.querySelector('canvas')!;
    expect(inked(canvas, 330, 180)).toBe(true);
    expect(inked(canvas, 330, 130)).toBe(false);

    pointer(canvas, 'pointermove', 230, 340);
    pointer(canvas, 'pointerdown', 230, 340);
    const over: boolean[] = [];
    for (let i = 1; i <= 7; i++) {
      pointer(canvas, 'pointermove', 230, 340 - i * 20);
      await frame();
      await frame();
      over.push(inked(canvas, 330, 130));
    }
    // Once the wall reaches the line the preview runs over it; the document has not moved.
    expect(over[0]).toBe(false);
    expect(over[over.length - 1]).toBe(true);
    expect(inked(canvas, 330, 180)).toBe(false);
    expect(routeOf(scene)).toEqual([]);

    pointer(canvas, 'pointerup', 230, 200);
    await frame();
    await frame();
    expect(scene.get('wall' as never)!.pose).toMatchObject({ x: 200, y: 140 });
    expect(routeOf(scene)).toEqual([{ x: 50, y: 130 }, { x: 450, y: 130 }]);
    expect(inked(canvas, 330, 130)).toBe(true);
  });
});
