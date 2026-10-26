import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Toolbar } from './Toolbar';

function threeButtons(roving?: boolean) {
  return render(
    <Toolbar aria-label="Trial actions" roving={roving}>
      <Toolbar.Group aria-label="History">
        <button type="button">Undo</button>
        <button type="button">Redo</button>
      </Toolbar.Group>
      <Toolbar.Spacer />
      <button type="button">Close</button>
    </Toolbar>,
  );
}

describe('Toolbar', () => {
  test('claims the toolbar role and names its groups', () => {
    threeButtons();
    expect(screen.getByRole('toolbar', { name: 'Trial actions' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument();
  });

  test('keeps exactly one button in the tab order', () => {
    threeButtons();
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });

  test('keeps one tab stop when a button becomes enabled', async () => {
    function Bar({ busy }: { busy: boolean }) {
      return (
        <Toolbar aria-label="Trial actions">
          <button type="button" disabled={busy}>Undo</button>
          <button type="button">Close</button>
        </Toolbar>
      );
    }
    const { rerender } = render(<Bar busy />);
    rerender(<Bar busy={false} />);
    await waitFor(() => {
      const inOrder = screen
        .getAllByRole<HTMLButtonElement>('button')
        .filter((b) => !b.disabled && b.tabIndex === 0);
      expect(inOrder).toHaveLength(1);
    });
  });

  test('moves focus with the arrow keys, wrapping at the end', async () => {
    const user = userEvent.setup();
    threeButtons();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });

  test('leaves every button in the tab order and the arrow keys alone without roving', async () => {
    const user = userEvent.setup();
    threeButtons(false);
    expect(screen.getAllByRole('button').every((b) => b.tabIndex === 0)).toBe(true);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });
});
