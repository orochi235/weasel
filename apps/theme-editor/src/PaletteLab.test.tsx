import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PaletteLab } from './PaletteLab';

/**
 * The lab's undo/redo/reset rail. It is labkit chrome, so the assertions are
 * on the roles and names the kit's toolbar region produces rather than on
 * class names — the CSS-module proxy answers to a key whether or not a rule
 * still defines it.
 */
describe('<PaletteLab> action rail', () => {
  afterEach(cleanup);

  function rail(): HTMLElement {
    return screen.getByRole('toolbar', { name: 'Lab actions' });
  }

  it('renders the three controls in the lab toolbar', () => {
    render(<PaletteLab />);
    const buttons = within(rail()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Undo', 'Redo', 'Reset']);
  });

  it('titles undo and redo with their shortcuts', () => {
    render(<PaletteLab />);
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toHaveAttribute(
      'title',
      'Undo (⌘Z)',
    );
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toHaveAttribute(
      'title',
      'Redo (⇧⌘Z)',
    );
  });

  it('disables undo and redo until there is history to move through', async () => {
    const user = userEvent.setup();
    render(<PaletteLab />);
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toBeDisabled();

    // Any edit is enough; the surface toggle is the cheapest one to reach.
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toBeDisabled();

    await user.click(within(rail()).getByRole('button', { name: 'Undo' }));
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toBeEnabled();
  });

  it('resets to the default state', async () => {
    const user = userEvent.setup();
    render(<PaletteLab />);
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(rail()).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });
});
