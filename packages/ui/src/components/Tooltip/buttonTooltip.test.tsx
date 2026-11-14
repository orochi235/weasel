import { describe, expect, it } from 'vitest';
import { tooltipContent } from './buttonTooltip';

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
