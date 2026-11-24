import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TrialClockDemo } from '../TrialClockDemo';

vi.mock('@weasel-js/labkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/labkit')>()),
  useTrialClock: () => ({ rate: 0, elapsed: 2300 }),
  useClockFrame: () => {},
}));

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

describe('TrialClockDemo readout', () => {
  it('shows where a paused clock stands before it next moves', () => {
    render(<TrialClockDemo />);
    expect(screen.getByText('2.30s')).toBeTruthy();
  });
});
