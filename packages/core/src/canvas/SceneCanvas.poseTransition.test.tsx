import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { ReflowTransition } from '../layout/types';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

const at = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });
const A = asNodeId('a');

describe('<SceneCanvas poseTransition>', () => {
  it('hands the scene its writes while the prop is set, and stops when it is not', () => {
    const scene = createScene<object, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: A, kind: 'mark', layer: 'main', pose: at(0), data: {} }],
    });
    const settle = vi.fn();
    const transition: ReflowTransition<RectPose> = { glide: vi.fn(), settle, stop: vi.fn(), poseOf: () => undefined };
    const { rerender } = render(<SceneCanvas scene={scene} poseTransition={{ transition }} />);
    act(() => { scene.setPose(A, at(30)); });
    expect(settle).toHaveBeenCalledWith(A, { from: at(0) });
    rerender(<SceneCanvas scene={scene} poseTransition={null} />);
    act(() => { scene.setPose(A, at(60)); });
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
