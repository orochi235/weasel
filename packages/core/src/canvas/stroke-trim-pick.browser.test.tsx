/**
 * Picking a trimmed stroke under a pose frame, through real pointer events on a real canvas: the
 * visible span hovers its node and the span the trim cuts away does not.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  transformPoint, asPolygonPath, pathLengthTable, pointAtLength, polylineFromPoints, poseFrameOf, resolveCorners, type PolygonPath,
} from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { SceneCanvas, createScene, solid } from '@weasel-js/core';

type Pose = { x: number; y: number; width: number; height: number; transform?: [number, number, number, number] };

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

const BOX = { x: 100, y: 60, width: 100, height: 80 };
const round = { shape: 'round', radius: 16 } as const;
/** An L through a rounded corner, inside {@link BOX}. */
const PATH: PolygonPath = {
  ...asPolygonPath(polylineFromPoints([{ x: 100, y: 60 }, { x: 200, y: 60 }, { x: 200, y: 140 }])),
  corners: [null, round, null],
};
const STROKE: Stroke = { paint: solid('#222'), width: 6, trim: { end: 0.5 } };

/** Where the canvas draws the point `fraction` of the way along the path's length, under `pose`. */
function drawnAt(pose: Pose, fraction: number): [number, number] {
  const table = pathLengthTable(resolveCorners(PATH));
  const { point } = pointAtLength(table, table.total * fraction);
  return transformPoint(poseFrameOf(pose)!, point[0], point[1]);
}

async function mount(pose: Pose) {
  const scene = createScene<unknown, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', pose, data: { path: PATH, fill: null, stroke: STROKE } });
  const hovered: (string | null)[] = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(SceneCanvas<unknown, 'main', Pose>, {
    scene, width: 400, height: 300, dpr: 1, view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    onHover: (hit: string | null) => hovered.push(hit),
  })));
  await settle();
  const canvas = host.querySelector('canvas')!;
  const hover = ([x, y]: [number, number]) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: rect.left + x, clientY: rect.top + y,
    }));
  };
  const lastHover = () => hovered.at(-1) ?? null;
  return { id, hover, lastHover };
}

describe('picking a trimmed cornered stroke under a pose frame', () => {
  it.each([
    ['a mirror and a non-uniform stretch', [-2, 0, 0, 1]],
    ['a vertical mirror and a horizontal stretch', [1.5, 0, 0, -1]],
  ] as const)('hits the drawn half and misses the trimmed half under %s', async (_name, transform) => {
    const pose: Pose = { ...BOX, transform: [...transform] };
    const { id, hover, lastHover } = await mount(pose);
    hover(drawnAt(pose, 0.2));
    await expect.poll(lastHover).toBe(id);
    hover(drawnAt(pose, 0.8));
    await expect.poll(lastHover).toBe(null);
    hover(drawnAt(pose, 0.35));
    await expect.poll(lastHover).toBe(id);
  });
});
