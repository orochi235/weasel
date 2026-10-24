/**
 * `<SceneCanvas>` publishes what an in-flight handle previews to its scene's overrides, so the
 * scene's other readers see the gesture, and releases it when the gesture ends.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Action, OngoingHandle } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Contribution } from '../tools/overlayBinding';

type D = { label: string };
type P = { x: number; y: number; width: number; height: number };

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

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'stored' } });
  const live: Action = {
    id: 'test.live', label: 'Live',
    invoker: {
      timing: 'ongoing',
      start: (): OngoingHandle => ({
        onMove() {},
        previewIds: () => [id],
        previewData: () => ({ label: 'live' }),
      }),
    },
  };
  const ambient: Contribution[] = [{
    id: 'test.live', eligibility: { always: true }, actions: [live],
    bindings: [{ spec: { kind: 'drag' }, actionId: live.id }],
  }];
  const { container } = render(
    <SceneCanvas features={[]} scene={scene} layers={{}} width={200} height={200} ambient={ambient} />,
  );
  const canvas = container.querySelector('canvas')!;
  const fire = (type: string, x: number, y: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, buttons: 1 }));
    });
  };
  const shown = () => scene.overrides.read(id)?.data?.(scene.get(id)!.data);
  return { scene, fire, shown };
}

describe('<SceneCanvas> publishing gesture previews', () => {
  it("shows a handle's previewData while the drag is in flight, and only then", () => {
    const { scene, fire, shown } = mount();
    fire('pointerdown', 150, 150);
    fire('pointermove', 170, 170);
    fire('pointermove', 180, 180);
    expect(shown()).toEqual({ label: 'live' });
    fire('pointerup', 180, 180);
    expect(scene.overrides.ids()).toEqual([]);
  });
});
