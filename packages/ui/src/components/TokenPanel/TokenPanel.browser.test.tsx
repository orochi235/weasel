import '@weasel-js/theme/tokens.css';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { TokenPanel } from './TokenPanel';

// Which grid row a scale's name lands in is a layout question, so only a real browser can answer it.

afterEach(cleanup);

test('a scale keeps its name on the reset’s row once a step is overridden', () => {
  renderWithIcons(
    <TokenPanel
      tokens={[
        { name: '--s-sm', type: 'dimension', group: 's', value: '8px' },
        { name: '--s-md', type: 'dimension', group: 's', value: '16px', overridden: true },
        { name: '--s-lg', type: 'dimension', group: 's', value: '32px' },
      ]}
      onChange={() => {}}
    />,
  );
  const scale = within(screen.getByRole('group', { name: 's' }));
  const name = scale.getByTitle('s').getBoundingClientRect();
  const reset = scale.getByRole('button', { name: 'Reset s' }).getBoundingClientRect();
  expect(Math.abs(name.top + name.height / 2 - (reset.top + reset.height / 2))).toBeLessThan(2);
});
