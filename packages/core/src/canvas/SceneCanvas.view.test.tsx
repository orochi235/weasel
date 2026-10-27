/**
 * SceneCanvas's view lives in a ref, not in React state: a pan
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
import { clampView } from 'core/viewport/clampView';
import { useOptionalViewInputs } from './viewInputs';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { SceneCanvas, type SceneCanvasProps } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SceneCanvasApi } from './canvasExtension';
import type { View } from 'core/viewport/view';
import { useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

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

    // `view.set` writes to the camera, and the camera reports the write through
    // `onViewChange`. A report that fed back into the write would recurse
    // (RangeError) or report twice.
    act(() => { depsRef.current!.get('view')!.set({ x: 12, y: 34, scale: { x: 2, y: 2 } }); });
    await frame();

    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith({ x: 12, y: 34, scale: { x: 2, y: 2 } });
    expect(apiRef.current!.getView()).toEqual({ x: 12, y: 34, scale: { x: 2, y: 2 } });
    // And what the HUDs and picking read agrees with the canvas.
    expect(depsRef.current!.get('view')!.get()).toEqual({ x: 12, y: 34, scale: { x: 2, y: 2 } });
  });

  it('answers defaultView to the view dep during the first commit', () => {
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

  it('keeps the view dep on the canvas\'s view after StrictMode re-runs its effects', async () => {
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
          kind: 'mark',
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

});

describe('SceneCanvas view bounds', () => {
  const BOUNDS = { x: 0, y: 0, width: 400, height: 300 };
  const OUTSIDE: View = { x: 1000, y: -50, scale: { x: 1, y: 1 } };
  const CLAMPED = clampView(OUTSIDE, BOUNDS, { width: 200, height: 150 });

  it('the bounds move a view this far outside them', () => {
    expect(CLAMPED).not.toEqual(OUTSIDE);
  });

  it('a controlled canvas reports an input write clamped, and leaves the prop authoritative', async () => {
    const apiRef = { current: null as SceneCanvasApi | null };
    const depsRef = { current: null as DepRegistry | null };
    const onViewChange = vi.fn();
    render(
      <SceneCanvas<D, L, P>
        ref={apiRef}
        scene={newScene()}
        width={200}
        height={150}
        view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        viewBounds={BOUNDS}
        onViewChange={onViewChange}
      >
        <DepGrabber out={depsRef} />
      </SceneCanvas>,
    );
    await frame();
    act(() => { depsRef.current!.get('view')!.set(OUTSIDE); });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith(CLAMPED);
    expect(apiRef.current!.getView()).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });

  it('an uncontrolled canvas clamps an input write', async () => {
    const apiRef = { current: null as SceneCanvasApi | null };
    const depsRef = { current: null as DepRegistry | null };
    const onViewChange = vi.fn();
    render(
      <SceneCanvas<D, L, P>
        ref={apiRef}
        scene={newScene()}
        width={200}
        height={150}
        viewBounds={BOUNDS}
        onViewChange={onViewChange}
      >
        <DepGrabber out={depsRef} />
      </SceneCanvas>,
    );
    await frame();
    act(() => { depsRef.current!.get('view')!.set(OUTSIDE); });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith(CLAMPED);
    expect(apiRef.current!.getView()).toEqual(CLAMPED);
  });
});

describe('SceneCanvas view read during the first commit', () => {
  const INITIAL: View = { x: -60, y: 5, scale: { x: 4, y: 4 } };
  // Five world units off a 10x10 node. A 10px pick tolerance reaches it at
  // scale 1 and falls short at scale 4, so the pick says which view the select
  // tool read.
  const NEAR = { x: 15, y: 5 };

  function mountAndRead(viewProps: Pick<SceneCanvasProps<D, L, P>, 'view' | 'defaultView'>) {
    const scene = newScene();
    const id = scene.add({
      kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 },
    });
    const apiRef = { current: null as SceneCanvasApi | null };
    const seen: { dep?: View; camera?: View; picked?: string[]; hook?: View } = {};
    function ReadDuringFirstCommit() {
      const registry = useDepRegistry();
      const inputs = useOptionalViewInputs();
      // A child's effects run ahead of the canvas's own.
      useEffect(() => {
        seen.dep = registry.get('view')?.get();
        seen.camera = apiRef.current?.camera.target.read();
        seen.picked = inputs?.pickEvery?.(NEAR);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }
    const search = window.location.search;
    window.history.replaceState(null, '', '?test=1');
    try {
      render(
        <SceneCanvas<D, L, P>
          ref={apiRef}
          scene={scene}
          width={200}
          height={150}
          geometry={{ picking: 'pose', pickTolerancePx: 10 }}
          {...viewProps}
        >
          <ReadDuringFirstCommit />
        </SceneCanvas>,
      );
      seen.hook = window.__weaselTest?.getView();
    } finally {
      window.history.replaceState(null, '', search || window.location.pathname);
    }
    return { seen, id };
  }

  it('the pick probe reaches the node at the default view', () => {
    const { seen, id } = mountAndRead({});
    expect(seen.picked).toEqual([id]);
  });

  it.each([
    ['defaultView', { defaultView: INITIAL }],
    ['a controlled view', { view: INITIAL }],
  ])('answers %s to the view dep, the camera, the select tool, and the test hook', (_name, viewProps) => {
    const { seen } = mountAndRead(viewProps);
    expect(seen.dep).toEqual(INITIAL);
    expect(seen.camera).toEqual(INITIAL);
    expect(seen.picked).toEqual([]);
    expect(seen.hook).toEqual(INITIAL);
  });
});

void function contentVersionIsNotAProp(): SceneCanvasProps<D, L, P> {
  return {
    scene: newScene(),
    width: 200,
    height: 150,
    // @ts-expect-error `contentVersion` is SceneCanvas's wiring to
    // `scene.getVersion`; a consumer value would spread over it and make
    // `getPaintedVersion()` report something other than the scene version.
    contentVersion: () => 7,
  };
};

describe('SceneCanvas view zoom invariant', () => {
  const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

  it('a controlled canvas reports a zero-scale view write with the scale clamped', async () => {
    const depsRef = { current: null as DepRegistry | null };
    const onViewChange = vi.fn();
    render(
      <SceneCanvas<D, L, P>
        scene={newScene()}
        width={200}
        height={150}
        view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        onViewChange={onViewChange}
      >
        <DepGrabber out={depsRef} />
      </SceneCanvas>,
    );
    await frame();
    act(() => { depsRef.current!.get('view')!.set({ x: 0, y: 0, scale: { x: 0, y: 0 } }); });
    const reported = onViewChange.mock.calls.at(-1)![0] as View;
    expect(finitePositive(reported.scale.x) && finitePositive(reported.scale.y)).toBe(true);
  });

  it('the view dep never reads a NaN scale from a controlled prop', async () => {
    const depsRef = { current: null as DepRegistry | null };
    render(
      <SceneCanvas<D, L, P>
        scene={newScene()}
        width={200}
        height={150}
        view={{ x: 0, y: 0, scale: { x: Number.NaN, y: Number.NaN } }}
        onViewChange={() => {}}
      >
        <DepGrabber out={depsRef} />
      </SceneCanvas>,
    );
    await frame();
    const mirrored = depsRef.current!.get('view')!.get();
    expect(finitePositive(mirrored.scale.x) && finitePositive(mirrored.scale.y)).toBe(true);
  });
});

describe('SceneCanvas view a render abandons', () => {
  it('keeps the committed controlled view in the view dep', () => {
    const scene = newScene();
    const depsRef = { current: null as DepRegistry | null };
    const A: View = { x: 1, y: 2, scale: { x: 1, y: 1 } };
    const B: View = { x: 9, y: 9, scale: { x: 3, y: 3 } };
    renderThenAbandon(A, B, (view) => (
      <SceneCanvas<D, L, P> scene={scene} width={200} height={150} view={view}>
        <DepGrabber out={depsRef} />
      </SceneCanvas>
    ));

    expect(depsRef.current!.get('view')!.get()).toEqual(A);
  });
});
