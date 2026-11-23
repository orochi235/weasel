/** The trace's rows, with the live prediction pinned above them. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { bareDragSelect, nothingMatched } from './FallthroughDiagram.fixtures';
import { sequenced } from './sequenced';
import { TraceTable } from './TraceTable';

afterEach(cleanup);

it('says the live prediction would not handle a press, beside a logged input left unhandled', () => {
  renderWithIcons(
    <TraceTable
      entries={sequenced([nothingMatched], 1)}
      live={{ ...nothingMatched, predicted: true }}
      now={nothingMatched.ts}
      showHandled
      showUnhandled
      empty="none"
    />,
  );
  expect(screen.getAllByRole('cell', { name: 'would not handle' })).toHaveLength(1);
  expect(screen.getAllByRole('cell', { name: 'unhandled' })).toHaveLength(1);
});

it('says the live prediction would handle a press it names no action for', () => {
  renderWithIcons(
    <TraceTable entries={[]} live={{ ...bareDragSelect, predicted: true, fired: null }} now={0} showHandled showUnhandled empty="none" />,
  );
  expect(screen.getByRole('cell', { name: 'would handle' })).toBeTruthy();
});

it('opens a new live prediction closed, though the last one was open', () => {
  const props = { entries: [], now: 0, showHandled: true, showUnhandled: true, empty: 'none' };
  const live = { ...bareDragSelect, predicted: true };
  const { rerender } = renderWithIcons(<TraceTable {...props} live={live} />);
  const toggle = () => screen.getByRole('button', { name: /details/ });
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  rerender(<TraceTable {...props} live={null} />);
  rerender(<TraceTable {...props} live={{ ...live, ts: 1 }} />);
  expect(toggle()).toHaveAttribute('aria-expanded', 'false');
});
