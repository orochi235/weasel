import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { Animator } from '@weasel-js/animator';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

const built = new Set<Animator>();

vi.mock('@weasel-js/animator/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/animator/react')>();
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

  it('hands out the camera target and its animator, where a second animation adds to a glide', () => {
    const ref = { current: null as SceneCanvasApi | null };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    render(<SceneCanvas<D, L, P> ref={ref} scene={scene} width={400} height={200} />);
    const { target, animator } = ref.current!.camera;
    expect([...built]).toEqual([animator]);

    const to = { x: 100, y: 0, scale: { x: 2, y: 2 } };
    act(() => { ref.current!.animateView(to, { ms: 400 }); });
    expect(target.active).toBe(true);
    const x = target.read().x;
    act(() => { animator.tween({ target, from: { ...to, x: 130 }, to, ms: 200 }); });
    expect(target.read().x).toBeCloseTo(x + 30, 6);
    expect(animator.live()).toHaveLength(2);

    act(() => { ref.current!.stopViewAnimation(); });
    expect(animator.live()).toHaveLength(1);
  });
});
