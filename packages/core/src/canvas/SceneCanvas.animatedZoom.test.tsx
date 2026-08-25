/**
 * `viewport.animatedZoom` end to end.
 *
 * The keyboard cases live in the second describe and need the Mac platform
 * branch, so the navigator stub below runs before the dispatcher module loads
 * (`IS_MAC` is a module-level constant reading `navigator.platform ??
 * navigator.userAgent`, and jsdom's `platform` is the empty string — not
 * nullish — so the whole suite otherwise runs as non-Mac).
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, 'platform', {
    value: 'MacIntel',
    configurable: true,
  });
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    configurable: true,
  });
});

import { render, act, waitFor, cleanup } from '@testing-library/react';
import { Profiler } from 'react';
import { useAnimator } from '../animation/useAnimator';
import type { Animator } from '../animation/types';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
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
  // jsdom lays nothing out, so `hostSize` would measure 0x0 and `keyAnchor`
  // would fall back to the top-left origin — where a zoom is a fixed point on
  // both axes and every anchoring bug looks correct.
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { value: 200, configurable: true });
});

afterEach(() => { cleanup(); });

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L, pose: { x: 0, y: 0, width: 10, height: 10 } as P });
  });
  return s;
}

// Hoisted: an inline literal is a fresh identity every render and would fire
// repaints (and re-registrations) on its own.
const ANIMATED = { animatedZoom: { ms: 40 } } as const;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('SceneCanvas camera handle', () => {
  it('animateView glides to the target rather than arriving at once', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} />);
    await act(async () => { await frame(); });

    const target: View = { x: 100, y: 0, scale: { x: 4, y: 4 } };
    act(() => { ref.current!.animateView(target, { ms: 40 }); });

    // Nothing has ticked yet: a jump would already be at the target.
    expect(ref.current!.getView()).toEqual(HOME);
    expect(ref.current!.isViewAnimating()).toBe(true);

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    expect(ref.current!.getView().scale.x).toBeCloseTo(4, 6);
    expect(ref.current!.getView().x).toBeCloseTo(100, 6);
  });

  it('a setView during the glide cancels it and wins', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.animateView({ x: 500, y: 500, scale: { x: 8, y: 8 } }, { ms: 400 }); });
    await act(async () => { await frame(); await frame(); });

    const panned: View = { x: 7, y: 9, scale: { x: 1, y: 1 } };
    act(() => { ref.current!.setView(panned); });
    expect(ref.current!.isViewAnimating()).toBe(false);

    await act(async () => { await frame(); await frame(); });
    expect(ref.current!.getView()).toEqual(panned);
  });

  it('stopViewAnimation leaves the camera where it is', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.animateView({ x: 1000, y: 0, scale: { x: 1, y: 1 } }, { ms: 1000 }); });
    await act(async () => { await frame(); await frame(); });
    act(() => { ref.current!.stopViewAnimation(); });
    const held = ref.current!.getView();

    await act(async () => { await frame(); await frame(); });
    expect(ref.current!.getView()).toEqual(held);
    expect(held.x).not.toBe(1000);
  });

  it('glides without committing the canvas', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    let commits = 0;
    render(
      <Profiler id="canvas" onRender={() => { commits++; }}>
        <SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} viewport={ANIMATED} />
      </Profiler>,
    );
    await act(async () => { await frame(); });

    const before = commits;
    act(() => { ref.current!.animateView({ x: 60, y: 0, scale: { x: 2, y: 2 } }, { ms: 40 }); });
    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });

    expect(commits).toBe(before);
    expect(ref.current!.getView().x).toBeCloseTo(60, 6);
  });

  it('survives the consumer animator being cancelled wholesale', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    const out = { current: null as Animator | null };
    const scene = makeScene();
    function Harness() {
      const animator = useAnimator();
      out.current = animator;
      return <SceneCanvas<D, L, P> ref={ref} scene={scene} width={400} height={200} animator={animator} />;
    }
    render(<Harness />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.animateView({ x: 60, y: 0, scale: { x: 2, y: 2 } }, { ms: 40 }); });
    await act(async () => { await frame(); });
    // The consumer's scene animator is not the camera's: clearing theirs must
    // not strand a zoom half-finished.
    act(() => { out.current!.cancelAll(); });

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    expect(ref.current!.getView().x).toBeCloseTo(60, 6);
    expect(ref.current!.getView().scale.x).toBeCloseTo(2, 6);
  });
});

const fireKey = (key: string, opts: { metaKey?: boolean } = {}) => {
  window.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, key, metaKey: opts.metaKey ?? false,
  }));
};

const PLAIN = {} as const;

describe('viewport.animatedZoom at the keyboard (mac branch)', () => {
  it('Cmd+= jumps when animatedZoom is off', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} viewport={PLAIN} />);
    await act(async () => { await frame(); });

    act(() => { fireKey('=', { metaKey: true }); });
    expect(ref.current!.getView().scale.x).toBeCloseTo(1.25, 10);
  });

  it('Cmd+= glides when animatedZoom is on, and lands on the same scale', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    act(() => { fireKey('=', { metaKey: true }); });
    // The defining difference: unanimated, this is already 1.25.
    expect(ref.current!.getView().scale.x).toBe(1);
    expect(ref.current!.isViewAnimating()).toBe(true);

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    expect(ref.current!.getView().scale.x).toBeCloseTo(1.25, 6);
  });

  it('three fast presses compound to 1.25 cubed', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    act(() => { fireKey('=', { metaKey: true }); fireKey('=', { metaKey: true }); fireKey('=', { metaKey: true }); });
    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });

    expect(ref.current!.getView().scale.x).toBeCloseTo(Math.pow(1.25, 3), 6);
  });

  it('Cmd+0 glides back to identity', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.setView({ x: 40, y: 40, scale: { x: 3, y: 3 } }); });
    act(() => { fireKey('0', { metaKey: true }); });
    expect(ref.current!.getView().scale.x).toBe(3);

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    const home = ref.current!.getView();
    expect(home.x).toBeCloseTo(0, 6);
    expect(home.y).toBeCloseTo(0, 6);
    expect(home.scale.x).toBeCloseTo(1, 6);
    expect(home.scale.y).toBeCloseTo(1, 6);
  });

  it('keeps the host center under the same world point for the whole glide', async () => {
    const ref = { current: null as SceneCanvasApi | null };
    render(<SceneCanvas<D, L, P> ref={ref} scene={makeScene()} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    // The host center, from the clientWidth/clientHeight stubbed in `beforeAll`.
    // The origin would not do: a zoom anchored there leaves x and y untouched,
    // so this assertion would hold even against a linear translation lerp.
    const anchor = { x: 200, y: 100 };
    const worldAt = (v: View) => ({ x: anchor.x / v.scale.x + v.x, y: anchor.y / v.scale.y + v.y });
    const before = worldAt(ref.current!.getView());

    act(() => { fireKey('=', { metaKey: true }); });
    const samples: View[] = [];
    const stop = ref.current!.subscribeView((v) => { samples.push(v); });
    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    stop();

    expect(samples.length).toBeGreaterThanOrEqual(1);
    for (const s of samples) {
      expect(worldAt(s).x).toBeCloseTo(before.x, 8);
      expect(worldAt(s).y).toBeCloseTo(before.y, 8);
    }
  });
});
