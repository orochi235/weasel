import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { MenuButton } from './MenuButton';

const ITEMS = [
  { value: 'sine', label: 'Sine wave' },
  { value: 'garden', label: 'Garden' },
  { value: 'locked', label: 'Locked', isDisabled: true },
];

describe('MenuButton', () => {
  it('is a button named by its label', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /Add trial…/ })).toBeTruthy();
  });

  it('opens a menu and acts on the row chosen', () => {
    const onAction = vi.fn();
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={onAction} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add trial…/ }));
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Garden' }));
    expect(onAction).toHaveBeenCalledWith('garden');
  });

  it('keeps its own label after a row is chosen', () => {
    render(<MenuButton label="Load…" items={ITEMS} onAction={() => {}} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Load…/ }));
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sine wave' }));
    expect(screen.getByRole('button', { name: /Load…/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sine wave/ })).toBeNull();
  });

  it('takes an accessible name over its label', () => {
    render(<MenuButton label="Load…" aria-label="Load snapshot" items={ITEMS} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Load snapshot' })).toBeTruthy();
  });

  it('does not act on a disabled row', () => {
    const onAction = vi.fn();
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={onAction} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Add trial…/ }));
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Locked' }));
    expect(onAction).not.toHaveBeenCalled();
  });
});
