import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

// git stamps each commit in its author's offset, so string order is not time order.
vi.mock('../registry', () => ({
  DEMOS: [
    { id: 'utc', title: 'Earlier, in UTC', lastModified: '2026-11-17T01:00:00+00:00', created: '2026-11-01T00:00:00+00:00' },
    { id: 'pacific', title: 'Later, in Pacific time', lastModified: '2026-11-16T21:00:00-08:00', created: '2026-10-31T20:00:00-08:00' },
  ],
  placeOf: () => 'Core',
}));

const { WhatsNew } = await import('../WhatsNew');

afterEach(cleanup);

it('orders demos by the instant they changed, whatever offset git stamped', () => {
  render(<WhatsNew onSelect={() => {}} />);
  const titles = within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent);
  expect(titles).toEqual(['Later, in Pacific time', 'Earlier, in UTC']);
});
