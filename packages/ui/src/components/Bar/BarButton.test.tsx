import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Bar } from './Bar';

describe('Bar.Button', () => {
  test('draws the lead and a button named by its words', () => {
    render(
      <Bar label="Trial actions" lead="label">
        <Bar.Button onClick={() => {}}>Save</Bar.Button>
      </Bar>,
    );
    expect(screen.getByText('Trial actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('names an icon-only button by its title', () => {
    render(
      <Bar label="Trial actions">
        <Bar.Button iconOnly title="Undo" onClick={() => {}}>
          U
        </Bar.Button>
      </Bar>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  test('will not type an icon-only button with no name', () => {
    // @ts-expect-error an icon-only button needs a title or an aria-label
    const unnamed = <Bar.Button iconOnly onClick={() => {}}>U</Bar.Button>;
    expect(unnamed).toBeTruthy();
  });

  test('marks a danger grade, runs its click, and respects disabled', () => {
    const onClick = vi.fn();
    render(
      <Bar label="Trial actions">
        <Bar.Button grade="danger" onClick={onClick}>
          Discard
        </Bar.Button>
        <Bar.Button onClick={() => {}} disabled>
          Off
        </Bar.Button>
      </Bar>,
    );
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard).toHaveAttribute('data-grade', 'danger');
    discard.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });

  test('holds a pressed button down', () => {
    render(
      <Bar label="Trial actions">
        <Bar.Button pressed onClick={() => {}}>
          Grid
        </Bar.Button>
      </Bar>,
    );
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps a disabled button reachable and says why', () => {
    render(
      <Bar label="Trial actions">
        <Bar.Button iconOnly title="Close trial" disabled disabledReason="It is the last trial" onClick={() => {}}>
          X
        </Bar.Button>
      </Bar>,
    );
    const close = screen.getByRole('button', { name: 'Close trial' });
    expect(close).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-description', 'It is the last trial');
  });
});
