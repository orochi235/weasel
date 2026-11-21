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

test('a pressed confirm button keeps its accent body', () => {
  render(
    <>
      <Button stance="confirm">Rest</Button>
      <Button stance="confirm" pressed>Held</Button>
    </>,
  );
  const rest = getComputedStyle(screen.getByRole('button', { name: 'Rest' }));
  const held = getComputedStyle(screen.getByRole('button', { name: 'Held' }));
  expect(held.backgroundColor).toBe(rest.backgroundColor);
  expect(held.backgroundImage).toBe(rest.backgroundImage);
  expect(held.color).toBe(rest.color);
});
