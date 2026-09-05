/**
 * A scene mutation repaints the canvas without committing SceneCanvas.
 *
 * The pairing of the two assertions is the whole test. `commits` alone passes
 * vacuously against a SceneCanvas that dropped the subscription and never
 * repaints at all; `getPaintedVersion()` alone passes against today's code,
 * which repaints by way of a commit. Only both together describe the split.
 *
 * The GL recorder is load-bearing — without a `getContext('webgl2')` that
 * answers like WebGL2, every paint bails early and `getPaintedVersion()`
 * stays 0 for the wrong reason.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Profiler } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { SceneCanvasApi } from './canvasExtension';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const newScene = () => {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'main', data: { kind: 'rect' },
    pose: { x: 0, y: 0, width: 10, height: 10 } });
  return scene;
};

describe('SceneCanvas scene subscription', () => {
  it('repaints on a pose write without committing', async () => {
    const scene = newScene();
    const apiRef = { current: null as SceneCanvasApi | null };
    let commits = 0;
    render(
      // Profiler wraps SceneCanvas itself, not an outer element: a setState
      // inside it never re-renders a parent, so a Profiler one level up counts
      // zero either way and the assertion passes vacuously.
      <Profiler id="scene-canvas" onRender={() => { commits++; }}>
        <SceneCanvas<D, L, P> ref={apiRef} scene={scene} width={200} height={150} />
      </Profiler>,
    );
    await frame();
    const before = commits;

    act(() => { scene.setPose(asNodeId('a'), { x: 40, y: 0, width: 10, height: 10 }); });
    await frame();

    // The pixels caught up with the write ...
    expect(apiRef.current!.getPaintedVersion()).toBe(scene.getVersion());
    // ... and React did not re-render to get them there.
    expect(commits).toBe(before);
  });

  it('repaints on add and remove without committing', async () => {
    const scene = newScene();
    const apiRef = { current: null as SceneCanvasApi | null };
    let commits = 0;
    render(
      <Profiler id="scene-canvas" onRender={() => { commits++; }}>
        <SceneCanvas<D, L, P> ref={apiRef} scene={scene} width={200} height={150} />
      </Profiler>,
    );
    await frame();
    const before = commits;

    act(() => {
      scene.add({ id: asNodeId('b'), kind: 'leaf', layer: 'main', data: { kind: 'rect' },
        pose: { x: 5, y: 5, width: 10, height: 10 } });
    });
    await frame();
    expect(apiRef.current!.getPaintedVersion()).toBe(scene.getVersion());

    act(() => { scene.remove(asNodeId('b')); });
    await frame();
    expect(apiRef.current!.getPaintedVersion()).toBe(scene.getVersion());

    expect(commits).toBe(before);
  });

  it('still commits for a selection change', async () => {
    // Selection reaches the render body through `useSelection`'s own store
    // subscription, not through the scene-content subscription this arc
    // replaces. It has to keep committing: SceneCanvas publishes the selection
    // (and its kind labels) into `<SelectionContextProvider>` during render.
    const scene = newScene();
    let commits = 0;
    render(
      <Profiler id="scene-canvas" onRender={() => { commits++; }}>
        <SceneCanvas<D, L, P> scene={scene} width={200} height={150} />
      </Profiler>,
    );
    await frame();
    const before = commits;

    act(() => { scene.setSelection([asNodeId('a')]); });
    await frame();

    expect(commits).toBeGreaterThan(before);
  });
});
