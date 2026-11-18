import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TrialClockDemo } from '../TrialClockDemo';

// windease lays a lab's tiles out only once something measures them, and jsdom ships no ResizeObserver.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.#cb = cb; }
    observe(target: Element) {
      this.#cb([{ target, contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0 } } as ResizeObserverEntry], this as never);
    }
    unobserve() {}
    disconnect() {}
  });
});
afterEach(cleanup);

const click = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
const has = (name: string) => screen.queryByRole('button', { name }) !== null;

describe('TrialClockDemo', () => {
  // The trial's clock mounts paused.
  it('keeps its direction across a pause', () => {
    render(<TrialClockDemo />);
    click('Play');
    click('Reverse');
    click('Pause');
    expect(has('Forward')).toBe(true);
    click('Play');
    expect(has('Pause')).toBe(true);
    expect(has('Forward')).toBe(true);
  });

  it('turns the direction round while paused without starting the clock', () => {
    render(<TrialClockDemo />);
    click('Reverse');
    expect(has('Play')).toBe(true);
    expect(has('Forward')).toBe(true);
  });
});
