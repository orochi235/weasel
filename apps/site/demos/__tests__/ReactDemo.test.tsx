import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReactDemo } from '../ReactDemo';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReactDemo', () => {
  it('stops counting a box once it scrolls out of view, and keeps counting the rest', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    const observers: { cb: IntersectionObserverCallback; targets: Element[] }[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      targets: Element[] = [];
      constructor(cb: IntersectionObserverCallback) { observers.push({ cb, targets: this.targets }); }
      observe(el: Element) { this.targets.push(el); }
      unobserve() {}
      disconnect() {}
    });
    let now = 0;
    const step = (ms: number): void => {
      now += ms;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };
    const seconds = (label: string) => Number.parseFloat(screen.getByRole('group', { name: label }).textContent!.replace(label, ''));

    render(<ReactDemo />);
    for (let i = 0; i < 10; i++) step(100);
    const bottom = screen.getByRole('group', { name: 'bottom' });
    expect(seconds('bottom')).toBeGreaterThan(0);

    const watching = observers.find((o) => o.targets.includes(bottom))!;
    act(() => {
      watching.cb([{ target: bottom, isIntersecting: false } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    const held = seconds('bottom');
    const top = seconds('top');
    for (let i = 0; i < 10; i++) step(100);
    expect(seconds('bottom')).toBe(held);
    expect(seconds('top')).toBeGreaterThan(top);
  });
});
