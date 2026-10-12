import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { useCommandPaletteShortcut } from '../CommandPalette/useCommandPaletteShortcut';

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(open, setOpen);
  return (
    <>
      <input aria-label="elsewhere" />
      <output>{open ? 'open' : 'closed'}</output>
    </>
  );
}

it('opens on / and not while typing in a field', () => {
  render(<Harness />);
  fireEvent.keyDown(screen.getByLabelText('elsewhere'), { key: '/' });
  expect(screen.getByRole('status').textContent).toBe('closed');
  fireEvent.keyDown(document.body, { key: '/' });
  expect(screen.getByRole('status').textContent).toBe('open');
});
