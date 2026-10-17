import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { WeaselProvider } from '@weasel-js/core';
import { AnimationCards, AnimationDemo } from '../AnimationDemo';

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
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    let now = 0;
    const step = (): void => {
      now += 16;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };

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
