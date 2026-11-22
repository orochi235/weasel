import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { DEMOS } from '../registry';
import { renderWithIcons } from '../testIcons';

vi.mock('../SourceView', () => {
  throw new TypeError('Failed to fetch dynamically imported module');
});

const { WeaselDemos } = await import('../WeaselDemos');

// Reports every observed element as on screen at once, so the source panel fetches its text on mount.
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

it('shows the source unhighlighted, and keeps the demo, when the highlighter cannot load', async () => {
  const demo = DEMOS[0];
  vi.spyOn(demo.sources[0], 'load').mockResolvedValue('const answer = 42;');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.history.replaceState(null, '', `/#${demo.id}`);
  const { container } = renderWithIcons(<WeaselDemos />);
  expect((await screen.findByText('const answer = 42;')).closest('pre')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(container.querySelector('.ckd-demo')).toBeTruthy();
});
