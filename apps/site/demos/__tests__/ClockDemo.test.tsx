import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClockDemo } from '../ClockDemo';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ClockDemo', () => {
  it('advances while playing and holds still at a rate of 0', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    let now = 0;
    const step = (ms: number): void => {
      now += ms;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };
    const inPass = () => Number.parseInt(screen.getByTestId('in-pass').textContent!, 10);

    render(<ClockDemo />);
    for (let i = 0; i < 10; i++) step(50);
    const played = inPass();
    expect(played).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: '0×' }));
    for (let i = 0; i < 10; i++) step(50);
    expect(inPass()).toBe(played);
  });
});
