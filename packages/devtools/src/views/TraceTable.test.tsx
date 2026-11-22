/** The trace's rows, with the live prediction pinned above them. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { nothingMatched } from './FallthroughDiagram.fixtures';
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
