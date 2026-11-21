import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TABS_ARC_DEFAULTS, TabsArcView } from './TabsArcView';

test('a tab count that drops the chosen section chooses the last one left', () => {
  const { rerender } = render(<TabsArcView config={{ ...TABS_ARC_DEFAULTS, tabs: 6 }} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Fonts' }));
  expect(screen.getByRole('tab', { name: 'Fonts' })).toHaveAttribute('aria-selected', 'true');
  rerender(<TabsArcView config={{ ...TABS_ARC_DEFAULTS, tabs: 4 }} />);
  expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('The export settings.');
});
