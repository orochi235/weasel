/**
 * A pick on a real canvas reads its id frame: what a node's paint covers, a
 * custom shader's included, and nothing past it. jsdom has no renderer to draw one.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  SceneCanvas, createScene, createRasterSession, idMask, scenePickIds,
  type SceneCanvasApi,
} from '@weasel-js/core';
import { registerProgram, type DrawCommand } from '@weasel-js/renderer';
import type { RectPose } from 'core/scene/composePose';

/** Opaque inside the circle its bounds hold, transparent outside it. */
const DISC = registerProgram('pick-at-browser-disc', '', `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
void main() {
  float a = length(v_uv - 0.5) < 0.5 ? 1.0 : 0.0;
  outColor = vec4(0.0, 0.0, a, a);
}
`);

interface Data { disc?: boolean }

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

function sceneOf() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const under = scene.add({
    kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 100 }, data: {},
  });
  const disc = scene.add({ kind: 'mark', layer: 'main', pose: { x: 40, y: 20, width: 40, height: 40 }, data: { disc: true } });
  return { scene, under, disc };
}

/** A disc node paints the custom shader over its pose, the rest a red rect. */
const drawOne = ((node: { data: Data }, pose: RectPose): DrawCommand[] => (node.data.disc
  ? [{ kind: 'shader', program: DISC, uniforms: {}, bounds: { x: pose.x, y: pose.y, w: pose.width, h: pose.height } }]
  : [{ kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { kind: 'solid', color: '#ff0000' } } }])) as never;

describe('pickAt on a real canvas', () => {
  it('names the node whose paint is at the point, not whose bounds are', async () => {
    const { scene, under, disc } = sceneOf();
    const api = createRef<SceneCanvasApi>();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root!.render(createElement(SceneCanvas, {
      scene, width: 100, height: 100, dpr: 1, ref: api, layers: { scene: { drawOne } },
    } as never)));
    await settle();
    const node = (x: number, y: number) => scenePickIds(scene).nodeOf(api.current!.pickAt(x, y));
    expect(node(60, 40)).toBe(disc);
    expect(node(10, 80)).toBe(under);
    // Inside the disc's bounds, outside its circle: the node under it.
    expect(node(42, 22)).toBe(under);
    expect(node(78, 22)).toBeNull();
    expect(node(95, 95)).toBeNull();
  });
});

describe('RasterSession.renderIds', () => {
  it('reads each output pixel\'s node, and masks the ones asked for', () => {
    const { scene, under, disc } = sceneOf();
    const session = createRasterSession();
    try {
      const ids = session.renderIds({
        scene, drawOne, background: '#ffffff',
        sourceRect: { x: 0, y: 0, width: 100, height: 100 }, scale: { x: 1, y: 1 },
      });
      expect([ids.width, ids.height]).toEqual([100, 100]);
      const pick = scenePickIds(scene);
      const at = (x: number, y: number) => ids.data[y * 100 + x];
      expect(pick.nodeOf(at(60, 40))).toBe(disc);
      expect(pick.nodeOf(at(10, 80))).toBe(under);
      expect(at(90, 90)).toBe(0);
      const mask = idMask(ids, new Set([pick.idOf(disc)]));
      expect([mask[40 * 100 + 60], mask[80 * 100 + 10]]).toEqual([1, 0]);
    } finally {
      session.dispose();
    }
  });
});
