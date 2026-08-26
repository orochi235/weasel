/**
 * SceneCanvas's view lives on the canvas handle, not in React state: a pan
 * through `setView` costs no commit, the `view` dep's write path reaches the
 * canvas without looping back through it, and a `view` prop still takes over
 * completely.
 *
 * The GL recorder is load-bearing — without a `getContext('webgl2')` that
 * answers like WebGL2, every paint bails early and painting assertions pass
 * vacuously.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Profiler, StrictMode, useEffect } from 'react';
import { SceneCanvas, type SceneCanvasProps } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SceneCanvasApi } from './canvasExtension';
import type { View } from 'core/viewport/view';
import { useDepRegistry, type DepRegistry } from 'interactions/actions/depRegistry';
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
const newScene = () => createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });

/** Captures the dep registry SceneCanvas mounts, so a test can drive the
 *  `view` dep exactly the way `viewport.pan` / `viewport.zoom` do. */
function DepGrabber({ out }: { out: { current: DepRegistry | null } }) {
  const registry = useDepRegistry();
  useEffect(() => { out.current = registry; }, [registry, out]);
  return null;
}

describe('SceneCanvas view', () => {
  it('pans through the handle without re-rendering the scene canvas', async () => {
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

    act(() => { apiRef.current!.setView({ x: 25, y: 0, scale: { x: 1, y: 1 } }); });
    await frame();

    expect(apiRef.current!.getView().x).toBe(25);
    expect(commits).toBe(before);
  });

  it('still honors a controlled view prop', async () => {
    const scene = newScene();
    const apiRef = { current: null as SceneCanvasApi | null };
    const view: View = { x: 7, y: 7, scale: { x: 1, y: 1 } };
    render(<SceneCanvas<D, L, P> ref={apiRef} scene={scene} width={200} height={150} view={view} />);
    await frame();
    expect(apiRef.current!.getView()).toEqual(view);
  });

  it('a controlled canvas reports view writes to onViewChange and leaves the prop authoritative', async () => {
    const scene = newScene();
    const apiRef = { current: null as SceneCanvasApi | null };
    const depsRef = { current: null as DepRegistry | null };
    const onViewChange = vi.fn();
    const view: View = { x: 7, y: 7, scale: { x: 1, y: 1 } };
    render(
      <SceneCanvas<D, L, P>
        ref={apiRef}
        scene={scene}
        width={200}
        height={150}
        view={view}
        onViewChange={onViewChange}
      >
        <DepGrabber out={depsRef} />
      </SceneCanvas>,
    );
    await frame();

    act(() => { depsRef.current!.get('view')!.set({ x: 40, y: 0, scale: { x: 1, y: 1 } }); });
    await frame();

    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith({ x: 40, y: 0, scale: { x: 1, y: 1 } });
    // The prop is still the authority: nothing was applied locally.
    expect(apiRef.current!.getView()).toEqual(view);
  });

  it('routes a `view` dep write to the canvas exactly once, without looping back through it', async () => {
    const scene = newScene();
    const apiRef = { current: null as SceneCanvasApi | null };
    const depsRef = { current: null as DepRegistry | null };
    const onViewChange = vi.fn();
    render(
      <SceneCanvas<D, L, P>
        ref={apiRef}
        scene={scene}
        width={200}
        height={150}
        onViewChange={onViewChange}
      >
        <DepGrabber out={depsRef} />
      </SceneCanvas>,
    );
    await frame();
    onViewChange.mockClear();

    // `view.set` is `handleViewChange`, which writes to the canvas; the canvas
    // announces the change back out through its own `onViewChange`. If those
    // two were the same callback the write would recurse (RangeError) or, with
    // the plan's belt-and-braces variant, report twice.
    act(() => { depsRef.current!.get('view')!.set({ x: 12, y: 34, scale: { x: 2, y: 2 } }); });
    await frame();

    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith({ x: 12, y: 34, scale: { x: 2, y: 2 } });
    expect(apiRef.current!.getView()).toEqual({ x: 12, y: 34, scale: { x: 2, y: 2 } });
    // And the mirror the HUDs / picking read agrees with the canvas.
    expect(depsRef.current!.get('view')!.get()).toEqual({ x: 12, y: 34, scale: { x: 2, y: 2 } });
  });

  it('seeds the view mirror from defaultView before any subscription lands', () => {
    const scene = newScene();
    const depsRef = { current: null as DepRegistry | null };
    const seen: View[] = [];
    function ReadDuringFirstCommit({ out }: { out: { current: DepRegistry | null } }) {
      const registry = useDepRegistry();
      useEffect(() => {
        out.current = registry;
        const v = registry.get('view');
        if (v) seen.push(v.get());
      });
      return null;
    }
    render(
      <SceneCanvas<D, L, P>
        scene={scene}
        width={200}
        height={150}
        defaultView={{ x: -60, y: 5, scale: { x: 3, y: 3 } }}
      >
        <ReadDuringFirstCommit out={depsRef} />
      </SceneCanvas>,
    );

    expect(seen[0]).toEqual({ x: -60, y: 5, scale: { x: 3, y: 3 } });
    expect(depsRef.current!.get('view')!.get()).toEqual({ x: -60, y: 5, scale: { x: 3, y: 3 } });
  });

  it('keeps the mirror fed after StrictMode re-runs the subscription effect', async () => {
    const scene = newScene();
    const apiRef = { current: null as SceneCanvasApi | null };
    const depsRef = { current: null as DepRegistry | null };
    render(
      <StrictMode>
        <SceneCanvas<D, L, P> ref={apiRef} scene={scene} width={200} height={150}>
          <DepGrabber out={depsRef} />
        </SceneCanvas>
      </StrictMode>,
    );
    await frame();

    act(() => { apiRef.current!.setView({ x: 99, y: -3, scale: { x: 1, y: 1 } }); });
    await frame();

    expect(depsRef.current!.get('view')!.get()).toEqual({ x: 99, y: -3, scale: { x: 1, y: 1 } });
  });

  it('reports the scene version its pixels were painted from', async () => {
    const scene = newScene();
    const addRect = () => {
      scene.batch('seed', () => {
        scene.add({
          kind: 'leaf',
          data: { kind: 'rect' },
          layer: 'main' as L,
          pose: { x: 10, y: 10, width: 20, height: 20 } as P,
        });
      });
    };
    addRect();
    const seeded = scene.getVersion();
    expect(seeded).toBeGreaterThan(0);

    const apiRef = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={apiRef} scene={scene} width={200} height={150} />);
    await frame();
    expect(apiRef.current!.getPaintedVersion()).toBe(seeded);

    act(() => { addRect(); });
    const bumped = scene.getVersion();
    expect(bumped).toBeGreaterThan(seeded);
    // Stamped at paint, not read live: the commit has landed, the frame has not.
    expect(apiRef.current!.getPaintedVersion()).toBe(seeded);

    await frame();
    await frame();
    expect(apiRef.current!.getPaintedVersion()).toBe(bumped);
  });

  it('does not accept a consumer-supplied contentVersion', () => {
    const props: SceneCanvasProps<D, L, P> = {
      scene: newScene(),
      width: 200,
      height: 150,
      // @ts-expect-error `contentVersion` is SceneCanvas's wiring to
      // `scene.getVersion`; a consumer value would spread over it and make
      // `getPaintedVersion()` report something other than the scene version.
      contentVersion: () => 7,
    };
    expect(props.width).toBe(200);
  });
});
