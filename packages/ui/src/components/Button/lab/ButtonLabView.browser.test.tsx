import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { BUTTON_LAB_DEFAULTS, type ButtonLabConfig } from './buttonLabConfig';
import { ButtonLabView } from './ButtonLabView';

afterEach(cleanup);

/** The magnified button, then rest, held hover, and disabled. */
const heldHover = (variant: ButtonLabConfig['variant']) => {
  render(<ButtonLabView config={{ ...BUTTON_LAB_DEFAULTS, target: 'button', variant }} />);
  return getComputedStyle(screen.getAllByRole('button', { name: BUTTON_LAB_DEFAULTS.label })[2]!);
};

test('the held hover sample shows the hover of the variant tuned', () => {
  expect(heldHover('solid').filter).toBe('brightness(1.1)');
  cleanup();
  expect(heldHover('confirm').filter).toBe('brightness(1.08) saturate(1.06)');
  cleanup();
  const ghost = heldHover('ghost');
  expect(ghost.filter).toBe('none');
  expect(ghost.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
});
