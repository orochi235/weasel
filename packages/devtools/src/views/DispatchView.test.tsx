/** The Dispatch tab against a page it does not have: a client whose answers the test writes. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { DevtoolsArea } from '@weasel-js/core/devtools-protocol';
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
});
