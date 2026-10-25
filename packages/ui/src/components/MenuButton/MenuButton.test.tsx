import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { MenuButton } from './MenuButton';

const ITEMS = [
  { value: 'sine', label: 'Sine wave' },
  { value: 'garden', label: 'Garden' },
  { value: 'locked', label: 'Locked', isDisabled: true },
];

const trigger = (name: RegExp | string) => screen.getByRole('button', { name });
/** A click with a pointer under it; `fireEvent.click` alone has `detail` 0, which is what Enter on a button sends. */
const press = (el: HTMLElement) => fireEvent.click(el, { detail: 1 });

describe('MenuButton', () => {
  it('is a button that has a menu, shut until pressed', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    const btn = trigger(/Add trial…/);
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu with a row for each item', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    press(trigger(/Add trial…/));
    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual(['Sine wave', 'Garden', 'Locked']);
    expect(trigger(/Add trial…/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('acts on the row chosen and closes', () => {
    const onAction = vi.fn();
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={onAction} />);
    press(trigger(/Add trial…/));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Garden' }));
    expect(onAction).toHaveBeenCalledWith('garden');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps its own label after a row is chosen', () => {
    render(<MenuButton label="Load…" items={ITEMS} onAction={() => {}} />);
    press(trigger(/Load…/));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sine wave' }));
    expect(trigger(/Load…/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sine wave/ })).toBeNull();
  });

  it('takes an accessible name over its label', () => {
    render(<MenuButton label="Load…" aria-label="Load snapshot" items={ITEMS} onAction={() => {}} />);
    expect(trigger('Load snapshot')).toBeTruthy();
  });

  // Proxy: jsdom does not turn Enter into a click, so this sends the `detail: 0` click a browser sends for Enter.
  it('opens as the keyboard does, with the first row highlighted', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    fireEvent.click(trigger(/Add trial…/));
    const menu = screen.getByRole('menu');
    const active = menu.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toHaveTextContent('Sine wave');
  });

  it('marks a disabled item aria-disabled and does not act on it', () => {
    const onAction = vi.fn();
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={onAction} />);
    press(trigger(/Add trial…/));
    const locked = screen.getByRole('menuitem', { name: 'Locked' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(locked);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('draws a row given `checked` as a check row, on or off, and the rest as plain rows', () => {
    const items = [{ value: 'a', label: 'Shown', checked: true }, { value: 'b', label: 'Hidden', checked: false }, { value: 'c', label: 'Plain' }];
    render(<MenuButton label="More shapes" items={items} onAction={() => {}} />);
    press(trigger(/More shapes/));
    expect(screen.getByRole('menuitemcheckbox', { name: /Shown/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: /Hidden/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitem', { name: 'Plain' })).not.toHaveAttribute('aria-checked');
  });

  it('closes on a second press of the button, and stays closed', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    const btn = trigger(/Add trial…/);
    press(btn);
    fireEvent.pointerDown(btn);
    press(btn);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lets a press that ended off the button go, so the next click opens', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    const btn = trigger(/Add trial…/);
    press(btn);
    fireEvent.pointerDown(btn);
    fireEvent.pointerDown(document.body);
    press(btn);
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('opens on a keyboard click after a press on the open button was released elsewhere', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    const btn = trigger(/Add trial…/);
    press(btn);
    fireEvent.pointerDown(btn);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.pointerUp(document.body);
    fireEvent.click(btn);
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('names its menu by the button and marks its rows as inside an overlay', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    press(trigger(/Add trial…/));
    expect(screen.getByRole('menu', { name: /Add trial…/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Garden' }).closest('[data-weasel-overlay]')).not.toBeNull();
  });

  it('returns focus to the button on Escape', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} />);
    press(trigger(/Add trial…/));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger(/Add trial…/));
  });

  it('does not open when disabled', () => {
    render(<MenuButton label="Add trial…" items={ITEMS} onAction={() => {}} isDisabled />);
    press(trigger(/Add trial…/));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('MenuButton link rows', () => {
  const PAGES = [
    { value: 'wall', label: 'Wall', href: '/corpus' },
    { value: 'stats', label: 'Dashboard', href: '/stats', isCurrent: true },
  ];
  const open = () => press(trigger(/Labs/));

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
