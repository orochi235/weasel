import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { REST_MS } from '../Tree/useRowTip';
import { ReadOnly } from '../Disabled';
import { MenuButton } from './MenuButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ITEMS = [
  { value: 'sine', label: 'Sine wave' },
  { value: 'locked', label: 'Locked', disabled: true, disabledReason: 'Needs a second trial' },
  { value: 'garden', label: 'Garden' },
];

describe('a MenuButton with a disabled item', () => {
  it('lands its arrow keys on the item, says why once the highlight rests, and runs nothing on Enter', () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /Add trial…/ }));
    const menu = screen.getByRole('menu');
    act(() => { fireEvent.keyDown(menu, { key: 'ArrowDown' }); });
    const locked = screen.getByRole('menuitem', { name: /Locked/ });
    expect(menu.getAttribute('aria-activedescendant')).toBe(locked.id);
    act(() => { vi.advanceTimersByTime(REST_MS); });
    expect(screen.getByRole('tooltip').textContent).toContain('Needs a second trial');
    act(() => { fireEvent.keyDown(menu, { key: 'Enter' }); });
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});

describe('a MenuButton in a read-only scope', () => {
  it('opens no menu when it shows a current value', () => {
    render(<ReadOnly when reason="Locked"><MenuButton current label="Sine wave" items={ITEMS} /></ReadOnly>);
    fireEvent.click(screen.getByRole('button', { name: /Sine wave/ }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('still opens as an action menu', () => {
    render(<ReadOnly when reason="Locked"><MenuButton label="Add trial…" items={ITEMS} /></ReadOnly>);
    fireEvent.click(screen.getByRole('button', { name: /Add trial…/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
