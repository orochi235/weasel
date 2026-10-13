/**
 * `useSceneTextEdit` on a text node whose pose is turned or carries a
 * `transform`: the overlay is handed the frame the node is drawn in, and a
 * double-click is taken back through it before it is tested against the box.
 * jsdom lays nothing out; `overlayFrame.browser.test.tsx` checks the pixels.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';
import { useScene } from '../../core/scene/useScene';
import { asNodeId, type RectPose, type UseSceneOptions } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { useSceneTextEdit, type DefaultTextData } from './useSceneTextEdit';

const POSE: RectPose = { x: 100, y: 50, width: 200, height: 40, rotation: Math.PI / 2, transform: [1, 0, 0.5, 1] };
const VIEW: View = { x: 20, y: 10, scale: { x: 2, y: 2 } };

function renderEdit(pose: RectPose, view?: View) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const initial: UseSceneOptions<DefaultTextData, 'default', RectPose>['initial'] = [{
    id: asNodeId('a'), kind: 'leaf', layer: 'default', pose,
    data: { text: 'hello', style: { fontSize: 16, wrap: true } },
  }];
  const hook = renderHook(() => {
    const scene = useScene<DefaultTextData, 'default', RectPose>({ systemLayers: [{ id: 'default' }], initial });
    return useSceneTextEdit(scene, container, { view });
  });
  return { hook, container };
}

const overlayOf = (c: HTMLElement) => c.querySelector<HTMLDivElement>('div[contenteditable="true"]')!;

/** Where the overlay's own point `(u, v)` lands, in container pixels. */
function land(el: HTMLElement, u: number, v: number): [number, number] {
  const m = /^matrix\(([^)]+)\)/.exec(el.style.transform);
  if (!m) throw new Error(`no matrix in "${el.style.transform}"`);
  const [a, b, c, d, e, f] = m[1].split(',').map(Number);
  return [parseFloat(el.style.left) + a * u + c * v + e, parseFloat(el.style.top) + b * u + d * v + f];
}

describe('useSceneTextEdit — a turned, skewed text node', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('lands the overlay box on the corners the node is drawn at', () => {
    const { hook, container } = renderEdit(POSE, VIEW);
    act(() => hook.result.current.startEdit('a'));
    const el = overlayOf(container);
    const frame = poseFrameOf(POSE)!;
    for (const [u, v] of [[0, 0], [200, 0], [200, 40], [0, 40]]) {
      const [wx, wy] = applyToPoint(frame, POSE.x + u, POSE.y + v);
      const [sx, sy] = land(el, u, v);
      expect(sx).toBeCloseTo((wx - VIEW.x) * VIEW.scale.x, 6);
      expect(sy).toBeCloseTo((wy - VIEW.y) * VIEW.scale.y, 6);
    }
  });

  it('writes a plain scale for a node with no frame', () => {
    const { hook, container } = renderEdit({ x: 100, y: 50, width: 200, height: 40 }, VIEW);
    act(() => hook.result.current.startEdit('a'));
    expect(overlayOf(container).style.transform).toBe('scale(2)');
  });

  function doubleClickAt(world: [number, number]): string | null {
    const { hook, container } = renderEdit(POSE);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    act(() => hook.result.current.onDoubleClick({
      target: canvas, clientX: world[0], clientY: world[1],
    } as unknown as MouseEvent<HTMLElement>));
    return hook.result.current.editingId;
  }

  it('opens the editor from a double-click on the text as drawn', () => {
    // Near the start of the line, which the quarter turn stands on end.
    expect(doubleClickAt(applyToPoint(poseFrameOf(POSE)!, 110, 60))).toBe('a');
  });

  it('opens none from a double-click in the unturned box the text is not drawn in', () => {
    expect(doubleClickAt([110, 60])).toBeNull();
  });
});
