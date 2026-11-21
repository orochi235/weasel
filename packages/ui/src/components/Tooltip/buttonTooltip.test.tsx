import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ButtonTooltip, tooltipContent } from './buttonTooltip';

describe('tooltipContent', () => {
  it('names the shortcut after ariaLabel, else a string label', () => {
    expect(tooltipContent({ ariaLabel: 'Bold', label: 'B', shortcut: '⌘B' })).toBe('Bold (⌘B)');
    expect(tooltipContent({ label: 'Undo', shortcut: '⌘Z' })).toBe('Undo (⌘Z)');
    expect(tooltipContent({ label: <svg />, shortcut: '⌘Z' })).toBe('⌘Z');
  });

  it('lets tooltip override the default, and gives nothing without either field', () => {
    expect(tooltipContent({ ariaLabel: 'Bold', shortcut: '⌘B', tooltip: 'Heavier' })).toBe('Heavier');
    expect(tooltipContent({ ariaLabel: 'Bold', label: 'B' })).toBeUndefined();
  });

  it('reads a description in place of the name, shortcut after it', () => {
    expect(tooltipContent({ ariaLabel: 'Bold', description: 'Make it heavier', shortcut: '⌘B' })).toBe('Make it heavier (⌘B)');
    expect(tooltipContent({ description: 'Make it heavier' })).toBe('Make it heavier');
    expect(tooltipContent({ description: '' })).toBeUndefined();
    expect(tooltipContent({ description: 'Heavier', tooltip: 'Override' })).toBe('Override');
  });
});

describe('ButtonTooltip', () => {
  it('keeps a focused button, and its focus, when a reason first gives it a tooltip', () => {
    const at = (disabled: boolean) => (
      <ButtonTooltip tip={{ label: 'Save' }} disabled={disabled} disabledReason="Saving…">
        <button type="button">Save</button>
      </ButtonTooltip>
    );
    const { rerender } = render(at(false));
    const button = screen.getByRole('button', { name: 'Save' });
    button.focus();
    rerender(at(true));
    expect(screen.getByRole('button', { name: 'Save' })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('leaves a button held for a reason undraggable, as a natively disabled one is', () => {
    const onDragStart = vi.fn();
    render(
      <ButtonTooltip tip={{ label: 'Rect' }} disabled disabledReason="Locked">
        <button type="button" draggable onDragStart={onDragStart}>Rect</button>
      </ButtonTooltip>,
    );
    const button = screen.getByRole('button', { name: 'Rect' });
    expect(button.getAttribute('draggable')).toBeNull();
    fireEvent.dragStart(button);
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
