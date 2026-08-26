import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  test('renders children in a horizontal toolbar', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>My Lab</Toolbar.Title>
        <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByText('My Lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toBe('lk-toolbar');
  });

  test('Title uses lk-toolbar-title class', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>X</Toolbar.Title>
      </Toolbar>,
    );
    expect(container.querySelector('.lk-toolbar-title')).not.toBeNull();
  });

  test('Spacer fills available space', () => {
    const { container } = render(
      <Toolbar>
        <Toolbar.Title>L</Toolbar.Title>
        <Toolbar.Spacer />
        <span>R</span>
      </Toolbar>,
    );
    expect(container.querySelector('.lk-toolbar-spacer')).not.toBeNull();
  });

  test('Button passes onClick and disabled', () => {
    let clicked = false;
    render(
      <Toolbar>
        <Toolbar.Button
          onClick={() => {
            clicked = true;
          }}
        >
          Go
        </Toolbar.Button>
      </Toolbar>,
    );
    screen.getByRole('button', { name: 'Go' }).click();
    expect(clicked).toBe(true);
  });

  test('Button respects disabled', () => {
    render(
      <Toolbar>
        <Toolbar.Button onClick={() => {}} disabled>
          X
        </Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled();
  });
});

function threeButtons() {
  return render(
    <Toolbar aria-label="Trial actions">
      <Toolbar.Group aria-label="History">
        <Toolbar.Button onClick={() => {}} title="Undo">
          U
        </Toolbar.Button>
        <Toolbar.Button onClick={() => {}} title="Redo">
          R
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Button onClick={() => {}} title="Close">
        X
      </Toolbar.Button>
    </Toolbar>,
  );
}

describe('Toolbar keyboard contract', () => {
  test('claims the toolbar role and is nameable', () => {
    threeButtons();
    expect(screen.getByRole('toolbar', { name: 'Trial actions' })).toBeInTheDocument();
  });

  test('keeps exactly one button in the tab order', () => {
    threeButtons();
    const inOrder = screen.getAllByRole('button').filter((b) => b.tabIndex === 0);
    expect(inOrder).toHaveLength(1);
  });

  test('keeps one tab stop when a button becomes enabled', async () => {
    function Bar({ busy }: { busy: boolean }) {
      return (
        <Toolbar aria-label="Trial actions">
          <Toolbar.Button onClick={() => {}} title="Undo" disabled={busy}>
            U
          </Toolbar.Button>
          <Toolbar.Button onClick={() => {}} title="Close">
            X
          </Toolbar.Button>
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
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    threeButtons();
    await user.tab();
    expect(screen.getByTitle('Undo')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTitle('Redo')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByTitle('Undo')).toHaveFocus();
  });
});
