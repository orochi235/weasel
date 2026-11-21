/** The Dispatch tab against a page it does not have: a client whose answers the test writes. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { DevtoolsArea } from '../protocol';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { DispatchView } from './DispatchView';

afterEach(cleanup);

function fakePage(answer: () => Promise<unknown>) {
  const listeners = new Set<(rootId: string, areas: DevtoolsArea[]) => void>();
  let subscribes = 0;
  const client = {
    onChanged: (l: (rootId: string, areas: DevtoolsArea[]) => void) => {
      subscribes++;
      listeners.add(l);
      return () => listeners.delete(l);
    },
    request: answer,
  } as unknown as DevtoolsClient;
  return { client, listeners, subscribes: () => subscribes };
}

describe('<DispatchView>', () => {
  it('shows why the trace could not be read', async () => {
    const page = fakePage(() => Promise.reject(new Error('no canvas r')));
    renderWithIcons(<DispatchView client={page.client} rootId="r" />);
    expect(await screen.findByText('no canvas r')).toBeTruthy();
  });

  it('subscribes to change notices once, not once per render', async () => {
    const page = fakePage(async () => ({ entries: [], cursor: 0, live: null }));
    renderWithIcons(<DispatchView client={page.client} rootId="r" />);
    fireEvent.click(await screen.findByRole('switch', { name: 'coords' }));
    fireEvent.click(screen.getByRole('switch', { name: 'coords' }));
    expect(page.subscribes()).toBe(1);
    expect(page.listeners.size).toBe(1);
  });

  it('shows one outcome alone on Alt-click, and both on a second', async () => {
    const page = fakePage(async () => ({ entries: [], cursor: 0, live: null }));
    renderWithIcons(<DispatchView client={page.client} rootId="r" />);
    const filter = async (name: string) => screen.findByRole('button', { name });
    fireEvent.click(await filter('unhandled'));
    expect((await filter('handled')).getAttribute('aria-pressed')).toBe('true');
    expect((await filter('unhandled')).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(await filter('unhandled'), { altKey: true });
    expect((await filter('handled')).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(await filter('unhandled'), { altKey: true });
    expect((await filter('handled')).getAttribute('aria-pressed')).toBe('true');
    expect((await filter('unhandled')).getAttribute('aria-pressed')).toBe('true');
  });

  it('clears the coord rows along with the trace, and offers to when only coord rows are shown', async () => {
    const coord = { ts: 0, clientX: 3, clientY: 4, view: null, world: { x: 3, y: 4 }, fallback: true };
    const page = fakePage((async (_root: string, m: { coordCursor?: number }) => ({
      entries: [], cursor: 0, live: null,
      ...(m.coordCursor !== undefined ? { coords: { entries: m.coordCursor === 0 ? [coord] : [], cursor: 1 } } : {}),
    })) as () => Promise<unknown>);
    renderWithIcons(<DispatchView client={page.client} rootId="r" />);
    fireEvent.click(await screen.findByRole('switch', { name: 'coords' }));
    expect(await screen.findByText('fallback')).toBeTruthy();
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(clear.hasAttribute('disabled') || clear.getAttribute('aria-disabled') === 'true').toBe(false);
    fireEvent.click(clear);
    expect(await screen.findByText('No conversions recorded yet.')).toBeTruthy();
  });
});
