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
      <input type="checkbox" aria-label="toggle" />
      <span contentEditable suppressContentEditableWarning aria-label="prose">x</span>
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

it('stays shut in editable text, and opens from a focused checkbox, which takes no typing', () => {
  render(<Harness />);
  fireEvent.keyDown(screen.getByLabelText('prose'), { key: '/' });
  expect(screen.getByRole('status').textContent).toBe('closed');
  fireEvent.keyDown(screen.getByLabelText('toggle'), { key: '/' });
  expect(screen.getByRole('status').textContent).toBe('open');
});
