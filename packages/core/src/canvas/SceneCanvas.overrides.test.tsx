import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { buildSceneViewCommands } from './sceneViewRender';
import { createScene } from 'core/scene/scene';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { type Animator } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('SceneCanvas — override repaint', () => {
  // Without a context that answers like WebGL2 every paint bails before it draws.
  const recorder = makeGLRecorder();
  beforeAll(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
    proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  });
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const paints = () => recorder.calls.filter((c) => c.name === 'clear').length;

  it('paints again when an override is committed', async () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });

    render(<SceneCanvas width={100} height={100} scene={scene} layers={{}} />);
    await frame();
    await frame();
    const before = paints();
    expect(before).toBeGreaterThan(0);
    await frame();
    expect(paints()).toBe(before);

    act(() => {
      scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
      scene.overrides.commit();
    });
    await frame();

    expect(paints()).toBeGreaterThan(before);
  });

  it('paints again on an animator frame', async () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    let animator!: Animator;
    function Host() {
      animator = useAnimator();
      return <SceneCanvas width={100} height={100} scene={scene} layers={{}} animator={animator} />;
    }
    render(<Host />);
    await frame();
    await frame();
    const before = paints();
    await frame();
    expect(paints()).toBe(before);

    act(() => { animator.tween<number>({ from: 0, to: 1, ms: 10_000, onTick: () => {} }); });
    await frame();
    await frame();

    expect(paints()).toBeGreaterThan(before);
    act(() => { animator.cancelAll(); });
  });
});

describe('buildSceneViewCommands — override alpha composition', () => {
  it('composes the override alpha with a consumer alphaFor exactly once', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
    scene.overrides.set(id, { alpha: 0.5 });
    const consumerAlphaFor = (_id: string) => 0.4;

    const alphas: number[] = [];
    const collect = (cmd: unknown): void => {
      const g = cmd as { alpha?: number; children?: unknown[] };
      if (typeof g.alpha === 'number') alphas.push(g.alpha);
      for (const child of g.children ?? []) collect(child);
    };
    for (const cmd of buildSceneViewCommands(
      scene,
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      () => [{ kind: 'rect', x: 0, y: 0, width: 1, height: 1, fill: { color: '#000' } } as never],
      undefined,
      consumerAlphaFor,
    )) collect(cmd);

    expect(alphas).toContain(0.2);
  });
});
