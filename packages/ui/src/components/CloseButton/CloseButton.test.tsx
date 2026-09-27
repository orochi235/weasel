import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CloseButton } from './CloseButton';
import { ICON_PATHS } from '../../icons/paths';

describe('CloseButton', () => {
  it('draws the kit close glyph, not a text ×, named by ariaLabel', () => {
    render(<CloseButton ariaLabel="Close dialog" />);
    const btn = screen.getByRole('button', { name: 'Close dialog' });
    expect(btn.textContent).toBe('');
    const svg = btn.querySelector('svg')!;
    const d = /d="([^"]+)"/.exec(ICON_PATHS.close)![1];
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(d);
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('fires onClick, and not while disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<CloseButton ariaLabel="Remove" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<CloseButton ariaLabel="Remove" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a plain button, so it never submits a surrounding form', () => {
    render(<CloseButton ariaLabel="Close" />);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});
