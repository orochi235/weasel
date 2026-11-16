import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import type { DevtoolsClient } from '../client';
import { DispatchView } from './DispatchView';

// Which filter a drag crosses onto is a hit test against the laid-out bar.

afterEach(cleanup);

test('a drag from the on outcome filter across the other turns both off', async () => {
  const client = {
    onChanged: () => () => {},
    request: async () => ({ entries: [], cursor: 0, live: null }),
  } as unknown as DevtoolsClient;
  renderWithIcons(<DispatchView client={client} rootId="r" />);
  const filters = [await screen.findByRole('button', { name: 'handled' }), screen.getByRole('button', { name: 'unhandled' })];
  sweepAcross(filters);
  expect(filters.map((f) => f.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
});
