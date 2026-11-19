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
});
