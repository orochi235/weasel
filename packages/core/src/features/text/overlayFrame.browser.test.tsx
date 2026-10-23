/**
 * The edit overlay on a turned, skewed text node, as the browser lays it out:
 * the overlay's box lands on the parallelogram the node is drawn in. jsdom
 * resolves no transform, so only a browser can say where the box ended up.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type RectPose, type Scene } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { useSceneTextEdit, type DefaultTextData } from './useSceneTextEdit';

const ID = asNodeId('t');
const VIEW: View = { x: 10, y: -20, scale: { x: 2, y: 2 } };

type TextScene = Scene<DefaultTextData, 'main', RectPose>;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

function Editor({ scene, container }: { scene: TextScene; container: HTMLElement }) {
  const { startEdit } = useSceneTextEdit(scene, container, { view: VIEW });
  useEffect(() => { startEdit(ID); }, [startEdit]);
  return null;
}

async function overlayRect(pose: RectPose): Promise<DOMRect> {
  const scene: TextScene = createScene<DefaultTextData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: ID, kind: 'mark', layer: 'main', pose,
    data: { text: 'H', style: { fontSize: 16, lineHeight: 1.2, wrap: true } },
  });
  host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', width: '600px', height: '400px' });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(document.createElement('div'));
  flushSync(() => root!.render(createElement(Editor, { scene, container: host! })));
  await expect.poll(() => host!.querySelector('[contenteditable]')).not.toBeNull();
  return host.querySelector<HTMLElement>('[contenteditable]')!.getBoundingClientRect();
}

/** The box the node's drawn corners span on screen. */
function drawnExtent(pose: RectPose) {
  const frame = poseFrameOf(pose);
  const pts = [
    [pose.x, pose.y], [pose.x + pose.width, pose.y],
    [pose.x + pose.width, pose.y + pose.height], [pose.x, pose.y + pose.height],
  ].map(([x, y]) => {
    const [wx, wy] = frame ? applyToPoint(frame, x, y) : [x, y];
    return [(wx - VIEW.x) * VIEW.scale.x, (wy - VIEW.y) * VIEW.scale.y];
  });
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

// The overlay is nudged by the difference between the CSS and the canvas
// baseline, a pixel or two before the view scale.
const SLACK = 4;

describe.each([
  ['upright', { x: 100, y: 60, width: 120, height: 40 }],
  ['turned', { x: 100, y: 60, width: 120, height: 40, rotation: Math.PI / 3 }],
  ['skewed', { x: 100, y: 60, width: 120, height: 40, transform: [1, 0, 0.75, 1] as const }],
  ['turned and skewed', { x: 100, y: 60, width: 120, height: 40, rotation: -Math.PI / 4, transform: [1, 0.3, 0.5, 1.2] as const }],
] as [string, RectPose][])('the edit overlay on a %s text node', (_, pose) => {
  it('covers the box the node is drawn in', async () => {
    const rect = await overlayRect(pose);
    const want = drawnExtent(pose);
    expect(Math.abs(rect.left - want.left)).toBeLessThan(SLACK);
    expect(Math.abs(rect.right - want.right)).toBeLessThan(SLACK);
    expect(Math.abs(rect.top - want.top)).toBeLessThan(SLACK);
    expect(Math.abs(rect.bottom - want.bottom)).toBeLessThan(SLACK);
  });
});
