import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { Dialog } from './Dialog';

// The overlay portals into the nearest themed ancestor, found from an anchor
// that only exists after the first render. jsdom has no `inert`, so whether
// that first render leaves the page unusable is a browser question.

afterEach(cleanup);

function themedRoot(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'root';
  root.dataset.wzlMode = 'light';
  document.body.append(root);
  return root;
}

function Composer({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog isOpen={open} onOpenChange={setOpen} title="Compose">
        <button onClick={() => setClicks((n) => n + 1)}>Inside {clicks}</button>
      </Dialog>
    </>
  );
}

test.each([
  ['mounted open', true],
  ['opened after mount', false],
])('a dialog %s inside a themed root takes clicks and focus', async (_, initiallyOpen) => {
  const root = themedRoot();
  try {
    render(<Composer initiallyOpen={initiallyOpen} />, { container: root });
    if (!initiallyOpen) await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog');
    expect(root.contains(dialog)).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: 'Inside 0' }));
    expect(screen.getByRole('button', { name: 'Inside 1' })).toBeTruthy();
  } finally {
    cleanup();
    root.remove();
  }
});
