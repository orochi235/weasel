import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { SEGMENTS_ARC_DEFAULTS, SegmentsArcView } from './SegmentsArcView';

afterEach(cleanup);

test('the each-mode bar turns its options on and off', () => {
  render(<SegmentsArcView config={SEGMENTS_ARC_DEFAULTS} />);
  const guides = screen.getByRole('button', { name: 'Guides' });
  fireEvent.click(guides);
  expect(guides).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false');
});

test('the top bar keeps a segment on when the one chosen is no longer among its items', () => {
  const utils = render(<SegmentsArcView config={SEGMENTS_ARC_DEFAULTS} />);
  expect(screen.getByRole('radio', { checked: true })).toHaveTextContent('Scale');
  utils.rerender(<SegmentsArcView config={{ ...SEGMENTS_ARC_DEFAULTS, count: 1 }} />);
  expect(screen.getByRole('radio', { checked: true })).toHaveTextContent('Move');
});
