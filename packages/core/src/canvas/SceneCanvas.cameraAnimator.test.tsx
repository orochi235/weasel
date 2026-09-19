import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { Animator } from '../animation/types';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

const built = new Set<Animator>();

vi.mock('../animation/useAnimator', async (importOriginal) => {
  const real = await importOriginal<typeof import('../animation/useAnimator')>();
  return {
    ...real,
    useAnimator: (...args: Parameters<typeof real.useAnimator>) => {
      const a = real.useAnimator(...args);
      built.add(a);
      return a;
    },
  };
});

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); built.clear(); });

describe('SceneCanvas camera animator', () => {
  it('builds one animator and runs the camera glide on it', () => {
    const ref = { current: null as SceneCanvasApi | null };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    render(<SceneCanvas<D, L, P> ref={ref} scene={scene} width={400} height={200} />);

    expect(built.size).toBe(1);
    const [camera] = built;
    expect(camera.isActive()).toBe(false);

    act(() => { ref.current!.animateView({ x: 100, y: 0, scale: { x: 2, y: 2 } }, { ms: 400 }); });
    expect(camera.isActive()).toBe(true);

    act(() => { ref.current!.stopViewAnimation(); });
    expect(camera.isActive()).toBe(false);
  });
});
