import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Callout } from './Callout';
import { renderWithIcons } from '../../testing/withIcons';

// jsdom has no focus containment worth the name: React Aria's FocusScope pulls focus back from a real focus event.

afterEach(cleanup);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};

function Page({ modal, onDismiss }: { modal?: boolean; onDismiss?: () => void }) {
  return (
    <>
      <input aria-label="Width" />
      <Callout
        isOpen
        modal={modal}
        anchorRect={{ x: 300, y: 200, width: 40, height: 20 }}
        title="Too small"
        shouldCloseOnInteractOutside={() => false}
        onDismiss={onDismiss}
      >
        Modules fall under one printer dot.
      </Callout>
    </>
  );
}

test('a non-modal callout lets a click elsewhere keep focus, and typing lands there', async () => {
  const onDismiss = vi.fn();
  renderWithIcons(<Page onDismiss={onDismiss} />);
  await frames(3);
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Width' });

  await userEvent.click(input);
  await frames(3);
  expect(document.activeElement).toBe(input);

  await userEvent.keyboard('12');
  expect(input.value).toBe('12');
  expect(screen.getByRole('dialog', { name: 'Too small' })).toBeTruthy();
  expect(onDismiss).not.toHaveBeenCalled();
});

test('a non-modal callout lets programmatic focus leave it', async () => {
  renderWithIcons(<Page />);
  await frames(3);
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Width' });
  input.focus();
  await frames(3);
  expect(document.activeElement).toBe(input);
});

test('a non-modal callout still closes on its close button and on Escape from inside', async () => {
  const onDismiss = vi.fn();
  renderWithIcons(<Page onDismiss={onDismiss} />);
  await frames(3);
  await userEvent.click(screen.getByRole('button', { name: 'Close callout' }));
  expect(onDismiss).toHaveBeenCalledTimes(1);

  screen.getByRole('dialog', { name: 'Too small' }).focus();
  await userEvent.keyboard('{Escape}');
  expect(onDismiss).toHaveBeenCalledTimes(2);
});

test('a modal callout still holds focus inside', async () => {
  renderWithIcons(<Page modal />);
  await frames(3);
  const dialog = screen.getByRole('alertdialog', { name: 'Too small' });
  // A modal callout hides the outside from the accessibility tree, so reach the input through the DOM.
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Width"]')!;
  input.focus();
  await frames(3);
  expect(dialog.contains(document.activeElement)).toBe(true);
});
