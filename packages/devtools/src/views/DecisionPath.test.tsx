/** The powerline a dispatch record's detail opens with. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { DecisionPath } from './DecisionPath';
import { nothingMatched, predictedHover } from './FallthroughDiagram.fixtures';

afterEach(cleanup);

const path = () => screen.getByLabelText('Decision path').textContent;

it('says a predicted miss would not handle the input, and a real miss left it unhandled', () => {
  const { rerender } = renderWithIcons(<DecisionPath record={{ ...nothingMatched, predicted: true }} />);
  expect(path()).toMatch(/would not handle$/);
  rerender(<DecisionPath record={nothingMatched} />);
  expect(path()).toMatch(/unhandled$/);
  expect(path()).not.toMatch(/would/);
});

it('says a predicted hit would handle the input', () => {
  renderWithIcons(<DecisionPath record={predictedHover} />);
  expect(path()).toMatch(/would handle$/);
});
