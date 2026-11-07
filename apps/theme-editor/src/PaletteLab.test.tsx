import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PaletteLab } from './PaletteLab';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

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
    renderWithIcons(<PaletteLab />);
    const buttons = within(rail()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Undo', 'Redo', 'Reset']);
  });

  it('titles undo and redo with their shortcuts', async () => {
    const user = userEvent.setup();
    renderWithIcons(<PaletteLab />);
    // A disabled button takes no focus and shows no tooltip, so give each one history first.
    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(await tooltipOf('Undo')).toContain('Undo (⌘Z)');
    await user.click(within(rail()).getByRole('button', { name: 'Undo' }));
    expect(await tooltipOf('Redo')).toContain('Redo (⇧⌘Z)');
  });

  /** RAC opens a tooltip only on keyboard focus, so enter keyboard modality first. */
  async function tooltipOf(name: string): Promise<string | null> {
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => within(rail()).getByRole('button', { name }).focus());
    return (await screen.findByRole('tooltip')).textContent;
  }

  it('disables undo and redo until there is history to move through', async () => {
    const user = userEvent.setup();
    renderWithIcons(<PaletteLab />);
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toBeDisabled();

    // Any edit is enough; the surface toggle is the cheapest one to reach.
    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toBeDisabled();

    await user.click(within(rail()).getByRole('button', { name: 'Undo' }));
    expect(within(rail()).getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(within(rail()).getByRole('button', { name: 'Redo' })).toBeEnabled();
  });

  it('resets to the default state', async () => {
    const user = userEvent.setup();
    renderWithIcons(<PaletteLab />);
    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');

    await user.click(within(rail()).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });
});
