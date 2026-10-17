import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEMOS } from '../registry';
import { WeaselDemos } from '../WeaselDemos';
import { renderWithIcons } from '../testIcons';

// Reports every observed element as on screen at once, so the source panel
// fetches its text on mount.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() { this.cb([{ isIntersecting: true }]); }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the source panel', () => {
  it('says so when a file fails to load, and stops showing the placeholder', async () => {
    const demo = DEMOS[0];
    vi.spyOn(demo.sources[0], 'load').mockRejectedValue(new Error('chunk is gone'));
    window.history.replaceState(null, '', `/#${demo.id}`);
    const { container } = renderWithIcons(<WeaselDemos />);
    expect((await screen.findByRole('status')).textContent).toMatch(/could not be loaded/);
    expect(container.querySelector('.ckd-source-loading')).toBeNull();
  });
});
