import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SelectDemo } from '../SelectDemo';

afterEach(cleanup);

const option = (name: string) => screen.getByRole('option', { name: new RegExp(`^${name}`) });
const selected = () =>
  screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.textContent);

describe('SelectDemo from the keyboard', () => {
  it('puts one row in the tab order', () => {
    render(<SelectDemo />);
    const tabbable = screen.getAllByRole('option').filter((o) => o.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  it('moves between rows with the arrows and selects with Space', () => {
    render(<SelectDemo />);
    option('Sky').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(option('Hills'));
    fireEvent.keyDown(document.activeElement!, { key: ' ' });
    expect(selected()).toEqual([expect.stringContaining('Hills')]);
  });

  it('ranges with Shift+Space and toggles with Ctrl+Enter, as a click with those keys does', () => {
    render(<SelectDemo />);
    option('Sky').focus();
    fireEvent.keyDown(option('Sky'), { key: ' ' });
    option('Tree').focus();
    fireEvent.keyDown(option('Tree'), { key: ' ', shiftKey: true });
    expect(selected()).toHaveLength(3);
    fireEvent.keyDown(option('Hills'), { key: 'Enter', ctrlKey: true });
    expect(selected()).toHaveLength(2);
  });

  it('still selects on a click', () => {
    render(<SelectDemo />);
    fireEvent.click(option('House'));
    expect(selected()).toEqual([expect.stringContaining('House')]);
  });
});
