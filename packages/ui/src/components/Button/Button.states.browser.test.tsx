import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Button } from '@weasel-js/ui/components/Button';
import { ReadOnly } from '@weasel-js/ui/components/Disabled';

afterEach(cleanup);

test('a read-only toggle does not show the pointer cursor', () => {
  render(<ReadOnly><Button pressed={false}>Grid</Button></ReadOnly>);
  const button = screen.getByRole('button', { name: 'Grid' });
  expect(button.hasAttribute('data-readonly')).toBe(true);
  expect(getComputedStyle(button).cursor).toBe('default');
});

