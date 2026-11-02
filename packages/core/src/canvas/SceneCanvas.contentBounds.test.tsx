/**
 * `viewBounds: 'content'` on a real `<SceneCanvas>`: the view is bounded to
 * what the scene draws plus a margin, read at each write, and never made to
 * move away from where it already is.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
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
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function DepGrabber({ out }: { out: { current: DepRegistry | null } }) {
  const registry = useDepRegistry();
  useEffect(() => { out.current = registry; }, [registry, out]);
  return null;
}

/** A 200×150 canvas over a scene with one 100×100 rect at the origin, zoomed 4×, so it shows 50×37.5 of the world. */
async function mount(viewBounds: SceneCanvasProps<D, L, P>['viewBounds'], defaultView: View = { x: 0, y: 0, scale: { x: 4, y: 4 } }) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 } });
  const apiRef = { current: null as SceneCanvasApi | null };
  const deps = { current: null as DepRegistry | null };
  render(
    <SceneCanvas<D, L, P> ref={apiRef} scene={scene} width={200} height={150} defaultView={defaultView} viewBounds={viewBounds}>
      <DepGrabber out={deps} />
    </SceneCanvas>,
  );
  await frame();
  const view = () => deps.current!.get('view')!;
  const pan = (x: number, y: number) => { act(() => { view().set({ x, y, scale: { x: 4, y: 4 } }); }); };
  return { scene, api: () => apiRef.current!, view, pan };
}

describe("SceneCanvas viewBounds: 'content'", () => {
  it('stops a pan at the content', async () => {
    const { api, pan } = await mount({ content: { margin: 0 } });
    pan(1000, -1000);
    expect(api().getView()).toMatchObject({ x: 50, y: 0 });
  });

  it('lets the view go the margin past the content, in screen pixels', async () => {
    const { api, pan } = await mount({ content: { margin: 40 } });
    pan(1000, 1000);
    // 40 px at 4× is 10 world units past the far edges.
    expect(api().getView()).toMatchObject({ x: 60, y: 110 - 37.5 });
  });

  it('follows the content as it grows', async () => {
    const { scene, api, pan } = await mount({ content: { margin: 0 } });
    act(() => {
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 300, y: 0, width: 20, height: 20 } });
    });
    pan(1000, 0);
    expect(api().getView().x).toBe(270);
  });

  it('does not count a hidden node as content', async () => {
    const { scene, view } = await mount('content');
    act(() => {
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', hidden: true, pose: { x: 300, y: 0, width: 20, height: 20 } });
    });
    expect(view().contentBounds?.()).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('leaves a view outside the content where it is, and lets it move only back toward it', async () => {
    const { api, pan } = await mount({ content: { margin: 0 } }, { x: 500, y: 0, scale: { x: 4, y: 4 } });
    pan(600, 0);
    expect(api().getView().x).toBe(500);
    pan(400, 0);
    expect(api().getView().x).toBe(400);
  });

  it('bounds nothing without the prop', async () => {
    const { api, pan } = await mount(undefined);
    pan(1000, -1000);
    expect(api().getView()).toMatchObject({ x: 1000, y: -1000 });
  });
});
