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

describe('MenuButton link rows', () => {
  const PAGES = [
    { value: 'wall', label: 'Wall', href: '/corpus' },
    { value: 'stats', label: 'Dashboard', href: '/stats', isCurrent: true },
  ];
  const open = () => act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Labs/ }));
  });

  it('draws a row with an href as a link to it, and needs no onAction', () => {
    render(<MenuButton label="Labs" items={PAGES} />);
    open();
    const wall = screen.getByRole('menuitem', { name: 'Wall' });
    expect(wall.tagName).toBe('A');
    expect(wall).toHaveAttribute('href', '/corpus');
  });

  it('marks the row for the open page, and only that one', () => {
    render(<MenuButton label="Labs" items={PAGES} />);
    open();
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'Wall' })).not.toHaveAttribute('aria-current');
  });

  it('closes on Escape', () => {
    render(<MenuButton label="Labs" items={PAGES} />);
    open();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

/** Enter keyboard modality, then focus — RAC only opens tooltips on focus-visible. */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
}

describe('MenuButton tooltip', () => {
  it('shows the shortcut after a string label', () => {
    render(<MenuButton label="New" shortcut="⌘N" items={ITEMS} onAction={() => {}} />);
    const btn = screen.getByRole('button', { name: /New/ });
    keyboardFocus(btn);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('New (⌘N)');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('lets tooltip replace the default text, and still opens its menu', () => {
    const onAction = vi.fn();
    render(<MenuButton label="New" tooltip="New document" items={ITEMS} onAction={onAction} />);
    const btn = screen.getByRole('button', { name: /New/ });
    keyboardFocus(btn);
    expect(screen.getByRole('tooltip').textContent).toContain('New document');
    act(() => {
      fireEvent.click(btn);
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Garden' }));
    expect(onAction).toHaveBeenCalledWith('garden');
  });

  it('adds no tooltip without either field', () => {
    render(<MenuButton label="New" items={ITEMS} onAction={() => {}} />);
    const btn = screen.getByRole('button', { name: /New/ });
    keyboardFocus(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
