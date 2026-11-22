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

  it('closes on a press outside, a window blur or a resize, and enables its opener again', () => {
    render(<MenuDemo />);
    const opener = screen.getByRole('button', { name: 'Open menu' });
    for (const dismiss of [
      () => fireEvent.pointerDown(document.body),
      () => fireEvent.blur(window),
      () => fireEvent(window, new Event('resize')),
    ]) {
      fireEvent.click(opener);
      expect(screen.getByRole('menu', { name: 'File' })).toBeTruthy();
      dismiss();
      expect(screen.queryByRole('menu')).toBeNull();
      expect((opener as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('stays open on a press inside, and gives focus back to its opener when it closes', () => {
    render(<MenuDemo />);
    const opener = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(opener);
    const menu = screen.getByRole('menu', { name: 'File' });
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: /Export/ }));
    expect(screen.getByRole('menu', { name: 'File' })).toBe(menu);
    fireEvent.keyDown(menu, { key: 'Escape' });
    fireEvent.keyDown(screen.queryByRole('menu') ?? menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
