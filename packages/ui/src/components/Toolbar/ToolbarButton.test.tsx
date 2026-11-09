import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar.Button and Toolbar.Title', () => {
  test('draws the title and a button named by its words', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Title>My Lab</Toolbar.Title>
        <Toolbar.Button onClick={() => {}}>Save</Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByText('My Lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('names an icon-only button by its title', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button iconOnly title="Undo" onClick={() => {}}>
          U
        </Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  test('will not type an icon-only button with no name', () => {
    // @ts-expect-error an icon-only button needs a title or an aria-label
    const unnamed = <Toolbar.Button iconOnly onClick={() => {}}>U</Toolbar.Button>;
    expect(unnamed).toBeTruthy();
  });

  test('marks a danger grade, runs its click, and respects disabled', () => {
    const onClick = vi.fn();
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button grade="danger" onClick={onClick}>
          Discard
        </Toolbar.Button>
        <Toolbar.Button onClick={() => {}} disabled>
          Off
        </Toolbar.Button>
      </Toolbar>,
    );
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard).toHaveAttribute('data-grade', 'danger');
    discard.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });

  test('holds a pressed button down', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button pressed onClick={() => {}}>
          Grid
        </Toolbar.Button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps a disabled button reachable and says why', () => {
    render(
      <Toolbar aria-label="Trial actions">
        <Toolbar.Button iconOnly title="Close trial" disabled disabledReason="It is the last trial" onClick={() => {}}>
          X
        </Toolbar.Button>
      </Toolbar>,
    );
    const close = screen.getByRole('button', { name: 'Close trial' });
    expect(close).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-description', 'It is the last trial');
  });
});
