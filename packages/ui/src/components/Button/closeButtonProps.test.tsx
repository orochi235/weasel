import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { CLOSE_BUTTON_PROPS } from './closeButtonProps';
import { icons as uiIcons } from '../../icons.table';
import { renderWithIcons } from '../../testing/withIcons';

describe('CLOSE_BUTTON_PROPS', () => {
  it('draws the kit close glyph, not a text ×, named by aria-label', () => {
    renderWithIcons(<Button {...CLOSE_BUTTON_PROPS} aria-label="Close dialog" />);
    const btn = screen.getByRole('button', { name: 'Close dialog' });
    expect(btn.textContent).toBe('');
    const svg = btn.querySelector('svg')!;
    const d = /d="([^"]+)"/.exec(uiIcons.icons.close!.body)![1];
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(d);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('is a quiet icon-only ghost', () => {
    renderWithIcons(<Button {...CLOSE_BUTTON_PROPS} aria-label="Close" />);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/variant_ghost/);
    expect(btn.className).toMatch(/iconOnly/);
    expect(btn.getAttribute('data-emphasis')).toBe('low');
  });

  it('fires onClick, and not while disabled', () => {
    const onClick = vi.fn();
    const { rerender } = renderWithIcons(<Button {...CLOSE_BUTTON_PROPS} aria-label="Remove" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button {...CLOSE_BUTTON_PROPS} aria-label="Remove" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a plain button, so it never submits a surrounding form', () => {
    renderWithIcons(<Button {...CLOSE_BUTTON_PROPS} aria-label="Close" />);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});
