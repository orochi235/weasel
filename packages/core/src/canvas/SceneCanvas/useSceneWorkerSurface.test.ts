import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { startSceneRenderWorker } from '../renderWorker/startSceneRenderWorker';
import type { ToWorker } from '../renderWorker/protocol';
import { renderHook } from '@testing-library/react';
import { useSceneWorkerSurface, workerInputs } from './useSceneWorkerSurface';

const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;

describe('what a worker frame reads of a scene canvas', () => {
  it('hides a node an in-flight gesture ghosts, over the caller alphaFor', () => {
    const inputs = workerInputs({
      scene, alphaFor: (id) => (id === 'b' ? 0.5 : 1), sceneSlot: { cull: true }, clock: undefined, previewIds: () => ['a'],
    });
    expect(inputs.alphaFor!('a')).toBe(0);
    expect(inputs.alphaFor!('b')).toBe(0.5);
    expect(inputs.cull).toBe(true);
  });

  it('sends no alpha function while nothing dims a node', () => {
    const inputs = workerInputs({ scene, alphaFor: undefined, sceneSlot: undefined, clock: undefined, previewIds: () => null });
    expect(inputs.alphaFor).toBeUndefined();
  });

  it('stops culling in the worker once the scene slot drops `cull`', () => {
    const posted: ToWorker[] = [];
    let onMessage: (e: MessageEvent) => void = () => {};
    const worker = {
      postMessage: (m: ToWorker) => { posted.push(m); },
      addEventListener: (type: string, fn: (e: MessageEvent) => void) => { if (type === 'message') onMessage = fn; },
      terminate: () => {},
    } as unknown as Worker;
    const canvas = { transferControlToOffscreen: () => ({}) } as unknown as HTMLCanvasElement;
    const client = startSceneRenderWorker(worker, canvas, { scene, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, width: 10, height: 10, dpr: 1 });
    const frameWith = (sceneSlot: unknown) => {
      client.update(workerInputs({ scene, alphaFor: undefined, sceneSlot, clock: undefined, previewIds: () => null }));
      client.sync();
      const sent = posted.filter((m) => m.type === 'frame').at(-1)!;
      onMessage({ data: { type: 'drawn', id: sent.id } } as MessageEvent);
      return sent;
    };
    expect(frameWith({ cull: true })).toMatchObject({ cull: true });
    expect(frameWith({})).toMatchObject({ cull: false });
    client.dispose();
  });
});

describe('whether the worker paints the scene', () => {
  const start = () => ({}) as Worker;
  it("leaves the scene to the page when the resolved slot is a pre-built layer, the presets' included", () => {
    const { result } = renderHook(() => useSceneWorkerSurface({ worker: start }, scene, () => null, { layer: { id: 'scene', draw: () => [] } }));
    expect(result.current).toBeUndefined();
  });

  it('paints it for a slot config, and reads its cull', () => {
    const { result } = renderHook(() => useSceneWorkerSurface({ worker: start }, scene, () => null, { cull: true }));
    expect(result.current?.inputs().cull).toBe(true);
  });
});
