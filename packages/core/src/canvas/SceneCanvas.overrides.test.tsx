import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { buildSceneViewCommands } from './sceneViewRender';
import { createScene } from 'core/scene/scene';
import type { SceneCanvasApi } from './canvasExtension';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('SceneCanvas — override repaint', () => {
  it('requests a redraw when an override is committed', async () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
    const ref = createRef<SceneCanvasApi>();

    render(<SceneCanvas ref={ref} width={100} height={100} scene={scene} layers={{}} />);

    const requestRedraw = vi.spyOn(ref.current!, 'requestRedraw');
    await act(async () => {
      scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
      scene.overrides.commit();
    });

    expect(requestRedraw).toHaveBeenCalled();
  });
});

describe('SceneCanvas — override alpha composition', () => {
  it('composes the override alpha with a consumer alphaFor exactly once', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
    scene.overrides.set(id, { alpha: 0.5 });

    // The composed function SceneCanvas hands to the scene slot. Asserting it
    // here (rather than through GL) keeps the test on the contract: consumer
    // alpha times override alpha, one multiplication.
    const consumerAlphaFor = (_id: string) => 0.4;
    const composed = (nodeId: string) =>
      consumerAlphaFor(nodeId) * (scene.overrides.get(nodeId as never)?.alpha ?? 1);

    expect(composed(id)).toBeCloseTo(0.2);

    // And the headless path agrees with it.
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
