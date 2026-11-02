import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { WeaselProvider, type Scene } from '@weasel-js/core';
import { AnimationCards, AnimationDemo } from '../AnimationDemo';

type AnyScene = Scene<unknown, string, { x: number; y: number }>;
const scenes = vi.hoisted(() => [] as AnyScene[]);
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts) as unknown as AnyScene;
      if (!scenes.includes(scene)) scenes.push(scene);
      return scene;
    },
  };
});

/** Frames on demand, through a stubbed `requestAnimationFrame`, at a clock the test owns. */
function stubFrames() {
  const queued = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queued.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
  const clock = { now: 0 };
  const step = (ms = 16): void => {
    clock.now += ms;
    const due = [...queued.values()];
    queued.clear();
    act(() => { for (const cb of due) cb(clock.now); });
  };
  return { queued, clock, step };
}

describe('AnimationDemo', () => {
  afterEach(cleanup);

  it('renders the canvas and the three control buttons', () => {
    const { container } = render(<AnimationDemo />);
    expect(screen.getByRole('button', { name: /Tween A/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tween B/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add card/i })).toBeTruthy();
    // Canvas component renders a <canvas>; smoke test it survived render.
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  const liveCount = (): number =>
    Number(/\d+/.exec(screen.getByRole('heading', { name: /^live/ }).textContent ?? '')?.[0]);

  it.each(['Add card', 'Tween A'])('starts an animation when "%s" is clicked', (name) => {
    render(<AnimationDemo />);
    expect(liveCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
    expect(liveCount()).toBe(1);
  });
});

describe('AnimationCards', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('repaints its fading cards without a React commit per animator tick', () => {
    const { queued, step } = stubFrames();

    let commits = 0;
    function Host() {
      const animator = useAnimator();
      return (
        <WeaselProvider isolate>
          <Profiler id="cards" onRender={() => { commits++; }}>
            <AnimationCards animator={animator} />
          </Profiler>
        </WeaselProvider>
      );
    }
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: /staggered fade-in/ }));
    step();
    step();
    const before = commits;
    for (let i = 0; i < 6; i++) step();
    expect(commits - before).toBe(0);
    expect(queued.size).toBeGreaterThan(0);
  });
});

describe('flick to grid', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('coasts on pose overrides and records the whole flick as one undo step', () => {
    const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    proto.setPointerCapture = vi.fn();
    proto.releasePointerCapture = vi.fn();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const { clock, step } = stubFrames();
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
    scenes.length = 0;

    const { container } = render(<AnimationDemo />);
    const scene = scenes.find((s) => s.get('block' as never))!;
    const canvas = container.querySelectorAll('canvas')[1]!;
    const fire = (type: string, x: number): void => act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 80, pointerId: 1, buttons: 1 }));
    });
    const pose = () => scene.get('block' as never)!.pose;
    const recorded = scene.historyEntries().length;

    fire('pointerdown', 80);
    for (const x of [90, 110, 130, 150]) {
      clock.now += 16;
      fire('pointermove', x);
    }
    fire('pointerup', 150);

    for (let i = 0; i < 4; i++) step();
    expect(scene.overrides.has('block' as never)).toBe(true);
    expect(scene.historyEntries()).toHaveLength(recorded);

    act(() => { vi.advanceTimersByTime(200); });
    for (let i = 0; i < 400 && scene.overrides.has('block' as never); i++) step();

    expect(scene.overrides.has('block' as never)).toBe(false);
    expect(scene.historyEntries()).toHaveLength(recorded + 1);
    expect(pose().x % 60).toBe(0);
    expect(pose().y % 60).toBe(0);
    expect(pose().x).toBeGreaterThan(60);
    act(() => { scene.undo(); });
    expect(pose()).toMatchObject({ x: 60, y: 60 });
  });
});
