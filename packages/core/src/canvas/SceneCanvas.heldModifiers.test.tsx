/**
 * A transform of the selection with one of its modifiers already held as the
 * drag starts: Shift constrains, Ctrl suspends snapping, and neither may keep
 * the drag from starting. Rects as in `SceneCanvas.useSelectTool.integration`:
 * under jsdom client coords are world coords.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';

type P = { x: number; y: number; width: number; height: number; rotation?: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

const FORCE_ENABLED = { enabled: () => true as const };

function mount(): { scene: Scene<object, 'main', P>; id: NodeId; canvas: HTMLCanvasElement } {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 } });
  const { container } = render(
    <SceneCanvas features={['draw']} scene={scene} layers={{}} width={200} height={200}
      selectionOptions={{ initial: [id] }}
      actions={{ move: FORCE_ENABLED, resize: FORCE_ENABLED, rotate: FORCE_ENABLED }}
    />,
  );
  return { scene, id, canvas: container.querySelector('canvas')! };
}

function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number], mods: { shiftKey?: boolean; ctrlKey?: boolean }) {
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...mods }));
  act(() => {
    at('pointerdown', from);
    at('pointermove', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    at('pointermove', to);
    at('pointerup', to);
  });
}

describe.each([
  ['nothing', {}],
  ['Shift', { shiftKey: true }],
  ['Ctrl', { ctrlKey: true }],
])('with %s held from the press', (_name, mods) => {
  it('moves the selection', () => {
    const { scene, id, canvas } = mount();
    drag(canvas, [25, 25], [65, 25], mods);
    expect(scene.get(id)!.pose.x).not.toBe(0);
  });

  it('resizes the selection from a corner handle', () => {
    const { scene, id, canvas } = mount();
    const before = scene.get(id)!.pose;
    drag(canvas, [0, 0], [20, 20], mods);
    expect(scene.get(id)!.pose).not.toEqual(before);
  });

  it('rotates the selection from the rotation handle', () => {
    const { scene, id, canvas } = mount();
    drag(canvas, [25, -24], [74, 25], mods);
    expect(scene.get(id)!.pose.rotation ?? 0).not.toBe(0);
  });
});
