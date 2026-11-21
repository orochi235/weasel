import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Input } from '@weasel-js/ui/components/Input';

// Whether a press reaches a control is hit testing on computed styles, which jsdom does not do.

afterEach(cleanup);

describe('Input adornments', () => {
  test('a control in an adornment takes a click', async () => {
    const onClick = vi.fn();
    render(<Input aria-label="Name" trailingAdornment={<button type="button" onClick={onClick}>Clear</button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
