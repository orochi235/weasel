/**
 * A glide on a controlled canvas, against a consumer who writes the view in
 * their own state: that write stops the glide, and the consumer's handling of
 * the glide's own frames does not.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function makeScene(): Scene<D, L, P> {
  return createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
}

const FRAME_MS = 16;
const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await act(async () => { await vi.advanceTimersByTimeAsync(FRAME_MS); });
};
const settle = async (done: () => boolean, max = 200) => {
  for (let i = 0; i < max && !done(); i++) await frames(1);
  expect(done()).toBe(true);
};

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const FAR: View = { x: 500, y: 500, scale: { x: 1, y: 1 } };

interface Handles {
  api: { current: SceneCanvasApi | null };
  /** The consumer's own state setter, which never passes through the canvas. */
  write: { current: ((v: View) => void) | null };
}

function Controlled({ handles, keep }: { handles: Handles; keep?: (v: View) => View }) {
  const [view, setView] = useState<View>(HOME);
  const [scene] = useState(makeScene);
  handles.write.current = setView;
  return (
    <SceneCanvas<D, L, P>
      ref={handles.api}
      scene={scene}
      width={400}
      height={200}
      view={view}
      onViewChange={(v) => setView(keep ? keep(v) : v)}
    />
  );
}

const makeHandles = (): Handles => ({ api: { current: null }, write: { current: null } });

describe('a glide on a controlled canvas', () => {
  it('reaches its target through the consumer state', async () => {
    const handles = makeHandles();
    render(<Controlled handles={handles} />);
    await frames(1);
    act(() => { handles.api.current!.animateView(FAR, { ms: 80 }); });
    await settle(() => !handles.api.current!.isViewAnimating());
    expect(handles.api.current!.getView().x).toBeCloseTo(500, 6);
  });

  it('stops when the consumer writes the view in their own state, and that write holds', async () => {
    const handles = makeHandles();
    render(<Controlled handles={handles} />);
    await frames(1);
    act(() => { handles.api.current!.animateView(FAR, { ms: 400 }); });
    await frames(3);
    expect(handles.api.current!.isViewAnimating()).toBe(true);

    const mine: View = { x: 7, y: 9, scale: { x: 1, y: 1 } };
    act(() => { handles.write.current!(mine); });
    expect(handles.api.current!.isViewAnimating()).toBe(false);

    await frames(4);
    expect(handles.api.current!.getView()).toEqual(mine);
  });

  it('runs to the end for a consumer who rounds every view they are handed', async () => {
    const handles = makeHandles();
    const round = (v: View): View => ({ ...v, x: Math.round(v.x), y: Math.round(v.y) });
    render(<Controlled handles={handles} keep={round} />);
    await frames(1);
    act(() => { handles.api.current!.animateView(FAR, { ms: 80 }); });
    await frames(2);
    expect(handles.api.current!.isViewAnimating()).toBe(true);
    await settle(() => !handles.api.current!.isViewAnimating());
    expect(handles.api.current!.getView().x).toBe(500);
  });

  it('does not stop for a consumer re-rendering with the same view', async () => {
    const handles = makeHandles();
    render(<Controlled handles={handles} />);
    await frames(1);
    act(() => { handles.api.current!.animateView(FAR, { ms: 400 }); });
    await frames(3);
    act(() => { handles.write.current!({ ...handles.api.current!.getView() }); });
    expect(handles.api.current!.isViewAnimating()).toBe(true);
  });
});
