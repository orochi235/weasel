import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MenuDemo } from '../MenuDemo';

afterEach(cleanup);

const highlighted = () => screen.getAllByRole('menuitem').filter((r) => r.className.includes('at')).map((r) => r.textContent);

describe('MenuDemo', () => {
  it('opens a submenu from the keyboard and closes on the row chosen', () => {
    render(<MenuDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('menu');
    expect(highlighted()).toEqual(['New']);
    // Down twice skips the separator and lands on Export; Right opens it.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    expect(highlighted()).toEqual(['Export›', 'PNG']);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('chose SVG')).toBeTruthy();
  });

  it('exposes each open level as a menu, its submenu owned by the row that opened it, and the highlight as the active row', () => {
    render(<MenuDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const root = screen.getByRole('menu', { name: 'File' });
    const active = () => document.getElementById(root.getAttribute('aria-activedescendant') ?? '')?.textContent;
    expect(active()).toBe('New');
    for (const row of root.querySelectorAll('[role^="menuitem"]')) expect(row.closest('ul')?.getAttribute('role')).toMatch(/^(none|menu)$/);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show grid' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    const exportRow = screen.getByRole('menuitem', { name: /Export/ });
    expect(exportRow.getAttribute('aria-expanded')).toBe('true');
    const sub = document.getElementById(exportRow.getAttribute('aria-owns') ?? '');
    expect(sub?.getAttribute('role')).toBe('menu');
    expect(sub?.getAttribute('aria-label')).toBe('Export');
    expect(active()).toBe('PNG');
  });
});

